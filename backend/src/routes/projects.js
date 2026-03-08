const router = require('express').Router();
const prisma = require('../lib/prisma');
const { verifyToken } = require('../middleware/auth');
const { requireRole } = require('../middleware/roleGuard');

// ─── Helper: build role-based where clause for projects (OR-logic) ───
async function buildProjectWhereClause(user, prisma) {
  const roles = user.roles;
  const userId = user.userId;

  // ADMIN — no filter
  if (roles.includes('ADMIN')) {
    return {};
  }

  // STUDENT (sole role) — find their group's project
  if (roles.includes('STUDENT') && roles.length === 1) {
    const membership = await prisma.groupMember.findFirst({
      where: { studentId: userId },
      select: { groupId: true },
    });
    if (!membership) return { id: 'NO_PROJECT' };
    return { groupId: membership.groupId };
  }

  const orConditions = [];

  // HOD — all projects in their department
  if (roles.includes('HOD')) {
    const hodRole = await prisma.userRole.findFirst({
      where: { userId, role: { name: 'HOD' } },
    });
    if (hodRole?.departmentId) {
      orConditions.push({ departmentId: hodRole.departmentId });
    }
  }

  // COORDINATOR — projects in their assigned year+dept (may have multiple)
  if (roles.includes('COORDINATOR')) {
    const coordRoles = await prisma.userRole.findMany({
      where: { userId, role: { name: 'COORDINATOR' } },
    });
    for (const cr of coordRoles) {
      if (cr.departmentId && cr.year) {
        orConditions.push({
          group: { departmentId: cr.departmentId, year: cr.year },
        });
      }
    }
  }

  // GUIDE — projects in groups they are assigned to guide
  if (roles.includes('GUIDE')) {
    orConditions.push({ group: { guideId: userId } });
  }

  if (orConditions.length === 0) {
    return { id: 'NO_ACCESS' };
  }
  if (orConditions.length === 1) {
    return orConditions[0];
  }
  return { OR: orConditions };
}

// ─── Helper: verify student is leader of a group ───────
async function verifyLeader(userId, groupId) {
  return prisma.groupMember.findFirst({
    where: { groupId, studentId: userId, isLeader: true },
  });
}

// ─── Helper: verify student is member of project's group
async function verifyGroupMember(userId, projectId) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { groupId: true },
  });
  if (!project) return null;
  return prisma.groupMember.findFirst({
    where: { groupId: project.groupId, studentId: userId },
  });
}

// ═══════════════════════════════════════════════════════
// POST /  — Create project (group leader only)
// ═══════════════════════════════════════════════════════
router.post('/', verifyToken, async (req, res, next) => {
  try {
    const { groupId, title, abstract, sdgGoals, domain, techStack, githubLink } = req.body;

    if (!groupId || !title) {
      return res.status(400).json({ error: 'groupId and title are required' });
    }

    // Verify leader
    const leader = await verifyLeader(req.user.userId, groupId);
    if (!leader) {
      return res.status(403).json({ error: 'Only group leader can create project' });
    }

    // Check no project exists for this group
    const existing = await prisma.project.findUnique({ where: { groupId } });
    if (existing) {
      return res.status(409).json({ error: 'A project already exists for this group' });
    }

    const group = await prisma.group.findUnique({ where: { id: groupId } });

    const project = await prisma.project.create({
      data: {
        groupId,
        departmentId: group.departmentId,
        title,
        abstract: abstract || null,
        sdgGoals: sdgGoals || [],
        domain: domain || null,
        techStack: techStack || null,
        githubLink: githubLink || null,
        status: 'DRAFT',
      },
    });

    return res.status(201).json(project);
  } catch (err) {
    next(err);
  }
});

