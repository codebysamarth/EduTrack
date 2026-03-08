const router = require('express').Router();
const prisma = require('../lib/prisma');
const { verifyToken } = require('../middleware/auth');
const { requireRole } = require('../middleware/roleGuard');

// ═══════════════════════════════════════════════════════
// POST /  — Create department (ADMIN only)
// ═══════════════════════════════════════════════════════
router.post('/', verifyToken, requireRole('ADMIN'), async (req, res, next) => {
  try {
    const { name, code } = req.body;
    if (!name || !code) {
      return res.status(400).json({ error: 'name and code are required' });
    }

    const existing = await prisma.department.findUnique({ where: { code } });
    if (existing) {
      return res.status(409).json({ error: 'Department code already exists' });
    }

    const department = await prisma.department.create({ data: { name, code } });
    return res.status(201).json(department);
  } catch (err) {
    next(err);
  }
});

// ═══════════════════════════════════════════════════════
// GET /  — List all departments with counts (public — used in register form)
// ═══════════════════════════════════════════════════════
router.get('/', async (req, res, next) => {
  try {
    const departments = await prisma.department.findMany({
      include: {
        _count: { select: { groups: true, studentProfiles: true } },
        userRoles: {
          where: { role: { name: 'HOD' } },
          include: { user: { include: { facultyProfile: true } } },
          take: 1,
        },
      },
      orderBy: { name: 'asc' },
    });

    const result = departments.map(({ userRoles, ...dept }) => {
      const hodRole = userRoles[0];
      return {
        ...dept,
        hod: hodRole
          ? { id: hodRole.user.id, name: hodRole.user.name, prnNo: hodRole.user.facultyProfile?.prnNo || null }
          : null,
      };
    });

    return res.json(result);
  } catch (err) {
    next(err);
  }
});

// ═══════════════════════════════════════════════════════
// GET /:id  — Department detail with HOD, coordinators, guides
// ═══════════════════════════════════════════════════════
router.get('/:id', verifyToken, async (req, res, next) => {
  try {
    const { id } = req.params;

    const department = await prisma.department.findUnique({
      where: { id },
      include: {
        _count: { select: { groups: true, studentProfiles: true } },
      },
    });
    if (!department) {
      return res.status(404).json({ error: 'Department not found' });
    }

    // Fetch HOD
    const hodRole = await prisma.userRole.findFirst({
      where: { departmentId: id, role: { name: 'HOD' } },
      include: { user: { include: { facultyProfile: true } } },
    });
    const hod = hodRole
      ? {
          id: hodRole.user.id,
          name: hodRole.user.name,
          email: hodRole.user.email,
          prnNo: hodRole.user.facultyProfile?.prnNo || null,
        }
      : null;

    // Fetch coordinators
    const coordRoles = await prisma.userRole.findMany({
      where: { departmentId: id, role: { name: 'COORDINATOR' } },
      include: { user: { include: { facultyProfile: true } } },
    });
    const coordinators = coordRoles.map((ur) => ({
      id: ur.user.id,
      name: ur.user.name,
      email: ur.user.email,
      prnNo: ur.user.facultyProfile?.prnNo || null,
      year: ur.year,
    }));

    // Fetch guides
    const guideRoles = await prisma.userRole.findMany({
      where: { departmentId: id, role: { name: 'GUIDE' } },
      include: { user: { include: { facultyProfile: true } } },
    });
    const guides = guideRoles.map((ur) => ({
      id: ur.user.id,
      name: ur.user.name,
      email: ur.user.email,
      prnNo: ur.user.facultyProfile?.prnNo || null,
    }));

    return res.json({
      id: department.id,
      name: department.name,
      code: department.code,
      hod,
      coordinators,
      guides,
      _count: department._count,
    });
  } catch (err) {
    next(err);
  }
});

// ═══════════════════════════════════════════════════════
// PATCH /:id/assign-hod  — Assign HOD (ADMIN only)
// ═══════════════════════════════════════════════════════
router.patch('/:id/assign-hod', verifyToken, requireRole('ADMIN'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { userId } = req.body;
    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    const department = await prisma.department.findUnique({ where: { id } });
    if (!department) {
      return res.status(404).json({ error: 'Department not found' });
    }

    const faculty = await prisma.facultyProfile.findUnique({ where: { userId } });
    if (!faculty) {
      return res.status(400).json({ error: 'Target user must be a registered faculty member' });
    }

    const role = await prisma.role.upsert({
      where: { name: 'HOD' },
      update: {},
      create: { name: 'HOD' },
    });

    await prisma.userRole.upsert({
      where: { userId_roleId_departmentId: { userId, roleId: role.id, departmentId: id } },
      update: {},
      create: { userId, roleId: role.id, departmentId: id },
    });

    // Keep facultyProfile.departmentId in sync with the HOD assignment
    await prisma.facultyProfile.update({
      where: { userId },
      data: { departmentId: id },
    });

    await prisma.auditLog.create({
      data: {
        userId: req.user.userId,
        action: 'ASSIGN_HOD',
        entityType: 'Department',
        entityId: id,
        metadata: { assignedTo: userId },
      },
    });

    return res.json({ message: 'HOD assigned successfully' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
