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
          coordinatorId: null,
          academicYear,
          semester,
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
        department: { select: { name: true, code: true } },
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