// ═══════════════════════════════════════════════════════
// PATCH /:id  — Edit project
//   • Link-only fields → any group member
//   • Title/abstract/domain/techStack → leader only, DRAFT/REJECTED
// ═══════════════════════════════════════════════════════
router.patch('/:id', verifyToken, async (req, res, next) => {
  try {
    const { id } = req.params;

    const project = await prisma.project.findUnique({ where: { id } });
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const linkFields = ['githubLink', 'videoLink', 'driveLink', 'researchPaperLink', 'patentLink'];
    const editFields = ['title', 'abstract', 'sdgGoals', 'domain', 'techStack'];
    const hasEditFields = editFields.some((f) => req.body[f] !== undefined);

    if (hasEditFields) {
      // Editing project content — leader only, DRAFT/REJECTED only
      const leader = await verifyLeader(req.user.userId, project.groupId);
      if (!leader) {
        return res.status(403).json({ error: 'Only group leader can edit project details' });
      }
      if (!['DRAFT', 'REJECTED'].includes(project.status)) {
        return res.status(400).json({ error: 'Cannot edit project in current status' });
      }
    } else {
      // Link-only update — any group member can update resource links
      const member = await verifyGroupMember(req.user.userId, id);
      if (!member) {
        return res.status(403).json({ error: 'You are not a member of this project\'s group' });
      }
    }

    const allowed = [...editFields, ...linkFields];
    const data = {};
    for (const field of allowed) {
      if (req.body[field] !== undefined) data[field] = req.body[field];
    }

    // If re-editing content after rejection, set back to DRAFT
    if (hasEditFields && project.status === 'REJECTED' && Object.keys(data).length > 0) {
      data.status = 'DRAFT';
    }

    const updated = await prisma.project.update({ where: { id }, data });
    return res.json(updated);
  } catch (err) {
    next(err);
  }
});

// ═══════════════════════════════════════════════════════
// POST /:id/submit  — Submit project for review
// ═══════════════════════════════════════════════════════
router.post('/:id/submit', verifyToken, async (req, res, next) => {
  try {
    const { id } = req.params;

    const project = await prisma.project.findUnique({ where: { id } });
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const leader = await verifyLeader(req.user.userId, project.groupId);
    if (!leader) {
      return res.status(403).json({ error: 'Only group leader can submit project' });
    }

    if (project.status !== 'DRAFT') {
      return res.status(400).json({ error: 'Only DRAFT projects can be submitted' });
    }

    if (!project.title || !project.abstract) {
      return res.status(400).json({ error: 'Title and abstract are required before submission' });
    }

    await prisma.project.update({
      where: { id },
      data: { status: 'SUBMITTED' },
    });

    await prisma.auditLog.create({
      data: {
        userId: req.user.userId,
        action: 'SUBMIT_PROJECT',
        entityType: 'Project',
        entityId: id,
      },
    });

    return res.json({ message: 'Project submitted for review', status: 'SUBMITTED' });
  } catch (err) {
    next(err);
  }
});

