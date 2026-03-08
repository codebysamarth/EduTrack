const router = require('express').Router();
const prisma = require('../lib/prisma');
const { verifyToken } = require('../middleware/auth');
const { requireRole } = require('../middleware/roleGuard');

// ─── Helper: extract prnNo from user with included profiles ─
function getPrn(user) {
  return user.studentProfile?.prnNo || user.facultyProfile?.prnNo || null;
}

// ═══════════════════════════════════════════════════════
// GET /  — List all users, paginated (ADMIN)
// ═══════════════════════════════════════════════════════
router.get('/', verifyToken, requireRole('ADMIN'), async (req, res, next) => {
  try {
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 20, 1), 100);
    const skip = (page - 1) * limit;

    const where = {};

    if (req.query.departmentId) {
      where.OR = [
        { studentProfile: { departmentId: req.query.departmentId } },
        { facultyProfile: { departmentId: req.query.departmentId } },
      ];
    }

    if (req.query.role) {
      where.roles = { some: { role: { name: req.query.role } } };
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          roles: { include: { role: true } },
          studentProfile: true,
          facultyProfile: true,
        },
      }),
      prisma.user.count({ where }),
    ]);

    const result = users.map((u) => {
      const { password: _, ...safe } = u;
      return {
        ...safe,
        prnNo: getPrn(u),
        roles: u.roles.map((ur) => ur.role.name),
      };
    });

    return res.json({
      users: result,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) {
    next(err);
  }
});

// ═══════════════════════════════════════════════════════
// GET /faculty  — Faculty list for a department
// ═══════════════════════════════════════════════════════
router.get('/faculty', verifyToken, requireRole('COORDINATOR', 'HOD', 'ADMIN'), async (req, res, next) => {
  try {
    const { departmentId } = req.query;
    if (!departmentId) {
      return res.status(400).json({ error: 'departmentId query param is required' });
    }

    const profiles = await prisma.facultyProfile.findMany({
      where: { departmentId },
      include: {
        user: {
          include: { roles: { include: { role: true } } },
        },
      },
      orderBy: { user: { name: 'asc' } },
    });

    const faculty = profiles.map((fp) => ({
      id: fp.user.id,
      name: fp.user.name,
      email: fp.user.email,
      prnNo: fp.prnNo,
      designation: fp.designation,
      roles: fp.user.roles.map((ur) => ur.role.name),
      isApproved: fp.user.isApproved,
    }));

    return res.json(faculty);
  } catch (err) {
    next(err);
  }
});

// ═══════════════════════════════════════════════════════
// GET /students  — Student list for a department
// ═══════════════════════════════════════════════════════
router.get('/students', verifyToken, requireRole('COORDINATOR', 'HOD', 'ADMIN'), async (req, res, next) => {
  try {
    const { departmentId, year } = req.query;
    if (!departmentId) {
      return res.status(400).json({ error: 'departmentId query param is required' });
    }

    const where = { departmentId };
    if (year) where.year = year;

    const profiles = await prisma.studentProfile.findMany({
      where,
      include: {
        user: true,
        department: true,
      },
      orderBy: { user: { name: 'asc' } },
    });

    // Fetch group memberships for these students in one query
    const studentIds = profiles.map((sp) => sp.userId);
    const memberships = await prisma.groupMember.findMany({
      where: { studentId: { in: studentIds } },
      include: {
        group: {
          include: {
            guide: true,
          },
        },
      },
    });
    const memberMap = {};
    for (const gm of memberships) {
      memberMap[gm.studentId] = {
        id: gm.group.id,
        name: gm.group.name,
        guideName: gm.group.guide?.name || null,
      };
    }

    const students = profiles.map((sp) => ({
      id: sp.user.id,
      name: sp.user.name,
      email: sp.user.email,
      prnNo: sp.prnNo,
      enrollmentNo: sp.enrollmentNo,
      year: sp.year,
      division: sp.division,
      group: memberMap[sp.userId] || null,
    }));

    return res.json(students);
  } catch (err) {
    next(err);
  }
});

// ═══════════════════════════════════════════════════════
// PATCH /:id/approve  — Approve or unapprove user (ADMIN)
// ═══════════════════════════════════════════════════════
router.patch('/:id/approve', verifyToken, requireRole('ADMIN'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const isApproved = req.body.isApproved !== false; // default true, set false to unapprove

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    await prisma.user.update({
      where: { id },
      data: { isApproved },
    });

    await prisma.auditLog.create({
      data: {
        userId: req.user.userId,
        action: isApproved ? 'APPROVE_USER' : 'UNAPPROVE_USER',
        entityType: 'User',
        entityId: id,
      },
    });

    return res.json({ message: isApproved ? 'User approved' : 'User unapproved' });
  } catch (err) {
    next(err);
  }
});

