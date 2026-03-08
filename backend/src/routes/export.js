const router = require('express').Router();
const prisma = require('../lib/prisma');
const { verifyToken } = require('../middleware/auth');
const { requireRole } = require('../middleware/roleGuard');

// ─── Helper: build role-based where clause for groups (OR-logic) ───
async function buildGroupWhereClause(user) {
  const roles = user.roles;
  const userId = user.userId;

  if (roles.includes('ADMIN')) {
    return {};
  }

  const orConditions = [];

  if (roles.includes('HOD')) {
    const hodRole = await prisma.userRole.findFirst({
      where: { userId, role: { name: 'HOD' } },
    });
    if (hodRole?.departmentId) {
      orConditions.push({ departmentId: hodRole.departmentId });
    }
  }

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

  if (roles.includes('GUIDE')) {
    orConditions.push({ guideId: userId });
  }

  if (orConditions.length === 0) return { id: 'NO_ACCESS' };
  if (orConditions.length === 1) return orConditions[0];
  return { OR: orConditions };
}

// ─── Helper: build role-based where clause for projects (OR-logic) ───
async function buildProjectWhereClause(user) {
  const roles = user.roles;
  const userId = user.userId;

  if (roles.includes('ADMIN')) {
    return {};
  }

  const orConditions = [];

  if (roles.includes('HOD')) {
    const hodRole = await prisma.userRole.findFirst({
      where: { userId, role: { name: 'HOD' } },
    });
    if (hodRole?.departmentId) {
      orConditions.push({ departmentId: hodRole.departmentId });
    }
  }

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

  if (roles.includes('GUIDE')) {
    orConditions.push({ group: { guideId: userId } });
  }

  if (orConditions.length === 0) return { id: 'NO_ACCESS' };
  if (orConditions.length === 1) return orConditions[0];
  return { OR: orConditions };
}

// ═══════════════════════════════════════════════════════
// GET /groups  — Export groups data (JSON for frontend)
// ═══════════════════════════════════════════════════════
router.get(
  '/groups',
  verifyToken,
  requireRole('GUIDE', 'COORDINATOR', 'HOD', 'ADMIN'),
  async (req, res, next) => {
    try {
      const where = await buildGroupWhereClause(req.user);

      // Apply optional query filters on top
      if (req.user.roles.includes('ADMIN') && req.query.departmentId) {
        where.departmentId = req.query.departmentId;
      }

      // Apply optional query filters
      if (req.query.year) where.year = req.query.year;
      if (req.query.guideId) where.guideId = req.query.guideId;

      const groups = await prisma.group.findMany({
        where,
        include: {
          department: { select: { code: true } },
          guide: {
            select: {
              name: true,
              facultyProfile: { select: { prnNo: true, designation: true } },
            },
          },
          coordinator: {
            select: {
              name: true,
              facultyProfile: { select: { prnNo: true } },
            },
          },
          members: {
            include: {
              student: {
                select: {
                  name: true,
                  studentProfile: {
                    select: { prnNo: true, enrollmentNo: true, year: true, division: true },
                  },
                },
              },
            },
          },
          project: {
            select: {
              title: true,
              status: true,
              sdgGoals: true,
              domain: true,
              githubLink: true,
              isPublished: true,
            },
          },
        },
        orderBy: { name: 'asc' },
      });

      const rows = groups.map((g) => {
        const leader = g.members.find((m) => m.isLeader);
        return {
          groupName: g.name,
          year: g.year,
          division: g.division,
          academicYear: g.academicYear,
          semester: g.semester,
          departmentCode: g.department?.code || '',
          guideName: g.guide?.name || 'Not Assigned',
          guidePRN: g.guide?.facultyProfile?.prnNo || '',
          coordinatorName: g.coordinator?.name || '',
          coordinatorPRN: g.coordinator?.facultyProfile?.prnNo || '',
          totalStudents: g.members.length,
          leaderName: leader?.student?.name || '',
          leaderPRN: leader?.student?.studentProfile?.prnNo || '',
          allStudentNames: g.members.map((m) => m.student.name).join(', '),
          allStudentPRNs: g.members
            .map((m) => m.student.studentProfile?.prnNo || '')
            .join(', '),
          projectTitle: g.project?.title || 'No Project',
          projectStatus: g.project?.status || 'N/A',
          projectDomain: g.project?.domain || '',
          sdgGoals: g.project?.sdgGoals?.join(', ') || '',
          githubLink: g.project?.githubLink || '',
          isPublished: g.project?.isPublished ? 'Yes' : 'No',
        };
      });

      return res.json(rows);
    } catch (err) {
      next(err);
    }
  },
);

// ═══════════════════════════════════════════════════════
// GET /projects  — Export projects data (JSON for frontend)
// ═══════════════════════════════════════════════════════
router.get(
  '/projects',
  verifyToken,
  requireRole('GUIDE', 'COORDINATOR', 'HOD', 'ADMIN'),
  async (req, res, next) => {
    try {
      const where = await buildProjectWhereClause(req.user);

      // Apply optional query filters on top
      if (req.user.roles.includes('ADMIN') && req.query.departmentId) {
        where.departmentId = req.query.departmentId;
      }

      // Optional query filters
      if (req.query.year && !where.group) {
        where.group = { year: req.query.year };
      } else if (req.query.year && where.group) {
        where.group.year = req.query.year;
      }
      if (req.query.status) where.status = req.query.status;
      if (req.query.isPublished !== undefined) {
        where.isPublished = req.query.isPublished === 'true';
      }
      if (req.query.guideId) {
        if (!where.group) where.group = {};
        where.group.guideId = req.query.guideId;
      }

      const projects = await prisma.project.findMany({
        where,
        include: {
          department: { select: { name: true } },
          group: {
            select: {
              name: true,
              guide: {
                select: {
                  name: true,
                  facultyProfile: { select: { prnNo: true } },
                },
              },
              members: {
                include: {
                  student: {
                    select: {
                      name: true,
                      studentProfile: { select: { prnNo: true } },
                    },
                  },
                },
              },
            },
          },
          reviews: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: { isApproved: true, comment: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      const rows = projects.map((p) => {
        const latestReview = p.reviews?.[0];
        return {
          projectTitle: p.title,
          abstract: p.abstract || '',
          status: p.status,
          domain: p.domain || '',
          techStack: p.techStack || '',
          sdgGoals: p.sdgGoals?.join(', ') || '',
          githubLink: p.githubLink || '',
          videoLink: p.videoLink || '',
          researchPaperLink: p.researchPaperLink || '',
          patentLink: p.patentLink || '',
          ff180Status: p.ff180Status,
          isPublished: p.isPublished ? 'Yes' : 'No',
          publishedAt: p.publishedAt?.toISOString().split('T')[0] || '',
          groupName: p.group?.name || '',
          guideName: p.group?.guide?.name || '',
          guidePRN: p.group?.guide?.facultyProfile?.prnNo || '',
          departmentName: p.department?.name || '',
          memberNames:
            p.group?.members?.map((m) => m.student.name).join(', ') || '',
          memberPRNs:
            p.group?.members
              ?.map((m) => m.student.studentProfile?.prnNo || '')
              .join(', ') || '',
          latestReviewDecision: latestReview
            ? latestReview.isApproved
              ? 'Approved'
              : 'Rejected'
            : 'No Review',
          latestReviewComment: latestReview?.comment || '',
          submittedAt: p.createdAt.toISOString().split('T')[0],
        };
      });

      return res.json(rows);
    } catch (err) {
      next(err);
    }
  },
);

module.exports = router;
