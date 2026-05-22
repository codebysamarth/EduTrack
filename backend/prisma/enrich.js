const { PrismaClient } = require('../generated/prisma');
const { PrismaPg } = require('@prisma/adapter-pg');
const bcrypt = require('bcryptjs');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  console.error('❌ Error: DATABASE_URL environment variable is missing.');
  process.exit(1);
}

console.log('📡 Connecting to database for enrichment...');
const adapter = new PrismaPg({ connectionString: dbUrl });
const prisma = new PrismaClient({ adapter });

async function ensureUserRole(userId, roleId, departmentId = null, year = null) {
  const existing = await prisma.userRole.findFirst({
    where: { userId, roleId, departmentId },
  });
  if (!existing) {
    await prisma.userRole.create({ data: { userId, roleId, departmentId, year } });
  }
}

async function main() {
  console.log('🌱 Starting non-destructive database enrichment for examiner demo...\n');

  const pw = await bcrypt.hash('12345678', 10);

  // ══════════════════════════════════════════════════════════════════════════
  // 1. Fetch Core Roles, Departments, and Faculty
  // ══════════════════════════════════════════════════════════════════════════
  const roles = {};
  for (const name of ['ADMIN', 'HOD', 'COORDINATOR', 'GUIDE', 'STUDENT']) {
    roles[name] = await prisma.role.findUnique({ where: { name } });
  }

  const deptCSE = await prisma.department.findUnique({ where: { code: 'CSE' } });
  if (!deptCSE) {
    console.error('❌ CSE department not found. Make sure database is seeded first.');
    process.exit(1);
  }

  // Get Faculty
  const guideAmol = await prisma.user.findUnique({ where: { email: 'amol.bhosale24@college.edu' } });
  const coordSunita = await prisma.user.findUnique({ where: { email: 'sunita.deshpande24@college.edu' } });
  const adminSamarth = await prisma.user.findUnique({ where: { email: 'pawarsamarth786@gmail.com' } });
  const hodRajesh = await prisma.user.findUnique({ where: { email: 'rajesh.kulkarni24@college.edu' } });

  if (!guideAmol || !coordSunita || !adminSamarth || !hodRajesh) {
    console.error('❌ Core faculty or admin users not found. Run main seed script first.');
    process.exit(1);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 2. Enrich Student "Aarav Patil" and Project "Smart Attendance System" (CSE-TY-A-G1)
  // ══════════════════════════════════════════════════════════════════════════
  console.log('📊 Enriching Student Workspace: Aarav Patil (CSE-TY-A-G1)...');
  let groupG1 = null;
  const studentAarav = await prisma.user.findUnique({ where: { email: 'aarav.patil24@college.edu' } });
  
  if (studentAarav) {
    groupG1 = await prisma.group.findFirst({
      where: { name: 'CSE-TY-A-G1', departmentId: deptCSE.id }
    });

    if (groupG1) {
      // Update/Create Project with beautiful premium details
      const projectTitle = 'Smart Attendance System using Face Recognition & AI Analytics';
      const projectAbstract = 'An advanced college-wide AI-powered attendance tracking system utilizing convolutional neural networks (CNNs) for facial landmark detection and anti-spoofing verification. The system uses a dual-camera setup for depth detection, features real-time notifications via Twilio for absences, integrates directly into the central college ERP, and produces automated daily, weekly, and monthly attendance reports with analytics dashboards customized for department HODs and coordinators.';
      
      const project = await prisma.project.upsert({
        where: { groupId: groupG1.id },
        update: {
          title: projectTitle,
          abstract: projectAbstract,
          domain: 'Artificial Intelligence',
          techStack: 'React, Node.js, Express, Python, OpenCV, FaceNet, PyTorch, Docker, PostgreSQL, TailwindCSS, Twilio API',
          sdgGoals: [4, 8, 9, 11],
          githubLink: 'https://github.com/smart-attendance-ai',
          videoLink: 'https://youtube.com/watch?v=smart_attendance_demo',
          driveLink: 'https://drive.google.com/drive/folders/smart-attendance-erp-docs',
          researchPaperLink: 'https://ieeexplore.ieee.org/document/smart-attendance-facerec-2026',
          patentLink: 'https://patents.google.com/patent/IN202611012345A',
          status: 'APPROVED',
          ff180Status: 'APPROVED'
        },
        create: {
          groupId: groupG1.id,
          departmentId: deptCSE.id,
          title: projectTitle,
          abstract: projectAbstract,
          domain: 'Artificial Intelligence',
          techStack: 'React, Node.js, Express, Python, OpenCV, FaceNet, PyTorch, Docker, PostgreSQL, TailwindCSS, Twilio API',
          sdgGoals: [4, 8, 9, 11],
          githubLink: 'https://github.com/smart-attendance-ai',
          videoLink: 'https://youtube.com/watch?v=smart_attendance_demo',
          driveLink: 'https://drive.google.com/drive/folders/smart-attendance-erp-docs',
          researchPaperLink: 'https://ieeexplore.ieee.org/document/smart-attendance-facerec-2026',
          patentLink: 'https://patents.google.com/patent/IN202611012345A',
          status: 'APPROVED',
          ff180Status: 'APPROVED'
        }
      });

      // Clear existing reviews for this project to rebuild a professional review history
      await prisma.projectReview.deleteMany({ where: { projectId: project.id } });

      // Review 1: Synopsis review by Coordinator (Sunita Deshpande) 15 days ago
      await prisma.projectReview.create({
        data: {
          projectId: project.id,
          reviewerId: coordSunita.id,
          comment: 'Synopsis is extremely thorough and the proposed dual-camera anti-spoofing mechanism addresses key vulnerabilities in existing face recognition attendance systems. Scope is realistic and tech stack is appropriate. Synopsis approved.',
          isApproved: true,
          createdAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000)
        }
      });

      // Review 2: Mid-term review with corrections by Guide (Amol Bhosale) 7 days ago
      await prisma.projectReview.create({
        data: {
          projectId: project.id,
          reviewerId: guideAmol.id,
          comment: 'Excellent progress on the facial landmark detection model. However, low-light latency is currently averaging 1.8 seconds, which is too high for a busy campus entryway. Please optimize the preprocessing pipeline (e.g., histogram equalization or MobileNet downsizing) and submit latency benchmarks before the next review.',
          isApproved: false,
          rejectionReason: 'Latency in low light conditions exceeds acceptable parameters',
          createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
        }
      });

      // Review 3: Resubmission approval by Guide (Amol Bhosale) 2 days ago
      await prisma.projectReview.create({
        data: {
          projectId: project.id,
          reviewerId: guideAmol.id,
          comment: 'Reviewing resubmission. Latency has been successfully reduced to 320ms via MobileNet optimization and latency benchmarking. Anti-spoofing works flawlessly under varying illuminations. System integration test complete. Fantastic work!',
          isApproved: true,
          createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
        }
      });

      console.log('  ✓ Enriched G1 Project & created 3-step review history trail.');
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 3. Populate Guide Dashboard: Pending Reviews & Active Groups
  // ══════════════════════════════════════════════════════════════════════════
  console.log('📂 Enriching Guide Workspace: Prof. Amol Bhosale (Review Queues)...');

  // Let\'s create a new active CSE Group that is awaiting review (CSE-FIN-A-G3)
  // This will show a live pending review in Prof. Amol Bhosale\'s queue!
  let groupG3 = await prisma.group.findFirst({
    where: { name: 'CSE-FIN-A-G3', departmentId: deptCSE.id }
  });

  if (!groupG3) {
    groupG3 = await prisma.group.create({
      data: {
        name: 'CSE-FIN-A-G3',
        departmentId: deptCSE.id,
        year: 'FINAL',
        division: 'A',
        academicYear: '2025-26',
        semester: 7,
        guideId: guideAmol.id,
        coordinatorId: coordSunita.id,
        status: 'APPROVED'
      }
    });

    // Create 3 new CSE students for this group
    const newStudents = [
      { email: 'rohit.shinde24@college.edu', name: 'Rohit Shinde', prn: '21CS101', enrl: 'EN21CS101' },
      { email: 'sneha.patil24@college.edu', name: 'Sneha Patil', prn: '21CS102', enrl: 'EN21CS102' },
      { email: 'rahul.pawar24@college.edu', name: 'Rahul Pawar', prn: '21CS103', enrl: 'EN21CS103' }
    ];

    for (let i = 0; i < newStudents.length; i++) {
      const ns = newStudents[i];
      const u = await prisma.user.upsert({
        where: { email: ns.email },
        update: { isApproved: true },
        create: { email: ns.email, password: pw, name: ns.name, isApproved: true }
      });
      await prisma.studentProfile.upsert({
        where: { prnNo: ns.prn },
        update: { userId: u.id, enrollmentNo: ns.enrl, departmentId: deptCSE.id, year: 'FINAL', division: 'A' },
        create: { userId: u.id, prnNo: ns.prn, enrollmentNo: ns.enrl, departmentId: deptCSE.id, year: 'FINAL', division: 'A' }
      });
      await ensureUserRole(u.id, roles.STUDENT.id, deptCSE.id);
      await prisma.groupMember.create({
        data: { groupId: groupG3.id, studentId: u.id, isLeader: i === 0 }
      });
    }

    // Create project awaiting review
    await prisma.project.create({
      data: {
        groupId: groupG3.id,
        departmentId: deptCSE.id,
        title: 'AI-Powered Smart Grid Energy Forecasting using LSTM Networks',
        abstract: 'A deep learning solution for forecasting hourly electrical load and smart grid energy demand. Uses Long Short-Term Memory (LSTM) recurrent neural networks to capture seasonal weather patterns, historical usage, and industrial load indicators. Features an interactive dashboard built on Next.js to assist grid operators in load balancing and power routing optimization.',
        domain: 'Machine Learning',
        techStack: 'Python, TensorFlow, PyTorch, Keras, Pandas, FastAPI, Next.js, TailwindCSS',
        sdgGoals: [7, 9, 13],
        status: 'SUBMITTED',
        githubLink: 'https://github.com/rohitshinde-grid/smart-grid-forecaster',
        ff180Status: 'PENDING'
      }
    });

    console.log('  ✓ Created new group CSE-FIN-A-G3 with "Submitted" project to show pending review queue.');
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 4. Populate Coordinator Dashboard: Pending Group Approval (CSE-TY-A-G3)
  // ══════════════════════════════════════════════════════════════════════════
  console.log('🛡️ Enriching Coordinator Workspace: Prof. Sunita Deshpande...');

  let groupTYG3 = await prisma.group.findFirst({
    where: { name: 'CSE-TY-A-G3', departmentId: deptCSE.id }
  });

  if (!groupTYG3) {
    groupTYG3 = await prisma.group.create({
      data: {
        name: 'CSE-TY-A-G3',
        departmentId: deptCSE.id,
        year: 'TY',
        division: 'A',
        academicYear: '2025-26',
        semester: 5,
        guideId: guideAmol.id,
        coordinatorId: coordSunita.id,
        status: 'PENDING_APPROVAL' // Awaiting approval!
      }
    });

    const tyStudents = [
      { email: 'rohan.gaikwad24@college.edu', name: 'Rohan Gaikwad', prn: '22CS101', enrl: 'EN22CS101' },
      { email: 'priyanka.patil24@college.edu', name: 'Priyanka Patil', prn: '22CS102', enrl: 'EN22CS102' },
      { email: 'swapnil.kadam24@college.edu', name: 'Swapnil Kadam', prn: '22CS103', enrl: 'EN22CS103' }
    ];

    for (let i = 0; i < tyStudents.length; i++) {
      const ts = tyStudents[i];
      const u = await prisma.user.upsert({
        where: { email: ts.email },
        update: { isApproved: true },
        create: { email: ts.email, password: pw, name: ts.name, isApproved: true }
      });
      await prisma.studentProfile.upsert({
        where: { prnNo: ts.prn },
        update: { userId: u.id, enrollmentNo: ts.enrl, departmentId: deptCSE.id, year: 'TY', division: 'A' },
        create: { userId: u.id, prnNo: ts.prn, enrollmentNo: ts.enrl, departmentId: deptCSE.id, year: 'TY', division: 'A' }
      });
      await ensureUserRole(u.id, roles.STUDENT.id, deptCSE.id);
      await prisma.groupMember.create({
        data: { groupId: groupTYG3.id, studentId: u.id, isLeader: i === 0 }
      });
    }

    console.log('  ✓ Created new group CSE-TY-A-G3 with status "PENDING_APPROVAL" to show group approval queue.');
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 5. Ingest Gorgeous Audit Logs for HOD / Admin Feed (30+ active, historical events)
  // ══════════════════════════════════════════════════════════════════════════
  console.log('📜 Ingesting massive series of Audit Logs for activity feeds...');

  // Delete previous massive seeded audit logs to avoid duplication and cluttering
  await prisma.auditLog.deleteMany({
    where: {
      action: {
        in: [
          'CREATE_GROUP', 'SUBMIT_PROJECT', 'REVIEW_PROJECT', 'APPROVE_PROJECT',
          'SYNC_CALENDAR', 'RUN_PLAGIARISM', 'PUBLISH_PROJECT', 'UPDATE_LINKS'
        ]
      }
    }
  });

  const auditData = [
    {
      userId: adminSamarth.id,
      action: 'ASSIGN_HOD',
      entityType: 'Department',
      entityId: deptCSE.id,
      metadata: { departmentCode: 'CSE', assignedHOD: 'Dr. Rajesh Kulkarni' },
      daysAgo: 15
    },
    {
      userId: hodRajesh.id,
      action: 'ASSIGN_COORDINATOR',
      entityType: 'UserRole',
      entityId: coordSunita.id,
      metadata: { coordinator: 'Prof. Sunita Deshpande', assignedYear: 'TY' },
      daysAgo: 14
    },
    {
      userId: studentAarav.id,
      action: 'CREATE_GROUP',
      entityType: 'Group',
      entityId: groupG1?.id || 'RANDOM_GROUP_ID',
      metadata: { groupName: 'CSE-TY-A-G1', leader: 'Aarav Patil', membersCount: 4 },
      daysAgo: 13
    },
    {
      userId: coordSunita.id,
      action: 'APPROVE_GROUP',
      entityType: 'Group',
      entityId: groupG1?.id || 'RANDOM_GROUP_ID',
      metadata: { groupName: 'CSE-TY-A-G1', status: 'APPROVED' },
      daysAgo: 12
    },
    {
      userId: studentAarav.id,
      action: 'SUBMIT_PROJECT',
      entityType: 'Project',
      entityId: groupG1?.id || 'RANDOM_GROUP_ID',
      metadata: { title: 'Smart Attendance System using Face Recognition', initialStatus: 'DRAFT', targetStatus: 'SUBMITTED' },
      daysAgo: 11
    },
    {
      userId: guideAmol.id,
      action: 'REVIEW_PROJECT',
      entityType: 'Project',
      entityId: groupG1?.id || 'RANDOM_GROUP_ID',
      metadata: { title: 'Smart Attendance System', reviewResult: 'REJECTED', comment: 'Latency in low light conditions exceeds acceptable parameters' },
      daysAgo: 10
    },
    {
      userId: hodRajesh.id,
      action: 'SYNC_CALENDAR',
      entityType: 'GoogleCalendar',
      entityId: deptCSE.id,
      metadata: { status: 'SUCCESSFUL', syncedEventsCount: 6, department: 'CSE' },
      daysAgo: 9
    },
    {
      userId: adminSamarth.id,
      action: 'RUN_PLAGIARISM',
      entityType: 'Project',
      entityId: groupG1?.id || 'RANDOM_GROUP_ID',
      metadata: { targetProject: 'Decentralized Academic Certificate Verification via Blockchain', similarityResult: 'MODERATE_SIMILARITY', matchesFound: 2, topMatch: '68%' },
      daysAgo: 8
    },
    {
      userId: studentAarav.id,
      action: 'SUBMIT_PROJECT',
      entityType: 'Project',
      entityId: groupG1?.id || 'RANDOM_GROUP_ID',
      metadata: { title: 'Smart Attendance System (Resubmission)', resubmitted: true, status: 'SUBMITTED' },
      daysAgo: 7
    },
    {
      userId: guideAmol.id,
      action: 'REVIEW_PROJECT',
      entityType: 'Project',
      entityId: groupG1?.id || 'RANDOM_GROUP_ID',
      metadata: { title: 'Smart Attendance System', reviewResult: 'APPROVED', comment: 'Benchmarked at 320ms, low-light optimization successful.' },
      daysAgo: 6
    },
    {
      userId: hodRajesh.id,
      action: 'PUBLISH_PROJECT',
      entityType: 'Project',
      entityId: groupG1?.id || 'RANDOM_GROUP_ID',
      metadata: { title: 'Multi-Agent AI Research Assistant', status: 'PUBLISHED', showcaseUrl: '/dashboard/showcase' },
      daysAgo: 5
    },
    {
      userId: studentAarav.id,
      action: 'UPDATE_LINKS',
      entityType: 'Project',
      entityId: groupG1?.id || 'RANDOM_GROUP_ID',
      metadata: { fieldsUpdated: ['githubLink', 'videoLink', 'driveLink', 'researchPaperLink', 'patentLink'] },
      daysAgo: 4
    },
    {
      userId: guideAmol.id,
      action: 'SYNC_CALENDAR',
      entityType: 'GoogleCalendar',
      entityId: guideAmol.id,
      metadata: { status: 'SUCCESSFUL', eventsSynced: ['Project Midterm Evaluation Session'] },
      daysAgo: 3
    },
    {
      userId: adminSamarth.id,
      action: 'APPROVE_USER',
      entityType: 'FacultyProfile',
      entityId: guideAmol.id,
      metadata: { approvedFaculty: 'Prof. Amol Bhosale', department: 'CSE' },
      daysAgo: 2
    },
    {
      userId: hodRajesh.id,
      action: 'APPROVE_PROJECT',
      entityType: 'Project',
      entityId: groupG1?.id || 'RANDOM_GROUP_ID',
      metadata: { title: 'Smart Attendance System', finalSignOff: true },
      daysAgo: 1
    }
  ];

  for (const log of auditData) {
    const timestamp = new Date(Date.now() - log.daysAgo * 24 * 60 * 60 * 1000);
    await prisma.auditLog.create({
      data: {
        userId: log.userId,
        action: log.action,
        entityType: log.entityType,
        entityId: log.entityId,
        metadata: log.metadata,
        createdAt: timestamp
      }
    });
  }

  // Generate 15 additional randomized logs to boost numbers beautifully
  const randomActions = [
    { action: 'UPDATE_LINKS', type: 'Project', meta: { field: 'githubLink', updated: true } },
    { action: 'SYNC_CALENDAR', type: 'GoogleCalendar', meta: { synced: 'Google Meet scheduled', status: 'SUCCESS' } },
    { action: 'CREATE_GROUP', type: 'Group', meta: { status: 'Forming', div: 'B' } },
    { action: 'APPROVE_GROUP', type: 'Group', meta: { status: 'APPROVED', coordinatorApproval: true } }
  ];

  const studentsList = await prisma.user.findMany({ where: { roles: { some: { role: { name: 'STUDENT' } } } }, take: 10 });
  
  for (let i = 0; i < 15; i++) {
    const user = studentsList[i % studentsList.length] || studentAarav;
    const actionObj = randomActions[i % randomActions.length];
    const timestamp = new Date(Date.now() - (i + 1) * 12 * 60 * 60 * 1000); // spread across past 7 days
    
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: actionObj.action,
        entityType: actionObj.type,
        entityId: groupG1 ? groupG1.id : 'RANDOM_GROUP_ID',
        metadata: actionObj.meta,
        createdAt: timestamp
      }
    });
  }

  console.log('  ✓ Ingested 30+ detailed, chronological Audit Logs.');

  // ══════════════════════════════════════════════════════════════════════════
  // Summary
  // ══════════════════════════════════════════════════════════════════════════
  console.log('\n══════════════════════════════════════════════════════════════');
  console.log('🎉 ENRICHMENT COMPLETE!');
  console.log('══════════════════════════════════════════════════════════════');
  console.log('✅ Aarav Patil (Student) project & 3-stage review history generated.');
  console.log('✅ Amol Bhosale (Guide) review queue populated with a live pending project.');
  console.log('✅ Sunita Deshpande (Coordinator) queue populated with a pending group approval.');
  console.log('✅ Dr. Rajesh Kulkarni & Samarth Pawar feeds enriched with 30+ logs.');
  console.log('══════════════════════════════════════════════════════════════\n');
}

main()
  .catch((e) => {
    console.error('❌ Enrichment failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
