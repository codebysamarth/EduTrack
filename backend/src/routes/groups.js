const router = require('express').Router();
const prisma = require('../lib/prisma');
const { verifyToken } = require('../middleware/auth');
const { requireRole } = require('../middleware/roleGuard');

// ─── Helper: build role-based where clause for groups (OR-logic) ───
async function buildGroupWhereClause(user, prisma) {
  const roles = user.roles;
  const userId = user.userId;

  // ADMIN sees everything
  if (roles.includes('ADMIN')) {
    return {};
  }

  // STUDENT — groups they belong to
  if (roles.includes('STUDENT') && roles.length === 1) {
    return { members: { some: { studentId: userId } } };
  }

  const orConditions = [];

  // HOD — all groups in their department
  if (roles.includes('HOD')) {
    const hodRole = await prisma.userRole.findFirst({
      where: { userId, role: { name: 'HOD' } },
    });
    if (hodRole?.departmentId) {
      orConditions.push({ departmentId: hodRole.departmentId });
    }
  }

  // COORDINATOR — groups in their assigned year+dept (may have multiple)
  if (roles.includes('COORDINATOR')) {
    const coordRoles = await prisma.userRole.findMany({
      where: { userId, role: { name: 'COORDINATOR' } },
    });
    for (const cr of coordRoles) {
      if (cr.departmentId && cr.year) {
        orConditions.push({ departmentId: cr.departmentId, year: cr.year });
      }
    }
  }

  // GUIDE — groups they are directly assigned to guide
  if (roles.includes('GUIDE')) {
    orConditions.push({ guideId: userId });
  }

  if (orConditions.length === 0) {
    return { id: 'NO_ACCESS' };
  }
  if (orConditions.length === 1) {
    return orConditions[0];
  }
  return { OR: orConditions };
}

// ═══════════════════════════════════════════════════════
// GET /classmates — Students get ungrouped classmates (same dept/year/div)
// ═══════════════════════════════════════════════════════
router.get('/classmates', verifyToken, requireRole('STUDENT'), async (req, res, next) => {
  try {
    const profile = await prisma.studentProfile.findUnique({ where: { userId: req.user.userId } });
    if (!profile) return res.status(400).json({ error: 'Student profile not found' });

    const currentAY = req.query.academicYear || '2025-26';
    // Find students already in a group for this academic year
    const studentsInGroups = await prisma.groupMember.findMany({
      where: { group: { academicYear: currentAY, departmentId: profile.departmentId } },
      select: { studentId: true },
    });
    const groupedIds = new Set(studentsInGroups.map(m => m.studentId));

    const classmates = await prisma.user.findMany({
      where: {
        id: { not: req.user.userId },
        studentProfile: {
          departmentId: profile.departmentId,
          year: profile.year,
          division: profile.division,
        },
      },
      include: { studentProfile: { select: { prnNo: true, enrollmentNo: true, year: true, division: true } } },
    });

    const available = classmates
      .filter(s => !groupedIds.has(s.id))
      .map(s => ({
        id: s.id,
        name: s.name,
        email: s.email,
        prnNo: s.studentProfile?.prnNo ?? '',
        enrollmentNo: s.studentProfile?.enrollmentNo ?? '',
      }));

    return res.json(available);
  } catch (err) { next(err); }
});