// ═══════════════════════════════════════════════════════
// POST /assign-role  — Assign role to faculty (HOD, ADMIN)
// ═══════════════════════════════════════════════════════
router.post('/assign-role', verifyToken, requireRole('HOD', 'ADMIN'), async (req, res, next) => {
  try {
    const { userId, roleName, departmentId, year } = req.body;
    if (!userId || !roleName || !departmentId) {
      return res.status(400).json({ error: 'userId, roleName, and departmentId are required' });
    }

    const requesterRoles = req.user.roles;
    const isAdmin = requesterRoles.includes('ADMIN');

    // HOD restrictions
    if (!isAdmin) {
      const hodAllowed = ['GUIDE', 'COORDINATOR'];
      if (!hodAllowed.includes(roleName) || departmentId !== req.user.departmentId) {
        return res.status(403).json({
          error: 'HOD can only assign GUIDE/COORDINATOR in own department',
        });
      }
    }

    // Target must be faculty
    const faculty = await prisma.facultyProfile.findUnique({ where: { userId } });
    if (!faculty) {
      return res.status(400).json({ error: 'Target user must be a registered faculty member' });
    }

    const role = await prisma.role.upsert({
      where: { name: roleName },
      update: {},
      create: { name: roleName },
    });

    await prisma.userRole.upsert({
      where: {
        userId_roleId_departmentId: { userId, roleId: role.id, departmentId },
      },
      update: { year: year || null },
      create: { userId, roleId: role.id, departmentId, year: year || null },
    });

    await prisma.auditLog.create({
      data: {
        userId: req.user.userId,
        action: 'ASSIGN_ROLE',
        entityType: 'User',
        entityId: userId,
        metadata: { roleName, departmentId, year: year || null },
      },
    });

    return res.json({ message: `${roleName} role assigned successfully` });
  } catch (err) {
    next(err);
  }
});

// ═══════════════════════════════════════════════════════
// DELETE /remove-role  — Remove role from faculty (HOD, ADMIN)
// ═══════════════════════════════════════════════════════
router.delete('/remove-role', verifyToken, requireRole('HOD', 'ADMIN'), async (req, res, next) => {
  try {
    const { userId, roleName, departmentId } = req.body;
    if (!userId || !roleName || !departmentId) {
      return res.status(400).json({ error: 'userId, roleName, and departmentId are required' });
    }

    const requesterRoles = req.user.roles;
    const isAdmin = requesterRoles.includes('ADMIN');

    if (!isAdmin) {
      const hodAllowed = ['GUIDE', 'COORDINATOR'];
      if (!hodAllowed.includes(roleName) || departmentId !== req.user.departmentId) {
        return res.status(403).json({
          error: 'HOD can only remove GUIDE/COORDINATOR in own department',
        });
      }
    }

    const role = await prisma.role.findUnique({ where: { name: roleName } });
    if (!role) {
      return res.status(404).json({ error: 'Role not found' });
    }

    const deleted = await prisma.userRole.deleteMany({
      where: { userId, roleId: role.id, departmentId },
    });

    if (deleted.count === 0) {
      return res.status(404).json({ error: 'User does not have this role in this department' });
    }

    await prisma.auditLog.create({
      data: {
        userId: req.user.userId,
        action: 'REMOVE_ROLE',
        entityType: 'User',
        entityId: userId,
        metadata: { roleName, departmentId },
      },
    });

    return res.json({ message: 'Role removed' });
  } catch (err) {
    next(err);
  }
});

// ═══════════════════════════════════════════════════════
// GET /coordinators  — Coordinators for a department (HOD, ADMIN)
// ═══════════════════════════════════════════════════════
router.get('/coordinators', verifyToken, requireRole('HOD', 'ADMIN'), async (req, res, next) => {
  try {
    const { departmentId } = req.query;
    if (!departmentId) {
      return res.status(400).json({ error: 'departmentId query param is required' });
    }

    const coordRoles = await prisma.userRole.findMany({
      where: { departmentId, role: { name: 'COORDINATOR' } },
      include: {
        user: { include: { facultyProfile: true } },
      },
    });

    const coordinators = coordRoles.map((ur) => ({
      id: ur.user.id,
      name: ur.user.name,
      email: ur.user.email,
      prnNo: ur.user.facultyProfile?.prnNo || null,
      year: ur.year,
      designation: ur.user.facultyProfile?.designation || null,
    }));

    return res.json(coordinators);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