// ═══════════════════════════════════════════════════════
// GET /  — List projects (role-filtered)
// ═══════════════════════════════════════════════════════
router.get('/', verifyToken, async (req, res, next) => {
  try {
    const whereClause = await buildProjectWhereClause(req.user, prisma);

    // Additional query param filters (layered on top of role filter)
    if (req.query.departmentId && req.user.roles.includes('ADMIN')) {
      whereClause.departmentId = req.query.departmentId;
    }
    if (req.query.status) {
      whereClause.status = req.query.status;
    }
    if (req.query.isPublished !== undefined) {
      whereClause.isPublished = req.query.isPublished === 'true';
    }
    if (req.query.year) {
      // Layer year filter on group relation
      if (whereClause.group) {
        // If group is already an object, merge year into it
        if (typeof whereClause.group === 'object' && !Array.isArray(whereClause.group)) {
          whereClause.group.year = req.query.year;
        }
      } else {
        whereClause.group = { year: req.query.year };
      }
    }

    const projects = await prisma.project.findMany({
      where: whereClause,
      include: {
        group: {
          select: {
            name: true,
            year: true,
            division: true,
            departmentId: true,
            department: { select: { id: true, name: true, code: true } },
            guide: { include: { facultyProfile: true } },
            _count: { select: { members: true } },
          },
        },
        reviews: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            id: true,
            isApproved: true,
            comment: true,
            rejectionReason: true,
            createdAt: true,
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    const result = projects.map((p) => ({
      id: p.id,
      title: p.title,
      status: p.status,
      domain: p.domain,
      sdgGoals: p.sdgGoals,
      isPublished: p.isPublished,
      group: {
        name: p.group.name,
        year: p.group.year,
        division: p.group.division,
        departmentId: p.group.departmentId,
        department: p.group.department || null,
      },
      guide: p.group.guide
        ? { name: p.group.guide.name, prnNo: p.group.guide.facultyProfile?.prnNo || null }
        : null,
      latestReview: p.reviews[0] || null,
      memberCount: p.group._count.members,
    }));

    return res.json(result);
  } catch (err) {
    next(err);
  }
});

// ═══════════════════════════════════════════════════════
// GET /:id  — Full project detail
// ═══════════════════════════════════════════════════════
router.get('/:id', verifyToken, async (req, res, next) => {
  try {
    const { id } = req.params;

    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        department: true,
        group: {
          include: {
            department: { select: { name: true, code: true } },
            guide: { include: { facultyProfile: true } },
            coordinator: { include: { facultyProfile: true } },
            members: {
              include: { student: { include: { studentProfile: true } } },
              orderBy: { isLeader: 'desc' },
            },
          },
        },
        reviews: {
          include: { reviewer: { select: { id: true, name: true, email: true } } },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Format members with prnNo
    const members = project.group.members.map((m) => ({
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
    }));

    const guide = project.group.guide
      ? {
          id: project.group.guide.id,
          name: project.group.guide.name,
          email: project.group.guide.email,
          prnNo: project.group.guide.facultyProfile?.prnNo || null,
        }
      : null;

    return res.json({
      id: project.id,
      title: project.title,
      abstract: project.abstract,
      sdgGoals: project.sdgGoals,
      domain: project.domain,
      techStack: project.techStack,
      githubLink: project.githubLink,
      videoLink: project.videoLink,
      driveLink: project.driveLink,
      researchPaperLink: project.researchPaperLink,
      patentLink: project.patentLink,
      ff180Status: project.ff180Status,
      status: project.status,
      isPublished: project.isPublished,
      publishedAt: project.publishedAt,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
      department: project.department,
      group: {
        id: project.group.id,
        name: project.group.name,
        year: project.group.year,
        division: project.group.division,
        academicYear: project.group.academicYear,
        semester: project.group.semester,
        members,
      },
      guide,
      reviews: project.reviews,
    });
  } catch (err) {
    next(err);
  }
});

// ═══════════════════════════════════════════════════════
// POST /:id/review  — Guide reviews a project
// ═══════════════════════════════════════════════════════
router.post('/:id/review', verifyToken, requireRole('GUIDE', 'HOD', 'ADMIN'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { isApproved, comment, rejectionReason } = req.body;

    if (typeof isApproved !== 'boolean' || !comment) {
      return res.status(400).json({ error: 'isApproved (boolean) and comment are required' });
    }

    if (!isApproved && !rejectionReason) {
      return res.status(400).json({ error: 'rejectionReason is required when rejecting a project' });
    }

    const project = await prisma.project.findUnique({
      where: { id },
      include: { group: true },
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const isAssignedGuide = project.group.guideId === req.user.userId;
    const isHODOfDept = req.user.roles.includes('HOD') &&
      project.group.departmentId === req.user.departmentId;
    const isAdmin = req.user.roles.includes('ADMIN');

    if (!isAssignedGuide && !isHODOfDept && !isAdmin) {
      return res.status(403).json({ error: 'Only the assigned guide, HOD, or admin can review this project' });
    }

    if (!['SUBMITTED', 'UNDER_REVIEW'].includes(project.status)) {
      return res.status(400).json({ error: 'Project must be SUBMITTED or UNDER_REVIEW to review' });
    }

    const newStatus = isApproved ? 'APPROVED' : 'REJECTED';

    const [review] = await prisma.$transaction([
      prisma.projectReview.create({
        data: {
          projectId: id,
          reviewerId: req.user.userId,
          isApproved,
          comment,
          rejectionReason: rejectionReason || null,
        },
      }),
      prisma.project.update({
        where: { id },
        data: { status: newStatus },
      }),
      prisma.auditLog.create({
        data: {
          userId: req.user.userId,
          action: isApproved ? 'APPROVE_PROJECT' : 'REJECT_PROJECT',
          entityType: 'Project',
          entityId: id,
        },
      }),
    ]);

    return res.json({
      message: isApproved ? 'Project approved' : 'Project rejected',
      review,
      newStatus,
    });
  } catch (err) {
    next(err);
  }
});

// ═══════════════════════════════════════════════════════
// PATCH /:id/publish  — Publish project to showcase
//   Guide: can publish their own group's project
//   HOD/ADMIN: can publish any project in scope
// ═══════════════════════════════════════════════════════
router.patch('/:id/publish', verifyToken, requireRole('GUIDE', 'HOD', 'ADMIN'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const roles = req.user.roles;

    const project = await prisma.project.findUnique({
      where: { id },
      include: { group: true },
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Guide must be assigned to this group; HOD/ADMIN bypass this check
    if (roles.includes('GUIDE') && !roles.includes('HOD') && !roles.includes('ADMIN')) {
      if (project.group.guideId !== req.user.userId) {
        return res.status(403).json({ error: 'You are not the assigned guide for this project' });
      }
    }

    if (!['APPROVED', 'COMPLETED'].includes(project.status)) {
      return res.status(400).json({ error: 'Project must be APPROVED or COMPLETED to publish' });
    }

    await prisma.project.update({
      where: { id },
      data: { isPublished: true, publishedAt: new Date(), status: 'PUBLISHED' },
    });

    await prisma.auditLog.create({
      data: {
        userId: req.user.userId,
        action: 'PUBLISH_PROJECT',
        entityType: 'Project',
        entityId: id,
      },
    });

    return res.json({ message: 'Project published to showcase' });
  } catch (err) {
    next(err);
  }
});

// ═══════════════════════════════════════════════════════
// PATCH /:id/status  — Admin/HOD force-override project status
// ═══════════════════════════════════════════════════════
router.patch('/:id/status', verifyToken, requireRole('HOD', 'ADMIN'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = ['DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'COMPLETED', 'PUBLISHED'];
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({ error: `status must be one of: ${validStatuses.join(', ')}` });
    }

    const project = await prisma.project.findUnique({ where: { id } });
    if (!project) return res.status(404).json({ error: 'Project not found' });

    const data = { status };
    if (status === 'PUBLISHED') data.isPublished = true;

    await prisma.project.update({ where: { id }, data });

    await prisma.auditLog.create({
      data: {
        userId: req.user.userId,
        action: 'FORCE_STATUS_CHANGE',
        entityType: 'Project',
        entityId: id,
        metadata: { newStatus: status },
      },
    });

    return res.json({ message: `Project status updated to ${status}` });
  } catch (err) {
    next(err);
  }
});

// ═══════════════════════════════════════════════════════
// POST /:id/links  — Student adds/updates links
// ═══════════════════════════════════════════════════════
router.post('/:id/links', verifyToken, async (req, res, next) => {
  try {
    const { id } = req.params;

    const member = await verifyGroupMember(req.user.userId, id);
    if (!member) {
      return res.status(403).json({ error: 'You are not a member of this project\'s group' });
    }

    const linkFields = ['researchPaperLink', 'patentLink', 'videoLink', 'driveLink', 'githubLink'];
    const data = {};
    for (const field of linkFields) {
      if (req.body[field] !== undefined) data[field] = req.body[field];
    }

    if (Object.keys(data).length === 0) {
      return res.status(400).json({ error: 'At least one link field is required' });
    }

    const updated = await prisma.project.update({ where: { id }, data });
    return res.json(updated);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
