const router = require('express').Router();
const multer = require('multer');
const XLSX = require('xlsx');
const prisma = require('../lib/prisma');
const { verifyToken } = require('../middleware/auth');
const { requireRole } = require('../middleware/roleGuard');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

// ─── Helper: parse uploaded Excel buffer into rows ─────
function parseExcel(buffer) {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return [];
  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: '' });
  return rows;
}

// ═══════════════════════════════════════════════════════
// POST /ff180  — Bulk update FF180 status by PRN
//   Excel columns: PRN, FF180Status (PENDING|SUBMITTED|APPROVED)
// ═══════════════════════════════════════════════════════
router.post('/ff180', verifyToken, requireRole('GUIDE', 'COORDINATOR', 'HOD', 'ADMIN'), upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const rows = parseExcel(req.file.buffer);
    if (rows.length === 0) return res.status(400).json({ error: 'Excel file is empty' });

    const validStatuses = ['PENDING', 'SUBMITTED', 'APPROVED'];
    const results = { updated: 0, failed: [] };

    for (const row of rows) {
      const prn = String(row.PRN || row.prn || row.PrnNo || row.prnNo || '').trim();
      const status = String(row.FF180Status || row.ff180Status || row.Status || row.status || '').trim().toUpperCase();

      if (!prn) { results.failed.push({ prn: '(empty)', reason: 'Missing PRN' }); continue; }
      if (!validStatuses.includes(status)) { results.failed.push({ prn, reason: `Invalid status: ${status}` }); continue; }

      // Find student by PRN
      const student = await prisma.studentProfile.findUnique({ where: { prnNo: prn }, select: { userId: true } });
      if (!student) { results.failed.push({ prn, reason: 'Student not found' }); continue; }

      // Find their group membership
      const membership = await prisma.groupMember.findFirst({ where: { studentId: student.userId }, select: { groupId: true } });
      if (!membership) { results.failed.push({ prn, reason: 'Not in any group' }); continue; }

      // Find project for that group
      const project = await prisma.project.findUnique({ where: { groupId: membership.groupId } });
      if (!project) { results.failed.push({ prn, reason: 'No project for group' }); continue; }

      await prisma.project.update({ where: { id: project.id }, data: { ff180Status: status } });
      results.updated++;
    }

    return res.json({
      message: `Updated ${results.updated} of ${rows.length} records`,
      ...results,
      total: rows.length,
    });
  } catch (err) {
    next(err);
  }
});

// ═══════════════════════════════════════════════════════
// POST /drive-links  — Bulk update drive links by PRN
//   Excel columns: PRN, DriveLink
// ═══════════════════════════════════════════════════════
router.post('/drive-links', verifyToken, requireRole('GUIDE', 'COORDINATOR', 'HOD', 'ADMIN'), upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const rows = parseExcel(req.file.buffer);
    if (rows.length === 0) return res.status(400).json({ error: 'Excel file is empty' });

    const results = { updated: 0, failed: [] };

    for (const row of rows) {
      const prn = String(row.PRN || row.prn || row.PrnNo || row.prnNo || '').trim();
      const driveLink = String(row.DriveLink || row.driveLink || row.Drive || row.drive || '').trim();

      if (!prn) { results.failed.push({ prn: '(empty)', reason: 'Missing PRN' }); continue; }
      if (!driveLink) { results.failed.push({ prn, reason: 'Missing DriveLink' }); continue; }

      const student = await prisma.studentProfile.findUnique({ where: { prnNo: prn }, select: { userId: true } });
      if (!student) { results.failed.push({ prn, reason: 'Student not found' }); continue; }

      const membership = await prisma.groupMember.findFirst({ where: { studentId: student.userId }, select: { groupId: true } });
      if (!membership) { results.failed.push({ prn, reason: 'Not in any group' }); continue; }

      const project = await prisma.project.findUnique({ where: { groupId: membership.groupId } });
      if (!project) { results.failed.push({ prn, reason: 'No project for group' }); continue; }

      await prisma.project.update({ where: { id: project.id }, data: { driveLink } });
      results.updated++;
    }

    return res.json({
      message: `Updated ${results.updated} of ${rows.length} records`,
      ...results,
      total: rows.length,
    });
  } catch (err) {
    next(err);
  }
});

