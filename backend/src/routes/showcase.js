const router = require('express').Router();
const prisma = require('../lib/prisma');
const { verifyToken } = require('../middleware/auth');

// ═══════════════════════════════════════════════════════
// GET /  — All published projects (any authenticated user)
//   No role-based filtering — showcase is visible to all
// ═══════════════════════════════════════════════════════
router.get('/', verifyToken, async (req, res, next) => {
  try {
    const where = { isPublished: true, status: 'PUBLISHED' };

    // Optional query filters
    if (req.query.domain) where.domain = req.query.domain;
    if (req.query.year) where.group = { year: req.query.year };
    if (req.query.departmentId) where.departmentId = req.query.departmentId;

    const projects = await prisma.project.findMany({
      where,
      include: {
        department: { select: { id: true, name: true, code: true } },
        group: {
          select: {
            id: true,
            name: true,
            year: true,
            division: true,
            academicYear: true,
            guide: {
              select: { id: true, name: true, facultyProfile: { select: { prnNo: true } } },
            },
            members: {
              include: {
                student: {
                  select: { name: true, studentProfile: { select: { prnNo: true } } },
                },
              },
              orderBy: { isLeader: 'desc' },
            },
          },
        },
      },
      orderBy: { publishedAt: 'desc' },
    });

    const result = projects.map((p) => ({
      id: p.id,
      title: p.title,
      abstract: p.abstract,
      domain: p.domain,
      techStack: p.techStack,
      sdgGoals: p.sdgGoals,
      githubLink: p.githubLink,
      videoLink: p.videoLink,
      driveLink: p.driveLink,
      researchPaperLink: p.researchPaperLink,
      patentLink: p.patentLink,
      status: p.status,
      publishedAt: p.publishedAt,
      department: p.department,
      group: p.group
        ? {
            id: p.group.id,
            name: p.group.name,
            year: p.group.year,
            division: p.group.division,
            academicYear: p.group.academicYear,
            guide: p.group.guide
              ? {
                  id: p.group.guide.id,
                  name: p.group.guide.name,
                  prnNo: p.group.guide.facultyProfile?.prnNo || null,
                }
              : null,
            members: p.group.members.map((m) => ({
              isLeader: m.isLeader,
              student: {
                name: m.student.name,
                prnNo: m.student.studentProfile?.prnNo || null,
              },
            })),
          }
        : null,
    }));

    return res.json(result);
  } catch (err) {
    next(err);
  }
});

module.exports = router;