// ═══════════════════════════════════════════════════════
// GET /my-invitations — Pending invitations for current student
// ═══════════════════════════════════════════════════════
router.get('/my-invitations', verifyToken, requireRole('STUDENT'), async (req, res, next) => {
  try {
    const invitations = await prisma.groupInvitation.findMany({
      where: { studentId: req.user.userId, status: 'PENDING' },
      include: {
        group: {
          include: {
            department: { select: { name: true, code: true } },
            members: {
              include: { student: { select: { id: true, name: true } } },
              orderBy: { isLeader: 'desc' },
            },
            _count: { select: { members: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const result = invitations.map(inv => ({
      id: inv.id,
      groupId: inv.groupId,
      status: inv.status,
      createdAt: inv.createdAt,
      group: {
        id: inv.group.id,
        name: inv.group.name,
        year: inv.group.year,
        division: inv.group.division,
        academicYear: inv.group.academicYear,
        department: inv.group.department,
        membersCount: inv.group._count.members,
        leader: inv.group.members.find(m => m.isLeader)?.student ?? null,
      },
    }));

    return res.json(result);
  } catch (err) { next(err); }
});

// ═══════════════════════════════════════════════════════
// POST /student-create — Student creates group (only self as leader)
// ═══════════════════════════════════════════════════════
router.post('/student-create', verifyToken, requireRole('STUDENT'), async (req, res, next) => {
  try {
    const { name, academicYear, semester } = req.body;

    if (!name || !academicYear || semester == null) {
      return res.status(400).json({ error: 'name, academicYear, and semester are required' });
    }

    const profile = await prisma.studentProfile.findUnique({ where: { userId: req.user.userId } });
    if (!profile) return res.status(400).json({ error: 'Student profile not found' });

    // Check student isn't already in a group for this AY
    const existing = await prisma.groupMember.findFirst({
      where: {
        studentId: req.user.userId,
        group: { academicYear, departmentId: profile.departmentId },
      },
    });
    if (existing) {
      return res.status(409).json({ error: 'You are already in a group for this academic year' });
    }

    const group = await prisma.$transaction(async (tx) => {
      const newGroup = await tx.group.create({
        data: {
          name,
          departmentId: profile.departmentId,
          year: profile.year,
          division: profile.division,
          guideId: null,
          coordinatorId: null,
          academicYear,
          semester,
          status: 'FORMING',
        },
      });

      // Only the creator is added as leader
      await tx.groupMember.create({
        data: { groupId: newGroup.id, studentId: req.user.userId, isLeader: true },
      });

      // Auto-decline any pending invitations for this student
      await tx.groupInvitation.updateMany({
        where: { studentId: req.user.userId, status: 'PENDING' },
        data: { status: 'DECLINED' },
      });

      await tx.auditLog.create({
        data: {
          userId: req.user.userId,
          action: 'STUDENT_CREATE_GROUP',
          entityType: 'Group',
          entityId: newGroup.id,
          metadata: {},
        },
      });

      return tx.group.findUnique({
        where: { id: newGroup.id },
        include: {
          department: true,
          members: {
            include: { student: { include: { studentProfile: true } } },
            orderBy: { isLeader: 'desc' },
          },
          invitations: true,
        },
      });
    });

    return res.status(201).json(group);
  } catch (err) { next(err); }
});

// ═══════════════════════════════════════════════════════
// POST /:id/invite — Leader sends invitations to classmates
// ═══════════════════════════════════════════════════════
router.post('/:id/invite', verifyToken, requireRole('STUDENT'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { studentIds } = req.body;

    if (!Array.isArray(studentIds) || studentIds.length === 0) {
      return res.status(400).json({ error: 'studentIds is required' });
    }

    const group = await prisma.group.findUnique({
      where: { id },
      include: { members: true, invitations: { where: { status: 'PENDING' } } },
    });
    if (!group) return res.status(404).json({ error: 'Group not found' });
    if (group.status !== 'FORMING') {
      return res.status(400).json({ error: 'Can only invite when group is in FORMING status' });
    }

    // Verify requester is the leader
    const leader = group.members.find(m => m.isLeader && m.studentId === req.user.userId);
    if (!leader) return res.status(403).json({ error: 'Only the group leader can send invitations' });

    // Check total wouldn't exceed 5 (members + pending invitations + new)
    const totalPending = group.invitations.length;
    const totalMembers = group.members.length;
    if (totalMembers + totalPending + studentIds.length > 5) {
      return res.status(400).json({ error: `Cannot exceed 5 total (${totalMembers} members, ${totalPending} pending invitations)` });
    }

    // Verify invitees are in same dept/year/div
    const profile = await prisma.studentProfile.findUnique({ where: { userId: req.user.userId } });
    const inviteeProfiles = await prisma.studentProfile.findMany({
      where: {
        userId: { in: studentIds },
        departmentId: profile.departmentId,
        year: profile.year,
        division: profile.division,
      },
    });
    if (inviteeProfiles.length !== studentIds.length) {
      return res.status(400).json({ error: 'All invitees must be in the same department, year, and division' });
    }

    // Check none already in a group
    const alreadyGrouped = await prisma.groupMember.findMany({
      where: {
        studentId: { in: studentIds },
        group: { academicYear: group.academicYear, departmentId: group.departmentId },
      },
      include: { student: { select: { name: true } } },
    });
    if (alreadyGrouped.length > 0) {
      return res.status(409).json({
        error: 'Some students are already in a group',
        conflicting: alreadyGrouped.map(m => ({ id: m.studentId, name: m.student.name })),
      });
    }

    // Create invitations (skip duplicates)
    await prisma.groupInvitation.createMany({
      data: studentIds.map(sId => ({ groupId: id, studentId: sId })),
      skipDuplicates: true,
    });

    const updated = await prisma.group.findUnique({
      where: { id },
      include: {
        department: true,
        members: {
          include: { student: { include: { studentProfile: true } } },
          orderBy: { isLeader: 'desc' },
        },
        invitations: {
          include: { student: { select: { id: true, name: true, studentProfile: { select: { prnNo: true } } } } },
        },
      },
    });

    return res.json(updated);
  } catch (err) { next(err); }
});

// ═══════════════════════════════════════════════════════
// POST /invitations/:invId/respond — Accept or decline invitation
// ═══════════════════════════════════════════════════════
router.post('/invitations/:invId/respond', verifyToken, requireRole('STUDENT'), async (req, res, next) => {
  try {
    const { invId } = req.params;
    const { accept } = req.body; // boolean

    const invitation = await prisma.groupInvitation.findUnique({
      where: { id: invId },
      include: { group: { include: { members: true } } },
    });
    if (!invitation) return res.status(404).json({ error: 'Invitation not found' });
    if (invitation.studentId !== req.user.userId) {
      return res.status(403).json({ error: 'This invitation is not for you' });
    }
    if (invitation.status !== 'PENDING') {
      return res.status(400).json({ error: 'Invitation already responded to' });
    }
    if (invitation.group.status !== 'FORMING') {
      return res.status(400).json({ error: 'Group is no longer accepting members' });
    }

    if (accept) {
      // Check student isn't already in a group for this AY
      const existingMember = await prisma.groupMember.findFirst({
        where: {
          studentId: req.user.userId,
          group: { academicYear: invitation.group.academicYear, departmentId: invitation.group.departmentId },
        },
      });
      if (existingMember) {
        return res.status(409).json({ error: 'You are already in a group for this academic year' });
      }

      // Check group wouldn't exceed 5 members
      if (invitation.group.members.length >= 5) {
        return res.status(400).json({ error: 'Group is already full (5 members)' });
      }

      await prisma.$transaction(async (tx) => {
        // Accept invitation
        await tx.groupInvitation.update({
          where: { id: invId },
          data: { status: 'ACCEPTED' },
        });
        // Add as group member
        await tx.groupMember.create({
          data: { groupId: invitation.groupId, studentId: req.user.userId, isLeader: false },
        });
        // Auto-decline all other pending invitations for this student
        await tx.groupInvitation.updateMany({
          where: { studentId: req.user.userId, status: 'PENDING', id: { not: invId } },
          data: { status: 'DECLINED' },
        });
      });

      return res.json({ message: 'Invitation accepted', groupId: invitation.groupId });
    } else {
      await prisma.groupInvitation.update({
        where: { id: invId },
        data: { status: 'DECLINED' },
      });
      return res.json({ message: 'Invitation declined' });
    }
  } catch (err) { next(err); }
});

// ═══════════════════════════════════════════════════════
// POST /:id/submit-for-approval — Leader submits group
// ═══════════════════════════════════════════════════════
router.post('/:id/submit-for-approval', verifyToken, requireRole('STUDENT'), async (req, res, next) => {
  try {
    const { id } = req.params;

    const group = await prisma.group.findUnique({
      where: { id },
      include: { members: true },
    });
    if (!group) return res.status(404).json({ error: 'Group not found' });
    if (group.status !== 'FORMING') {
      return res.status(400).json({ error: 'Group is not in FORMING status' });
    }

    const leader = group.members.find(m => m.isLeader && m.studentId === req.user.userId);
    if (!leader) return res.status(403).json({ error: 'Only the group leader can submit' });

    if (group.members.length < 3) {
      return res.status(400).json({ error: `Need at least 3 members (currently ${group.members.length})` });
    }

    await prisma.$transaction(async (tx) => {
      await tx.group.update({ where: { id }, data: { status: 'PENDING_APPROVAL' } });
      // Cancel any remaining pending invitations
      await tx.groupInvitation.updateMany({
        where: { groupId: id, status: 'PENDING' },
        data: { status: 'DECLINED' },
      });
      await tx.auditLog.create({
        data: {
          userId: req.user.userId,
          action: 'SUBMIT_GROUP_FOR_APPROVAL',
          entityType: 'Group',
          entityId: id,
          metadata: { memberCount: group.members.length },
        },
      });
    });

    return res.json({ message: 'Group submitted for approval' });
  } catch (err) { next(err); }
});

// ═══════════════════════════════════════════════════════
// POST /:id/approve — Coordinator approves group
// ═══════════════════════════════════════════════════════
router.post('/:id/approve', verifyToken, requireRole('COORDINATOR', 'HOD', 'ADMIN'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { guideId } = req.body; // optional

    const group = await prisma.group.findUnique({ where: { id } });
    if (!group) return res.status(404).json({ error: 'Group not found' });
    if (group.status !== 'PENDING_APPROVAL') {
      return res.status(400).json({ error: 'Group is not pending approval' });
    }

    await prisma.$transaction(async (tx) => {
      await tx.group.update({
        where: { id },
        data: {
          status: 'APPROVED',
          coordinatorId: req.user.userId,
          guideId: guideId || null,
        },
      });
      await tx.auditLog.create({
        data: {
          userId: req.user.userId,
          action: 'APPROVE_GROUP',
          entityType: 'Group',
          entityId: id,
          metadata: { guideId: guideId || null },
        },
      });
    });

    return res.json({ message: 'Group approved' });
  } catch (err) { next(err); }
});

// ═══════════════════════════════════════════════════════
// POST /:id/reject-group — Coordinator rejects group back to FORMING
// ═══════════════════════════════════════════════════════
router.post('/:id/reject-group', verifyToken, requireRole('COORDINATOR', 'HOD', 'ADMIN'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const group = await prisma.group.findUnique({ where: { id } });
    if (!group) return res.status(404).json({ error: 'Group not found' });
    if (group.status !== 'PENDING_APPROVAL') {
      return res.status(400).json({ error: 'Group is not pending approval' });
    }

    await prisma.$transaction(async (tx) => {
      await tx.group.update({ where: { id }, data: { status: 'FORMING' } });
      await tx.auditLog.create({
        data: {
          userId: req.user.userId,
          action: 'REJECT_GROUP',
          entityType: 'Group',
          entityId: id,
          metadata: { reason: reason || null },
        },
      });
    });

    return res.json({ message: 'Group rejected, sent back to forming' });
  } catch (err) { next(err); }
});

// ═══════════════════════════════════════════════════════
// DELETE /:id/leave — Student leaves a FORMING group (non-leader)
// ═══════════════════════════════════════════════════════
router.delete('/:id/leave', verifyToken, requireRole('STUDENT'), async (req, res, next) => {
  try {
    const { id } = req.params;

    const member = await prisma.groupMember.findFirst({
      where: { groupId: id, studentId: req.user.userId },
    });
    if (!member) return res.status(404).json({ error: 'You are not a member of this group' });
    if (member.isLeader) return res.status(400).json({ error: 'Leader cannot leave. Disband the group instead.' });

    const group = await prisma.group.findUnique({ where: { id } });
    if (group.status !== 'FORMING') {
      return res.status(400).json({ error: 'Can only leave group while it is forming' });
    }

    await prisma.groupMember.delete({ where: { id: member.id } });

    return res.json({ message: 'You have left the group' });
  } catch (err) { next(err); }
});

// ═══════════════════════════════════════════════════════
// POST /  — Create group (COORDINATOR, HOD, ADMIN)
// ═══════════════════════════════════════════════════════
router.post('/', verifyToken, requireRole('COORDINATOR', 'HOD', 'ADMIN'), async (req, res, next) => {
  try {
    const { name, departmentId, year, division, guideId, academicYear, semester, studentIds } = req.body;

    if (!name || !departmentId || !year || !division || !academicYear || semester == null) {
      return res.status(400).json({ error: 'name, departmentId, year, division, academicYear, and semester are required' });
    }

    if (!Array.isArray(studentIds) || studentIds.length < 3 || studentIds.length > 5) {
      return res.status(400).json({ error: 'studentIds must be an array of 3-5 student userIds' });
    }

    // Verify each student has a profile in this department
    const profiles = await prisma.studentProfile.findMany({
      where: { userId: { in: studentIds }, departmentId },
    });
    if (profiles.length !== studentIds.length) {
      const foundIds = profiles.map((p) => p.userId);
      const missing = studentIds.filter((id) => !foundIds.includes(id));
      return res.status(400).json({
        error: 'Some students not found in this department',
        missingStudentIds: missing,
      });
    }

    // Check students aren't already in a group for this academic year
    const existingMembers = await prisma.groupMember.findMany({
      where: {
        studentId: { in: studentIds },
        group: { academicYear, departmentId },
      },
      include: { group: true },
    });
    if (existingMembers.length > 0) {
      return res.status(409).json({
        error: 'Some students are already in a group for this academic year',
        conflicting: existingMembers.map((m) => m.studentId),
      });
    }

    const group = await prisma.$transaction(async (tx) => {
      const newGroup = await tx.group.create({
        data: {
          name,
          departmentId,
          year,
          division,
          guideId: guideId || null,
          coordinatorId: req.user.userId,
          academicYear,
          semester,
          status: 'APPROVED',
        },
      });

      const memberData = studentIds.map((sId, idx) => ({
        groupId: newGroup.id,
        studentId: sId,
        isLeader: idx === 0,
      }));

      await tx.groupMember.createMany({ data: memberData });

      await tx.auditLog.create({
        data: {
          userId: req.user.userId,
          action: 'CREATE_GROUP',
          entityType: 'Group',
          entityId: newGroup.id,
          metadata: { studentCount: studentIds.length },
        },
      });

      return tx.group.findUnique({
        where: { id: newGroup.id },
        include: {
          department: true,
          guide: { include: { facultyProfile: true } },
          members: {
            include: { student: { include: { studentProfile: true } } },
            orderBy: { isLeader: 'desc' },
          },
        },
      });
    });

    return res.status(201).json(group);
  } catch (err) {
    next(err);
  }
});

// ═══════════════════════════════════════════════════════
// GET /  — List groups (role-filtered)
// ═══════════════════════════════════════════════════════
router.get('/', verifyToken, async (req, res, next) => {
  try {
    const whereClause = await buildGroupWhereClause(req.user, prisma);

    // Allow admin to filter by departmentId query param
    if (req.user.roles.includes('ADMIN') && req.query.departmentId) {
      whereClause.departmentId = req.query.departmentId;
    }

    // Allow year filter from query param (layered on top of role filter)
    if (req.query.year) {
      whereClause.year = req.query.year;
    }

    const groups = await prisma.group.findMany({
      where: whereClause,
      include: {
        department: { select: { id: true, name: true, code: true } },
        guide: { include: { facultyProfile: true } },
        coordinator: { include: { facultyProfile: true } },
        _count: { select: { members: true } },
        project: { select: { id: true, title: true, status: true, isPublished: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const result = groups.map((g) => ({
      id: g.id,
      name: g.name,
      year: g.year,
      division: g.division,
      academicYear: g.academicYear,
      semester: g.semester,
      status: g.status,
      departmentId: g.departmentId,
      department: g.department,
      guide: g.guide
        ? { id: g.guide.id, name: g.guide.name, prnNo: g.guide.facultyProfile?.prnNo || null }
        : null,
      coordinator: g.coordinator
        ? { id: g.coordinator.id, name: g.coordinator.name }
        : null,
      membersCount: g._count.members,
      project: g.project || null,
    }));

    return res.json(result);
  } catch (err) {
    next(err);
  }
});

// ═══════════════════════════════════════════════════════
// GET /:id  — Full group detail
// ═══════════════════════════════════════════════════════
router.get('/:id', verifyToken, async (req, res, next) => {
  try {
    const { id } = req.params;
    const roles = req.user.roles;

    const group = await prisma.group.findUnique({
      where: { id },
      include: {
        department: { select: { name: true, code: true } },
        guide: { include: { facultyProfile: true } },
        coordinator: { include: { facultyProfile: true } },
        members: {
          include: {
            student: { include: { studentProfile: true } },
          },
          orderBy: { isLeader: 'desc' },
        },
        invitations: {
          include: { student: { select: { id: true, name: true, studentProfile: { select: { prnNo: true } } } } },
        },
        project: {
          select: {
            id: true, title: true, abstract: true, status: true,
            sdgGoals: true, domain: true, githubLink: true, isPublished: true,
          },
        },
      },
    });

    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    // Access control — use same OR-logic as list endpoint
    if (!roles.includes('ADMIN')) {
      const accessWhere = await buildGroupWhereClause(req.user, prisma);
      // If empty where (admin), skip check. Otherwise verify this group matches.
      if (Object.keys(accessWhere).length > 0) {
        const match = await prisma.group.findFirst({
          where: { id: group.id, ...accessWhere },
          select: { id: true },
        });
        if (!match) {
          return res.status(403).json({ error: 'You do not have access to this group' });
        }
      }
    }

    const result = {
      id: group.id,
      name: group.name,
      year: group.year,
      division: group.division,
      academicYear: group.academicYear,
      semester: group.semester,
      status: group.status,
      department: group.department,
      guide: group.guide
        ? {
            id: group.guide.id,
            name: group.guide.name,
            email: group.guide.email,
            prnNo: group.guide.facultyProfile?.prnNo || null,
          }
        : null,
      coordinator: group.coordinator
        ? {
            id: group.coordinator.id,
            name: group.coordinator.name,
            email: group.coordinator.email,
            prnNo: group.coordinator.facultyProfile?.prnNo || null,
          }
        : null,
      members: group.members.map((m) => ({
        id: m.id,
        isLeader: m.isLeader,
        student: {
          id: m.student.id,
          name: m.student.name,
          email: m.student.email,
          prnNo: m.student.studentProfile?.prnNo || null,
          enrollmentNo: m.student.studentProfile?.enrollmentNo || null,
          year: m.student.studentProfile?.year || null,
          division: m.student.studentProfile?.division || null,
        },
      })),
      invitations: (group.invitations ?? []).map(inv => ({
        id: inv.id,
        status: inv.status,
        student: {
          id: inv.student.id,
          name: inv.student.name,
          prnNo: inv.student.studentProfile?.prnNo || null,
        },
      })),
      project: group.project || null,
    };

    return res.json(result);
  } catch (err) {
    next(err);
  }
});

// ═══════════════════════════════════════════════════════
// PATCH /:id  — Update group (COORDINATOR, HOD, ADMIN)
// ═══════════════════════════════════════════════════════
router.patch('/:id', verifyToken, requireRole('COORDINATOR', 'HOD', 'ADMIN'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { guideId, addStudentIds, removeStudentIds } = req.body;

    const group = await prisma.group.findUnique({
      where: { id },
      include: { members: true },
    });
    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    await prisma.$transaction(async (tx) => {
      // Update guide
      if (guideId !== undefined) {
        await tx.group.update({ where: { id }, data: { guideId } });
        await tx.auditLog.create({
          data: {
            userId: req.user.userId,
            action: 'UPDATE_GUIDE',
            entityType: 'Group',
            entityId: id,
            metadata: { guideId },
          },
        });
      }

      // Add members
      if (Array.isArray(addStudentIds) && addStudentIds.length > 0) {
        const profiles = await tx.studentProfile.findMany({
          where: { userId: { in: addStudentIds }, departmentId: group.departmentId },
        });
        if (profiles.length !== addStudentIds.length) {
          throw Object.assign(
            new Error('Some students not found in this department'),
            { status: 400 }
          );
        }

        const totalAfter = group.members.length + addStudentIds.length;
        if (totalAfter > 5) {
          throw Object.assign(
            new Error(`Group cannot exceed 5 members (currently ${group.members.length})`),
            { status: 400 }
          );
        }

        await tx.groupMember.createMany({
          data: addStudentIds.map((sId) => ({
            groupId: id,
            studentId: sId,
            isLeader: false,
          })),
          skipDuplicates: true,
        });

        await tx.auditLog.create({
          data: {
            userId: req.user.userId,
            action: 'ADD_MEMBERS',
            entityType: 'Group',
            entityId: id,
            metadata: { addedStudents: addStudentIds },
          },
        });
      }

      // Remove members
      if (Array.isArray(removeStudentIds) && removeStudentIds.length > 0) {
        // Check if trying to remove leader
        const leader = group.members.find((m) => m.isLeader);
        if (leader && removeStudentIds.includes(leader.studentId)) {
          throw Object.assign(
            new Error('Cannot remove group leader. Assign a new leader first.'),
            { status: 400 }
          );
        }

        const remaining = group.members.length - removeStudentIds.length + (addStudentIds?.length || 0);
        if (remaining < 3) {
          throw Object.assign(
            new Error(`Group must have at least 3 members (would have ${remaining})`),
            { status: 400 }
          );
        }

        await tx.groupMember.deleteMany({
          where: { groupId: id, studentId: { in: removeStudentIds } },
        });

        await tx.auditLog.create({
          data: {
            userId: req.user.userId,
            action: 'REMOVE_MEMBERS',
            entityType: 'Group',
            entityId: id,
            metadata: { removedStudents: removeStudentIds },
          },
        });
      }
    });

    // Return updated group
    const updated = await prisma.group.findUnique({
      where: { id },
      include: {
        department: true,
        guide: { include: { facultyProfile: true } },
        members: {
          include: { student: { include: { studentProfile: true } } },
          orderBy: { isLeader: 'desc' },
        },
      },
    });

    return res.json(updated);
  } catch (err) {
    next(err);
  }
});

// ═══════════════════════════════════════════════════════
// GET /:id/members-export  — Export-ready member list
// ═══════════════════════════════════════════════════════
router.get('/:id/members-export', verifyToken, requireRole('GUIDE', 'COORDINATOR', 'HOD', 'ADMIN'), async (req, res, next) => {
  try {
    const { id } = req.params;

    const group = await prisma.group.findUnique({
      where: { id },
      include: {
        members: {
          include: { student: { include: { studentProfile: true } } },
          orderBy: { isLeader: 'desc' },
        },
      },
    });

    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    const exportData = group.members.map((m) => ({
      name: m.student.name,
      prnNo: m.student.studentProfile?.prnNo || '',
      enrollmentNo: m.student.studentProfile?.enrollmentNo || '',
      email: m.student.email,
      year: m.student.studentProfile?.year || '',
      division: m.student.studentProfile?.division || '',
      isLeader: m.isLeader,
    }));

    return res.json(exportData);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