// ═══════════════════════════════════════════════════════
// POST /project-links  — Bulk update any project link by PRN
//   Excel columns: PRN, githubLink?, videoLink?, driveLink?,
//                  researchPaperLink?, patentLink?
// ═══════════════════════════════════════════════════════
router.post('/project-links', verifyToken, requireRole('GUIDE', 'COORDINATOR', 'HOD', 'ADMIN'), upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const rows = parseExcel(req.file.buffer);
    if (rows.length === 0) return res.status(400).json({ error: 'Excel file is empty' });

    const linkFields = ['githubLink', 'videoLink', 'driveLink', 'researchPaperLink', 'patentLink'];
    const results = { updated: 0, failed: [] };

    for (const row of rows) {
      const prn = String(row.PRN || row.prn || row.PrnNo || row.prnNo || '').trim();
      if (!prn) { results.failed.push({ prn: '(empty)', reason: 'Missing PRN' }); continue; }

      const data = {};
      for (const field of linkFields) {
        const val = row[field] || row[field.toLowerCase()] || '';
        if (String(val).trim()) data[field] = String(val).trim();
      }
      if (Object.keys(data).length === 0) { results.failed.push({ prn, reason: 'No link fields found' }); continue; }

      const student = await prisma.studentProfile.findUnique({ where: { prnNo: prn }, select: { userId: true } });
      if (!student) { results.failed.push({ prn, reason: 'Student not found' }); continue; }

      const membership = await prisma.groupMember.findFirst({ where: { studentId: student.userId }, select: { groupId: true } });
      if (!membership) { results.failed.push({ prn, reason: 'Not in any group' }); continue; }

      const project = await prisma.project.findUnique({ where: { groupId: membership.groupId } });
      if (!project) { results.failed.push({ prn, reason: 'No project for group' }); continue; }

      await prisma.project.update({ where: { id: project.id }, data });
      results.updated++;
    }

    return res.json({
      message: `Updated ${results.updated} of ${rows.length} records`,
      ...results,
      total: rows.length,
    });
  } catch (err) {
    next(err);
  }
});

