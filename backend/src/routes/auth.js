const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const prisma = require('../lib/prisma');
const { verifyToken } = require('../middleware/auth');

// ─── Helper: determine redirect path by highest role ────
function getRedirectPath(roles) {
  if (roles.includes('ADMIN')) return '/admin';
  if (roles.includes('HOD')) return '/hod';
  if (roles.includes('COORDINATOR')) return '/coordinator';
  if (roles.includes('GUIDE')) return '/guide';
  return '/student';
}

// ─── Helper: return validation errors ───────────────────
function handleValidation(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({ errors: errors.array() });
  }
  return null;
}

// ═════════════════════════════════════════════════════════
// POST /register  — Student self-registration
// ═════════════════════════════════════════════════════════
router.post(
  '/register',
  [
    body('email').isEmail().withMessage('Valid email is required'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    body('name').notEmpty().withMessage('Name is required'),
    body('prnNo').notEmpty().withMessage('PRN is required'),
    body('enrollmentNo').notEmpty().withMessage('Enrollment number is required'),
    body('departmentId').notEmpty().withMessage('Department is required'),
    body('year').isIn(['FY', 'SY', 'TY', 'FINAL']).withMessage('Year must be FY, SY, TY, or FINAL'),
    body('division').notEmpty().withMessage('Division is required'),
  ],
  async (req, res, next) => {
    try {
      const invalid = handleValidation(req, res);
      if (invalid) return;

      const { email, password, name, phone, prnNo, enrollmentNo, departmentId, year, division } = req.body;

      // Check email uniqueness
      const existingUser = await prisma.user.findUnique({ where: { email } });
      if (existingUser) {
        return res.status(409).json({ error: 'Email already registered' });
      }

      // Check PRN uniqueness
      const existingPrn = await prisma.studentProfile.findUnique({ where: { prnNo } });
      if (existingPrn) {
        return res.status(409).json({ error: 'PRN already registered' });
      }

      const hashedPassword = await bcrypt.hash(password, 10);

      // Find or create STUDENT role
      const role = await prisma.role.upsert({
        where: { name: 'STUDENT' },
        update: {},
        create: { name: 'STUDENT' },
      });

      // Create user, role assignment, and profile in a transaction
      const user = await prisma.$transaction(async (tx) => {
        const newUser = await tx.user.create({
          data: {
            email,
            password: hashedPassword,
            name,
            phone: phone || null,
            isApproved: true,
          },
        });

        await tx.userRole.create({
          data: { userId: newUser.id, roleId: role.id, departmentId },
        });

        await tx.studentProfile.create({
          data: { userId: newUser.id, prnNo, enrollmentNo, departmentId, year, division },
        });

        return newUser;
      });

      return res.status(201).json({
        message: 'Student registered successfully',
        userId: user.id,
        prnNo,
      });
    } catch (err) {
      next(err);
    }
  }
);

// ═════════════════════════════════════════════════════════
// POST /faculty-register  — Faculty self-registration
// ═════════════════════════════════════════════════════════
router.post(
  '/faculty-register',
  [
    body('email').isEmail().withMessage('Valid email is required'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    body('name').notEmpty().withMessage('Name is required'),
    body('prnNo').notEmpty().withMessage('PRN is required'),
    body('departmentId').notEmpty().withMessage('Department is required'),
    body('designation').notEmpty().withMessage('Designation is required'),
  ],
  async (req, res, next) => {
    try {
      const invalid = handleValidation(req, res);
      if (invalid) return;

      const { email, password, name, phone, prnNo, departmentId, designation, employeeId } = req.body;

      const existingUser = await prisma.user.findUnique({ where: { email } });
      if (existingUser) {
        return res.status(409).json({ error: 'Email already registered' });
      }

      const existingPrn = await prisma.facultyProfile.findUnique({ where: { prnNo } });
      if (existingPrn) {
        return res.status(409).json({ error: 'PRN already registered' });
      }

      const hashedPassword = await bcrypt.hash(password, 10);

      await prisma.$transaction(async (tx) => {
        const newUser = await tx.user.create({
          data: {
            email,
            password: hashedPassword,
            name,
            phone: phone || null,
            isApproved: false,
          },
        });

        await tx.facultyProfile.create({
          data: {
            userId: newUser.id,
            prnNo,
            departmentId,
            designation,
            employeeId: employeeId || null,
          },
        });
      });

      return res.status(201).json({
        message: 'Faculty registration submitted. Pending admin approval.',
      });
    } catch (err) {
      next(err);
    }
  }
);

// ═════════════════════════════════════════════════════════
// POST /login  — Works for ALL roles (student & faculty)
// identifier = email OR prnNo
// ═════════════════════════════════════════════════════════
router.post(
  '/login',
  [
    body('identifier').notEmpty().withMessage('Email or PRN is required'),
    body('password').notEmpty().withMessage('Password is required'),
  ],
  async (req, res, next) => {
    try {
      const invalid = handleValidation(req, res);
      if (invalid) return;

      const { identifier, password } = req.body;
      let user = null;

      // 1. Try finding by email
      user = await prisma.user.findUnique({ where: { email: identifier } });

      // 2. If not found, try PRN in StudentProfile
      if (!user) {
        const studentProfile = await prisma.studentProfile.findUnique({
          where: { prnNo: identifier },
          include: { user: true },
        });
        if (studentProfile) user = studentProfile.user;
      }

      // 3. If still not found, try PRN in FacultyProfile
      if (!user) {
        const facultyProfile = await prisma.facultyProfile.findUnique({
          where: { prnNo: identifier },
          include: { user: true },
        });
        if (facultyProfile) user = facultyProfile.user;
      }

      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      if (!user.isApproved) {
        return res.status(403).json({ error: 'Account pending approval' });
      }

      const passwordValid = await bcrypt.compare(password, user.password);
      if (!passwordValid) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      // Fetch full user with roles & profiles
      const fullUser = await prisma.user.findUnique({
        where: { id: user.id },
        include: {
          roles: { include: { role: true, department: true } },
          studentProfile: true,
          facultyProfile: true,
        },
      });

      const roles = fullUser.roles.map((ur) => ur.role.name);
      const prnNo =
        fullUser.studentProfile?.prnNo || fullUser.facultyProfile?.prnNo || null;
      const departmentId =
        fullUser.studentProfile?.departmentId ||
        fullUser.facultyProfile?.departmentId ||
        fullUser.roles.find((ur) => ur.departmentId)?.departmentId ||
        null;

      const token = jwt.sign(
        {
          userId: fullUser.id,
          email: fullUser.email,
          prnNo,
          name: fullUser.name,
          roles,
          departmentId,
        },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
      );

      return res.status(200).json({
        token,
        user: {
          id: fullUser.id,
          email: fullUser.email,
          name: fullUser.name,
          prnNo,
          roles,
          departmentId,
          isApproved: fullUser.isApproved,
        },
        redirectTo: getRedirectPath(roles),
      });
    } catch (err) {
      next(err);
    }
  }
);

// ═════════════════════════════════════════════════════════
// GET /me  — Get current user from token
// ═════════════════════════════════════════════════════════
router.get('/me', verifyToken, async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
      include: {
        roles: { include: { role: true, department: true } },
        studentProfile: true,
        facultyProfile: true,
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const roles = user.roles.map((ur) => ur.role.name);
    const prnNo =
      user.studentProfile?.prnNo || user.facultyProfile?.prnNo || null;

    const { password: _, ...safeUser } = user;

    return res.status(200).json({
      ...safeUser,
      prnNo,
      roles,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