// ═══════════════════════════════════════════════════════
// POST /groups  — Bulk create groups from Excel
//   Excel columns: GroupName, Year, Division, GuidePRN (or GuideEmail), ProjectTitle, PRN1, PRN2, PRN3, PRN4 (optional), PRN5 (optional)
// ═══════════════════════════════════════════════════════
router.post('/groups', verifyToken, requireRole('COORDINATOR', 'HOD', 'ADMIN'), upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const rows = parseExcel(req.file.buffer);
    if (rows.length === 0) return res.status(400).json({ error: 'Excel file is empty' });

    // Get coordinator's department
    const coordRole = await prisma.userRole.findFirst({
      where: { userId: req.user.userId, role: { name: { in: ['COORDINATOR', 'HOD', 'ADMIN'] } } },
      include: { role: true },
    });
    const departmentId = coordRole?.departmentId;
    if (!departmentId && !req.user.roles.includes('ADMIN')) {
      return res.status(400).json({ error: 'Could not determine your department' });
    }

    const results = { created: 0, failed: [] };
    const academicYear = req.body.academicYear || '2025-26';
    const semester = parseInt(req.body.semester || '8', 10);

    for (const row of rows) {
      const groupName = String(row.GroupName || row.groupName || row.Name || row.name || '').trim();
      const year = String(row.Year || row.year || '').trim().toUpperCase();
      const division = String(row.Division || row.division || row.Div || row.div || '').trim().toUpperCase();
      const guidePrn = String(row.GuidePRN || row.guidePRN || row.GuideEmail || row.guideEmail || '').trim();
      const projectTitle = String(row.ProjectTitle || row.projectTitle || row.Title || row.title || '').trim();

      if (!groupName) { results.failed.push({ group: '(empty)', reason: 'Missing GroupName' }); continue; }
      if (!year || !['FY', 'SY', 'TY', 'FINAL'].includes(year)) {
        results.failed.push({ group: groupName, reason: `Invalid Year: ${year}. Use FY/SY/TY/FINAL` }); continue;
      }
      if (!division) { results.failed.push({ group: groupName, reason: 'Missing Division' }); continue; }

      // Collect student PRNs from columns
      const prnKeys = ['PRN1', 'prn1', 'PRN2', 'prn2', 'PRN3', 'prn3', 'PRN4', 'prn4', 'PRN5', 'prn5'];
      const studentPrns = [];
      for (let i = 1; i <= 5; i++) {
        const val = String(row[`PRN${i}`] || row[`prn${i}`] || '').trim();
        if (val) studentPrns.push(val);
      }
      if (studentPrns.length < 3) {
        results.failed.push({ group: groupName, reason: `Need at least 3 students, found ${studentPrns.length}` }); continue;
      }

      try {
        // Find guide by PRN or email
        let guideId = null;
        if (guidePrn) {
          const guide = guidePrn.includes('@')
            ? await prisma.user.findUnique({ where: { email: guidePrn }, select: { id: true } })
            : await prisma.facultyProfile.findUnique({ where: { prnNo: guidePrn }, select: { userId: true } });
          guideId = guide?.id || guide?.userId || null;
          if (!guideId) { results.failed.push({ group: groupName, reason: `Guide not found: ${guidePrn}` }); continue; }
        }

        // Find students by PRN
        const studentProfiles = await prisma.studentProfile.findMany({
          where: { prnNo: { in: studentPrns }, departmentId: departmentId },
        });
        if (studentProfiles.length < 3) {
          const foundPrns = studentProfiles.map(s => s.prnNo);
          const missing = studentPrns.filter(p => !foundPrns.includes(p));
          results.failed.push({ group: groupName, reason: `Students not found in dept: ${missing.join(', ')}` }); continue;
        }
        const studentIds = studentProfiles.map(s => s.userId);

        // Check students aren't already in a group
        const existing = await prisma.groupMember.findMany({
          where: { studentId: { in: studentIds }, group: { academicYear, departmentId } },
          include: { student: { select: { name: true } }, group: { select: { name: true } } },
        });
        if (existing.length > 0) {
          const conflictNames = existing.map(e => `${e.student.name} (${e.group.name})`).join(', ');
          results.failed.push({ group: groupName, reason: `Students already in groups: ${conflictNames}` }); continue;
        }

        // Create group + members + optional project in transaction
        await prisma.$transaction(async (tx) => {
          const newGroup = await tx.group.create({
            data: {
              name: groupName,
              departmentId,
              year,
              division,
              guideId,
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

          // Create project if title provided
          if (projectTitle) {
            await tx.project.create({
              data: {
                groupId: newGroup.id,
                title: projectTitle,
                status: 'DRAFT',
              },
            });
          }

          await tx.auditLog.create({
            data: {
              userId: req.user.userId,
              action: 'BULK_CREATE_GROUP',
              entityType: 'Group',
              entityId: newGroup.id,
              metadata: { studentCount: studentIds.length, groupName },
            },
          });
        });

        results.created++;
      } catch (err) {
        results.failed.push({ group: groupName, reason: err.message || 'Database error' });
      }
    }

    return res.json({
      message: `Created ${results.created} of ${rows.length} groups`,
      ...results,
      total: rows.length,
    });
  } catch (err) {
    next(err);
  }
});

// ═══════════════════════════════════════════════════════
// GET /template/:type  — Download Excel template
// ═══════════════════════════════════════════════════════
router.get('/template/:type', verifyToken, requireRole('GUIDE', 'COORDINATOR', 'HOD', 'ADMIN'), (req, res) => {
  const { type } = req.params;

  let headers;
  let sampleRow;
  switch (type) {
    case 'ff180':
      headers = ['PRN', 'FF180Status'];
      sampleRow = ['F20220001', 'SUBMITTED'];
      break;
    case 'drive-links':
      headers = ['PRN', 'DriveLink'];
      sampleRow = ['F20220001', 'https://drive.google.com/...'];
      break;
    case 'project-links':
      headers = ['PRN', 'githubLink', 'videoLink', 'driveLink', 'researchPaperLink', 'patentLink'];
      sampleRow = ['F20220001', 'https://github.com/...', '', 'https://drive.google.com/...', '', ''];
      break;
    case 'groups':
      headers = ['GroupName', 'Year', 'Division', 'GuidePRN', 'ProjectTitle', 'PRN1', 'PRN2', 'PRN3', 'PRN4', 'PRN5'];
      sampleRow = ['CSE-TY-A-G1', 'TY', 'A', 'F20200001', 'Smart Attendance System', 'S20220001', 'S20220002', 'S20220003', '', ''];
      break;
    default:
      return res.status(400).json({ error: 'Invalid template type. Use: ff180, drive-links, project-links, groups' });
  }

  const ws = XLSX.utils.aoa_to_sheet([headers, sampleRow]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Template');
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

  res.setHeader('Content-Disposition', `attachment; filename=template-${type}.xlsx`);
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.send(Buffer.from(buf));
});

module.exports = router;
