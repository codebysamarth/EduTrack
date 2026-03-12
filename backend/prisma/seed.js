const { PrismaClient } = require('../generated/prisma');
const { PrismaPg } = require('@prisma/adapter-pg');
const bcrypt = require('bcryptjs');

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
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
  console.log('🌱 Seeding database with comprehensive Indian data...\n');

  const pw = await bcrypt.hash('12345678', 10);

  // ═══ Roles ═══════════════════════════════════════════════════════════════
  const roles = {};
  for (const name of ['ADMIN', 'HOD', 'COORDINATOR', 'GUIDE', 'STUDENT']) {
    roles[name] = await prisma.role.upsert({ where: { name }, update: {}, create: { name } });
  }
  console.log('✅ Roles ready');

  // ═══ Admin ═══════════════════════════════════════════════════════════════
  const admin = await prisma.user.upsert({
    where: { email: 'pawarsamarth786@gmail.com' },
    update: {},
    create: { email: 'pawarsamarth786@gmail.com', password: pw, name: 'Samarth Pawar', isApproved: true },
  });
  await ensureUserRole(admin.id, roles.ADMIN.id);
  console.log('✅ Admin: pawarsamarth786@gmail.com');

  // ═══ Departments ═════════════════════════════════════════════════════════
  const dept = {};
  for (const d of [
    { name: 'Computer Science & Engineering', code: 'CSE' },
    { name: 'Information Technology', code: 'IT' },
    { name: 'Mechanical Engineering', code: 'ME' },
    { name: 'Electronics & Telecommunication', code: 'ENTC' },
  ]) {
    dept[d.code] = await prisma.department.upsert({ where: { code: d.code }, update: {}, create: d });
  }
  console.log('✅ Departments:', Object.keys(dept).join(', '));

  // ═══ Faculty ═════════════════════════════════════════════════════════════
  const fac = {};
  const facultyData = [
    // CSE — 6 faculty
    { email: 'rajesh.kulkarni24@college.edu',   name: 'Dr. Rajesh Kulkarni',    prnNo: 'FAC001', empId: 'EMP001', dept: 'CSE', designation: 'Professor & HOD',       role: 'HOD',         year: null  },
    { email: 'sunita.deshpande24@college.edu',  name: 'Prof. Sunita Deshpande', prnNo: 'FAC002', empId: 'EMP002', dept: 'CSE', designation: 'Associate Professor',   role: 'COORDINATOR', year: 'TY'  },
    { email: 'mangesh.patil24@college.edu',     name: 'Prof. Mangesh Patil',    prnNo: 'FAC003', empId: 'EMP003', dept: 'CSE', designation: 'Associate Professor',   role: 'COORDINATOR', year: 'FINAL' },
    { email: 'sneha.joshi24@college.edu',       name: 'Prof. Sneha Joshi',      prnNo: 'FAC004', empId: 'EMP004', dept: 'CSE', designation: 'Assistant Professor',   role: 'GUIDE',       year: null  },
    { email: 'amol.bhosale24@college.edu',      name: 'Prof. Amol Bhosale',     prnNo: 'FAC005', empId: 'EMP005', dept: 'CSE', designation: 'Assistant Professor',   role: 'GUIDE',       year: null  },
    { email: 'vaishali.more24@college.edu',     name: 'Prof. Vaishali More',    prnNo: 'FAC006', empId: 'EMP006', dept: 'CSE', designation: 'Assistant Professor',   role: 'GUIDE',       year: null  },
    // IT — 5 faculty
    { email: 'pramod.sharma24@college.edu',     name: 'Dr. Pramod Sharma',      prnNo: 'FAC007', empId: 'EMP007', dept: 'IT',  designation: 'Professor & HOD',       role: 'HOD',         year: null  },
    { email: 'kavita.jadhav24@college.edu',     name: 'Prof. Kavita Jadhav',    prnNo: 'FAC008', empId: 'EMP008', dept: 'IT',  designation: 'Associate Professor',   role: 'COORDINATOR', year: 'SY'  },
    { email: 'nitin.wagh24@college.edu',        name: 'Prof. Nitin Wagh',       prnNo: 'FAC009', empId: 'EMP009', dept: 'IT',  designation: 'Associate Professor',   role: 'GUIDE',       year: null  },
    { email: 'rashmi.gokhale24@college.edu',    name: 'Prof. Rashmi Gokhale',   prnNo: 'FAC010', empId: 'EMP010', dept: 'IT',  designation: 'Assistant Professor',   role: 'GUIDE',       year: null  },
    { email: 'sudhir.kadam24@college.edu',      name: 'Prof. Sudhir Kadam',     prnNo: 'FAC011', empId: 'EMP011', dept: 'IT',  designation: 'Assistant Professor',   role: 'GUIDE',       year: null  },
    // ME — 5 faculty
    { email: 'vinayak.sawant24@college.edu',    name: 'Dr. Vinayak Sawant',     prnNo: 'FAC012', empId: 'EMP012', dept: 'ME',  designation: 'Professor & HOD',       role: 'HOD',         year: null  },
    { email: 'prachi.naik24@college.edu',       name: 'Prof. Prachi Naik',      prnNo: 'FAC013', empId: 'EMP013', dept: 'ME',  designation: 'Associate Professor',   role: 'COORDINATOR', year: 'FINAL' },
    { email: 'hemant.gaikwad24@college.edu',    name: 'Prof. Hemant Gaikwad',   prnNo: 'FAC014', empId: 'EMP014', dept: 'ME',  designation: 'Associate Professor',   role: 'GUIDE',       year: null  },
    { email: 'swati.londhe24@college.edu',      name: 'Prof. Swati Londhe',     prnNo: 'FAC015', empId: 'EMP015', dept: 'ME',  designation: 'Assistant Professor',   role: 'GUIDE',       year: null  },
    // ENTC — 5 faculty
    { email: 'anil.mhatre24@college.edu',       name: 'Dr. Anil Mhatre',        prnNo: 'FAC016', empId: 'EMP016', dept: 'ENTC', designation: 'Professor & HOD',      role: 'HOD',         year: null  },
    { email: 'deepali.chaudhari24@college.edu', name: 'Prof. Deepali Chaudhari',prnNo: 'FAC017', empId: 'EMP017', dept: 'ENTC', designation: 'Associate Professor',  role: 'COORDINATOR', year: 'TY'  },
    { email: 'sanjay.pawar24@college.edu',      name: 'Prof. Sanjay Pawar',     prnNo: 'FAC018', empId: 'EMP018', dept: 'ENTC', designation: 'Associate Professor',  role: 'GUIDE',       year: null  },
    { email: 'madhuri.thakare24@college.edu',   name: 'Prof. Madhuri Thakare',  prnNo: 'FAC019', empId: 'EMP019', dept: 'ENTC', designation: 'Assistant Professor',  role: 'GUIDE',       year: null  },
    { email: 'ganesh.shinde24@college.edu',     name: 'Prof. Ganesh Shinde',    prnNo: 'FAC020', empId: 'EMP020', dept: 'ENTC', designation: 'Assistant Professor',  role: 'GUIDE',       year: null  },
  ];
  for (const f of facultyData) {
    const user = await prisma.user.upsert({
      where: { email: f.email }, update: { isApproved: true },
      create: { email: f.email, password: pw, name: f.name, isApproved: true },
    });
    await prisma.facultyProfile.upsert({
      where: { prnNo: f.prnNo },
      update: { userId: user.id, employeeId: f.empId, departmentId: dept[f.dept].id, designation: f.designation },
      create: { userId: user.id, prnNo: f.prnNo, employeeId: f.empId, departmentId: dept[f.dept].id, designation: f.designation },
    });
    await ensureUserRole(user.id, roles[f.role].id, dept[f.dept].id, f.year);
    fac[f.prnNo] = user;
    console.log(`  ✓ [${f.role.padEnd(11)}] ${f.name}`);
  }
  console.log(`✅ ${facultyData.length} Faculty ready\n`);

  // ═══ Students ════════════════════════════════════════════════════════════
  const stu = {};
  const studentData = [
    // ── CSE TY A (8 students) ──────────────────────────────
    { email: 'aarav.patil24@college.edu',        name: 'Aarav Patil',         prnNo: '22CS001', enrl: 'EN22CS001', dept: 'CSE', year: 'TY',    div: 'A' },
    { email: 'sakshi.deshmukh24@college.edu',    name: 'Sakshi Deshmukh',     prnNo: '22CS002', enrl: 'EN22CS002', dept: 'CSE', year: 'TY',    div: 'A' },
    { email: 'vedant.kulkarni24@college.edu',    name: 'Vedant Kulkarni',     prnNo: '22CS003', enrl: 'EN22CS003', dept: 'CSE', year: 'TY',    div: 'A' },
    { email: 'riya.joshi24@college.edu',         name: 'Riya Joshi',          prnNo: '22CS004', enrl: 'EN22CS004', dept: 'CSE', year: 'TY',    div: 'A' },
    { email: 'om.salunkhe24@college.edu',        name: 'Om Salunkhe',         prnNo: '22CS005', enrl: 'EN22CS005', dept: 'CSE', year: 'TY',    div: 'A' },
    { email: 'ananya.bhosale24@college.edu',     name: 'Ananya Bhosale',      prnNo: '22CS006', enrl: 'EN22CS006', dept: 'CSE', year: 'TY',    div: 'A' },
    { email: 'tanmay.shinde24@college.edu',      name: 'Tanmay Shinde',       prnNo: '22CS007', enrl: 'EN22CS007', dept: 'CSE', year: 'TY',    div: 'A' },
    { email: 'pooja.gaikwad24@college.edu',      name: 'Pooja Gaikwad',       prnNo: '22CS008', enrl: 'EN22CS008', dept: 'CSE', year: 'TY',    div: 'A' },
    // ── CSE TY B (8 students) ──────────────────────────────
    { email: 'harsh.pawar24@college.edu',        name: 'Harsh Pawar',         prnNo: '22CS009', enrl: 'EN22CS009', dept: 'CSE', year: 'TY',    div: 'B' },
    { email: 'shruti.kale24@college.edu',        name: 'Shruti Kale',         prnNo: '22CS010', enrl: 'EN22CS010', dept: 'CSE', year: 'TY',    div: 'B' },
    { email: 'atharva.mane24@college.edu',       name: 'Atharva Mane',        prnNo: '22CS011', enrl: 'EN22CS011', dept: 'CSE', year: 'TY',    div: 'B' },
    { email: 'prachi.jadhav24@college.edu',      name: 'Prachi Jadhav',       prnNo: '22CS012', enrl: 'EN22CS012', dept: 'CSE', year: 'TY',    div: 'B' },
    { email: 'tejas.lokhande24@college.edu',     name: 'Tejas Lokhande',      prnNo: '22CS013', enrl: 'EN22CS013', dept: 'CSE', year: 'TY',    div: 'B' },
    { email: 'sakshi.sawant24@college.edu',      name: 'Sakshi Sawant',       prnNo: '22CS014', enrl: 'EN22CS014', dept: 'CSE', year: 'TY',    div: 'B' },
    { email: 'yash.deshpande24@college.edu',     name: 'Yash Deshpande',      prnNo: '22CS015', enrl: 'EN22CS015', dept: 'CSE', year: 'TY',    div: 'B' },
    { email: 'rutuja.thakur24@college.edu',      name: 'Rutuja Thakur',       prnNo: '22CS016', enrl: 'EN22CS016', dept: 'CSE', year: 'TY',    div: 'B' },
    // ── CSE FINAL A (8 students) ───────────────────────────
    { email: 'siddharth.more24@college.edu',     name: 'Siddharth More',      prnNo: '21CS001', enrl: 'EN21CS001', dept: 'CSE', year: 'FINAL', div: 'A' },
    { email: 'ankita.chavan24@college.edu',      name: 'Ankita Chavan',       prnNo: '21CS002', enrl: 'EN21CS002', dept: 'CSE', year: 'FINAL', div: 'A' },
    { email: 'rohan.kadam24@college.edu',        name: 'Rohan Kadam',         prnNo: '21CS003', enrl: 'EN21CS003', dept: 'CSE', year: 'FINAL', div: 'A' },
    { email: 'neha.wagh24@college.edu',          name: 'Neha Wagh',           prnNo: '21CS004', enrl: 'EN21CS004', dept: 'CSE', year: 'FINAL', div: 'A' },
    { email: 'pratik.dhere24@college.edu',       name: 'Pratik Dhere',        prnNo: '21CS005', enrl: 'EN21CS005', dept: 'CSE', year: 'FINAL', div: 'A' },
    { email: 'vaishnavi.garud24@college.edu',    name: 'Vaishnavi Garud',     prnNo: '21CS006', enrl: 'EN21CS006', dept: 'CSE', year: 'FINAL', div: 'A' },
    { email: 'nikhil.sonar24@college.edu',       name: 'Nikhil Sonar',        prnNo: '21CS007', enrl: 'EN21CS007', dept: 'CSE', year: 'FINAL', div: 'A' },
    { email: 'snehal.tak24@college.edu',         name: 'Snehal Tak',          prnNo: '21CS008', enrl: 'EN21CS008', dept: 'CSE', year: 'FINAL', div: 'A' },
    // ── CSE FINAL B (8 students) ───────────────────────────
    { email: 'omkar.bhor24@college.edu',         name: 'Omkar Bhor',          prnNo: '21CS009', enrl: 'EN21CS009', dept: 'CSE', year: 'FINAL', div: 'B' },
    { email: 'gauri.nimbalkar24@college.edu',    name: 'Gauri Nimbalkar',     prnNo: '21CS010', enrl: 'EN21CS010', dept: 'CSE', year: 'FINAL', div: 'B' },
    { email: 'aditya.khare24@college.edu',       name: 'Aditya Khare',        prnNo: '21CS011', enrl: 'EN21CS011', dept: 'CSE', year: 'FINAL', div: 'B' },
    { email: 'manasi.phadke24@college.edu',      name: 'Manasi Phadke',       prnNo: '21CS012', enrl: 'EN21CS012', dept: 'CSE', year: 'FINAL', div: 'B' },
    { email: 'akash.yadav24@college.edu',        name: 'Akash Yadav',         prnNo: '21CS013', enrl: 'EN21CS013', dept: 'CSE', year: 'FINAL', div: 'B' },
    { email: 'nupur.raut24@college.edu',         name: 'Nupur Raut',          prnNo: '21CS014', enrl: 'EN21CS014', dept: 'CSE', year: 'FINAL', div: 'B' },
    { email: 'jayesh.mahajan24@college.edu',     name: 'Jayesh Mahajan',      prnNo: '21CS015', enrl: 'EN21CS015', dept: 'CSE', year: 'FINAL', div: 'B' },
    { email: 'divya.shirke24@college.edu',       name: 'Divya Shirke',        prnNo: '21CS016', enrl: 'EN21CS016', dept: 'CSE', year: 'FINAL', div: 'B' },

    // ── IT SY A (6 students) ───────────────────────────────
    { email: 'arjun.naik24@college.edu',         name: 'Arjun Naik',          prnNo: '23IT001', enrl: 'EN23IT001', dept: 'IT',  year: 'SY',    div: 'A' },
    { email: 'komal.phadnis24@college.edu',      name: 'Komal Phadnis',       prnNo: '23IT002', enrl: 'EN23IT002', dept: 'IT',  year: 'SY',    div: 'A' },
    { email: 'rahul.mhaske24@college.edu',       name: 'Rahul Mhaske',        prnNo: '23IT003', enrl: 'EN23IT003', dept: 'IT',  year: 'SY',    div: 'A' },
    { email: 'megha.landge24@college.edu',       name: 'Megha Landge',        prnNo: '23IT004', enrl: 'EN23IT004', dept: 'IT',  year: 'SY',    div: 'A' },
    { email: 'tushar.ingale24@college.edu',      name: 'Tushar Ingale',       prnNo: '23IT005', enrl: 'EN23IT005', dept: 'IT',  year: 'SY',    div: 'A' },
    { email: 'pallavi.kokate24@college.edu',     name: 'Pallavi Kokate',      prnNo: '23IT006', enrl: 'EN23IT006', dept: 'IT',  year: 'SY',    div: 'A' },
    // ── IT SY B (6 students) ───────────────────────────────
    { email: 'suraj.ghodke24@college.edu',       name: 'Suraj Ghodke',        prnNo: '23IT007', enrl: 'EN23IT007', dept: 'IT',  year: 'SY',    div: 'B' },
    { email: 'vrushali.sonawane24@college.edu',  name: 'Vrushali Sonawane',   prnNo: '23IT008', enrl: 'EN23IT008', dept: 'IT',  year: 'SY',    div: 'B' },
    { email: 'gaurav.dabholkar24@college.edu',   name: 'Gaurav Dabholkar',    prnNo: '23IT009', enrl: 'EN23IT009', dept: 'IT',  year: 'SY',    div: 'B' },
    { email: 'nisha.bhandari24@college.edu',     name: 'Nisha Bhandari',      prnNo: '23IT010', enrl: 'EN23IT010', dept: 'IT',  year: 'SY',    div: 'B' },
    { email: 'vishal.dhage24@college.edu',       name: 'Vishal Dhage',        prnNo: '23IT011', enrl: 'EN23IT011', dept: 'IT',  year: 'SY',    div: 'B' },
    { email: 'aditi.tambe24@college.edu',        name: 'Aditi Tambe',         prnNo: '23IT012', enrl: 'EN23IT012', dept: 'IT',  year: 'SY',    div: 'B' },
    // ── IT FINAL A (8 students) ────────────────────────────
    { email: 'karan.bharambe24@college.edu',     name: 'Karan Bharambe',      prnNo: '21IT001', enrl: 'EN21IT001', dept: 'IT',  year: 'FINAL', div: 'A' },
    { email: 'ashwini.gholap24@college.edu',     name: 'Ashwini Gholap',      prnNo: '21IT002', enrl: 'EN21IT002', dept: 'IT',  year: 'FINAL', div: 'A' },
    { email: 'prasad.bankar24@college.edu',      name: 'Prasad Bankar',       prnNo: '21IT003', enrl: 'EN21IT003', dept: 'IT',  year: 'FINAL', div: 'A' },
    { email: 'sanika.thombre24@college.edu',     name: 'Sanika Thombre',      prnNo: '21IT004', enrl: 'EN21IT004', dept: 'IT',  year: 'FINAL', div: 'A' },
    { email: 'aniket.chitre24@college.edu',      name: 'Aniket Chitre',       prnNo: '21IT005', enrl: 'EN21IT005', dept: 'IT',  year: 'FINAL', div: 'A' },
    { email: 'priyanka.bhagat24@college.edu',    name: 'Priyanka Bhagat',     prnNo: '21IT006', enrl: 'EN21IT006', dept: 'IT',  year: 'FINAL', div: 'A' },
    { email: 'sachin.pol24@college.edu',         name: 'Sachin Pol',          prnNo: '21IT007', enrl: 'EN21IT007', dept: 'IT',  year: 'FINAL', div: 'A' },
    { email: 'amruta.deshpande24@college.edu',   name: 'Amruta Deshpande',    prnNo: '21IT008', enrl: 'EN21IT008', dept: 'IT',  year: 'FINAL', div: 'A' },
    // ── IT FINAL B (8 students) ────────────────────────────
    { email: 'prathamesh.kalunge24@college.edu', name: 'Prathamesh Kalunge',  prnNo: '21IT009', enrl: 'EN21IT009', dept: 'IT',  year: 'FINAL', div: 'B' },
    { email: 'suchita.baraskar24@college.edu',   name: 'Suchita Baraskar',    prnNo: '21IT010', enrl: 'EN21IT010', dept: 'IT',  year: 'FINAL', div: 'B' },
    { email: 'mayur.shirsat24@college.edu',      name: 'Mayur Shirsat',       prnNo: '21IT011', enrl: 'EN21IT011', dept: 'IT',  year: 'FINAL', div: 'B' },
    { email: 'sayli.parate24@college.edu',       name: 'Sayli Parate',        prnNo: '21IT012', enrl: 'EN21IT012', dept: 'IT',  year: 'FINAL', div: 'B' },

    // ── ME TY A (6 students) ───────────────────────────────
    { email: 'sandesh.tupe24@college.edu',       name: 'Sandesh Tupe',        prnNo: '22ME001', enrl: 'EN22ME001', dept: 'ME',  year: 'TY',    div: 'A' },
    { email: 'pranali.devkar24@college.edu',     name: 'Pranali Devkar',      prnNo: '22ME002', enrl: 'EN22ME002', dept: 'ME',  year: 'TY',    div: 'A' },
    { email: 'vivek.ghuge24@college.edu',        name: 'Vivek Ghuge',         prnNo: '22ME003', enrl: 'EN22ME003', dept: 'ME',  year: 'TY',    div: 'A' },
    { email: 'rucha.kolhe24@college.edu',        name: 'Rucha Kolhe',         prnNo: '22ME004', enrl: 'EN22ME004', dept: 'ME',  year: 'TY',    div: 'A' },
    { email: 'swapnil.nikam24@college.edu',      name: 'Swapnil Nikam',       prnNo: '22ME005', enrl: 'EN22ME005', dept: 'ME',  year: 'TY',    div: 'A' },
    { email: 'apurva.gawand24@college.edu',      name: 'Apurva Gawand',       prnNo: '22ME006', enrl: 'EN22ME006', dept: 'ME',  year: 'TY',    div: 'A' },
    // ── ME FINAL A (8 students) ────────────────────────────
    { email: 'mahesh.thombare24@college.edu',    name: 'Mahesh Thombare',     prnNo: '21ME001', enrl: 'EN21ME001', dept: 'ME',  year: 'FINAL', div: 'A' },
    { email: 'rupali.divekar24@college.edu',     name: 'Rupali Divekar',      prnNo: '21ME002', enrl: 'EN21ME002', dept: 'ME',  year: 'FINAL', div: 'A' },
    { email: 'amey.potdar24@college.edu',        name: 'Amey Potdar',         prnNo: '21ME003', enrl: 'EN21ME003', dept: 'ME',  year: 'FINAL', div: 'A' },
    { email: 'shweta.gangurde24@college.edu',    name: 'Shweta Gangurde',     prnNo: '21ME004', enrl: 'EN21ME004', dept: 'ME',  year: 'FINAL', div: 'A' },
    // ── ME FINAL B (8 students) ────────────────────────────
    { email: 'abhishek.suryawanshi24@college.edu', name: 'Abhishek Suryawanshi', prnNo: '21ME005', enrl: 'EN21ME005', dept: 'ME',  year: 'FINAL', div: 'B' },
    { email: 'priyanka.donde24@college.edu',    name: 'Priyanka Donde',      prnNo: '21ME006', enrl: 'EN21ME006', dept: 'ME',  year: 'FINAL', div: 'B' },
    { email: 'ajinkya.gawade24@college.edu',     name: 'Ajinkya Gawade',      prnNo: '21ME007', enrl: 'EN21ME007', dept: 'ME',  year: 'FINAL', div: 'B' },
    { email: 'sayali.mandlik24@college.edu',     name: 'Sayali Mandlik',      prnNo: '21ME008', enrl: 'EN21ME008', dept: 'ME',  year: 'FINAL', div: 'B' },

    // ── ENTC TY A (6 students) ─────────────────────────────
    { email: 'chinmay.babar24@college.edu',      name: 'Chinmay Babar',       prnNo: '22EC001', enrl: 'EN22EC001', dept: 'ENTC', year: 'TY',    div: 'A' },
    { email: 'tanvi.pardeshi24@college.edu',     name: 'Tanvi Pardeshi',      prnNo: '22EC002', enrl: 'EN22EC002', dept: 'ENTC', year: 'TY',    div: 'A' },
    { email: 'sagar.mhatre243@college.edu',      name: 'Sagar Mhatre',        prnNo: '22EC003', enrl: 'EN22EC003', dept: 'ENTC', year: 'TY',    div: 'A' },
    { email: 'revati.gosavi24@college.edu',      name: 'Revati Gosavi',       prnNo: '22EC004', enrl: 'EN22EC004', dept: 'ENTC', year: 'TY',    div: 'A' },
    { email: 'nikhil.bodke24@college.edu',       name: 'Nikhil Bodke',        prnNo: '22EC005', enrl: 'EN22EC005', dept: 'ENTC', year: 'TY',    div: 'A' },
    { email: 'shivani.rathod24@college.edu',     name: 'Shivani Rathod',      prnNo: '22EC006', enrl: 'EN22EC006', dept: 'ENTC', year: 'TY',    div: 'A' },
    // ── ENTC FINAL A (8 students) ──────────────────────────
    { email: 'yogesh.kamble24@college.edu',      name: 'Yogesh Kamble',       prnNo: '21EC001', enrl: 'EN21EC001', dept: 'ENTC', year: 'FINAL', div: 'A' },
    { email: 'bhakti.wable24@college.edu',       name: 'Bhakti Wable',        prnNo: '21EC002', enrl: 'EN21EC002', dept: 'ENTC', year: 'FINAL', div: 'A' },
    { email: 'hrushikesh.dange24@college.edu',   name: 'Hrushikesh Dange',    prnNo: '21EC003', enrl: 'EN21EC003', dept: 'ENTC', year: 'FINAL', div: 'A' },
    { email: 'prajakta.bhosle24@college.edu',    name: 'Prajakta Bhosle',     prnNo: '21EC004', enrl: 'EN21EC004', dept: 'ENTC', year: 'FINAL', div: 'A' },
    // ── ENTC FINAL B (8 students) ──────────────────────────
    { email: 'akshay.desai243@college.edu',      name: 'Akshay Desai',        prnNo: '21EC005', enrl: 'EN21EC005', dept: 'ENTC', year: 'FINAL', div: 'B' },
    { email: 'ketaki.parkhe24@college.edu',      name: 'Ketaki Parkhe',       prnNo: '21EC006', enrl: 'EN21EC006', dept: 'ENTC', year: 'FINAL', div: 'B' },
    { email: 'vaibhav.bansode24@college.edu',    name: 'Vaibhav Bansode',     prnNo: '21EC007', enrl: 'EN21EC007', dept: 'ENTC', year: 'FINAL', div: 'B' },
    { email: 'smita.waghmare24@college.edu',     name: 'Smita Waghmare',      prnNo: '21EC008', enrl: 'EN21EC008', dept: 'ENTC', year: 'FINAL', div: 'B' },
  ];
  for (const s of studentData) {
    const user = await prisma.user.upsert({
      where: { email: s.email }, update: { isApproved: true },
      create: { email: s.email, password: pw, name: s.name, isApproved: true },
    });
    await prisma.studentProfile.upsert({
      where: { prnNo: s.prnNo },
      update: { userId: user.id, enrollmentNo: s.enrl, departmentId: dept[s.dept].id, year: s.year, division: s.div },
      create: { userId: user.id, prnNo: s.prnNo, enrollmentNo: s.enrl, departmentId: dept[s.dept].id, year: s.year, division: s.div },
    });
    await ensureUserRole(user.id, roles.STUDENT.id, dept[s.dept].id);
    stu[s.prnNo] = user;
  }
  console.log(`✅ ${studentData.length} Students ready\n`);

  // ═══ Groups, Projects & Reviews ══════════════════════════════════════════
  const groupData = [
    // ── CSE TY A — 2 groups ─────────────────
    {
      name: 'CSE-TY-A-G1', dept: 'CSE', year: 'TY', div: 'A', sem: 5, acYear: '2025-26',
      guide: 'FAC004', coord: 'FAC002',
      members: [{ prn: '22CS001', leader: true }, { prn: '22CS002' }, { prn: '22CS003' }, { prn: '22CS004' }],
      project: {
        title: 'Smart Attendance System using Face Recognition',
        abstract: 'AI-powered attendance system using real-time face recognition with anti-spoofing detection. Integrates with college ERP for automated attendance marking, proxy detection, and monthly analytics dashboard for HODs.',
        domain: 'Artificial Intelligence', techStack: 'Python, OpenCV, TensorFlow, Flask, React, PostgreSQL',
        sdgGoals: [4, 9], status: 'APPROVED',
        githubLink: 'https://github.com/smart-attendance-ai',
      },
    },
    {
      name: 'CSE-TY-A-G2', dept: 'CSE', year: 'TY', div: 'A', sem: 5, acYear: '2025-26',
      guide: 'FAC005', coord: 'FAC002',
      members: [{ prn: '22CS005', leader: true }, { prn: '22CS006' }, { prn: '22CS007' }, { prn: '22CS008' }],
      project: {
        title: 'E-Waste Management & Recycling Platform',
        abstract: 'Web platform connecting e-waste generators with certified recyclers. Features gamified recycling points, pickup scheduling, and environmental impact calculator. Tracks disposal chain for complete transparency.',
        domain: 'Web Development', techStack: 'Next.js, Express.js, PostgreSQL, Prisma, Tailwind CSS',
        sdgGoals: [12, 13, 11], status: 'UNDER_REVIEW',
      },
    },
    // ── CSE TY B — 2 groups ─────────────────
    {
      name: 'CSE-TY-B-G1', dept: 'CSE', year: 'TY', div: 'B', sem: 5, acYear: '2025-26',
      guide: 'FAC006', coord: 'FAC002',
      members: [{ prn: '22CS009', leader: true }, { prn: '22CS010' }, { prn: '22CS011' }, { prn: '22CS012' }],
      project: {
        title: 'Video-based Sign Language Translator',
        abstract: 'Real-time Indian Sign Language to text/speech converter using MediaPipe hand landmarks and LSTM neural networks. Supports Marathi and Hindi sign vocabulary with expandable gesture library.',
        domain: 'Machine Learning', techStack: 'Python, MediaPipe, TensorFlow, React Native',
        sdgGoals: [3, 4, 10], status: 'SUBMITTED',
      },
    },
    {
      name: 'CSE-TY-B-G2', dept: 'CSE', year: 'TY', div: 'B', sem: 5, acYear: '2025-26',
      guide: 'FAC004', coord: 'FAC002',
      members: [{ prn: '22CS013', leader: true }, { prn: '22CS014' }, { prn: '22CS015' }, { prn: '22CS016' }],
      project: {
        title: 'Decentralized Document Verification using Blockchain',
        abstract: 'Ethereum-based platform for issuing tamper-proof academic certificates. Smart contracts handle issuance, revocation, and instant verification by employers via QR code scanning.',
        domain: 'Blockchain', techStack: 'Solidity, Hardhat, React, Node.js, IPFS, Ethers.js',
        sdgGoals: [4, 16, 9], status: 'DRAFT',
      },
    },
    // ── CSE FINAL A — 2 groups ──────────────
    {
      name: 'CSE-FIN-A-G1', dept: 'CSE', year: 'FINAL', div: 'A', sem: 7, acYear: '2025-26',
      guide: 'FAC005', coord: 'FAC003',
      members: [{ prn: '21CS001', leader: true }, { prn: '21CS002' }, { prn: '21CS003' }, { prn: '21CS004' }],
      project: {
        title: 'Multi-Agent AI Research Assistant',
        abstract: 'LangGraph-powered multi-agent system for academic research — automatically searches research papers, summarizes findings, identifies gaps, and generates structured literature reviews with proper citations.',
        domain: 'Artificial Intelligence', techStack: 'Python, LangGraph, LangChain, FastAPI, React, ChromaDB',
        sdgGoals: [4, 9, 17], status: 'PUBLISHED', isPublished: true,
        githubLink: 'https://github.com/ai-research-assistant',
        videoLink: 'https://youtube.com/watch?v=demo_research_ai',
      },
    },
    {
      name: 'CSE-FIN-A-G2', dept: 'CSE', year: 'FINAL', div: 'A', sem: 7, acYear: '2025-26',
      guide: 'FAC006', coord: 'FAC003',
      members: [{ prn: '21CS005', leader: true }, { prn: '21CS006' }, { prn: '21CS007' }, { prn: '21CS008' }],
      project: {
        title: 'College ERP with AI-Powered Analytics',
        abstract: 'Comprehensive ERP system for college management with AI-driven student performance prediction, automated timetable generation, and real-time dashboards for administration, faculty, and students.',
        domain: 'Full Stack Development', techStack: 'Next.js, Node.js, PostgreSQL, Prisma, TensorFlow.js, Chart.js',
        sdgGoals: [4, 9], status: 'COMPLETED',
        githubLink: 'https://github.com/college-erp-ai',
      },
    },
    // ── CSE FINAL B — 2 groups ──────────────
    {
      name: 'CSE-FIN-B-G1', dept: 'CSE', year: 'FINAL', div: 'B', sem: 7, acYear: '2025-26',
      guide: 'FAC004', coord: 'FAC003',
      members: [{ prn: '21CS009', leader: true }, { prn: '21CS010' }, { prn: '21CS011' }, { prn: '21CS012' }],
      project: {
        title: 'Agri-Connect: Farmer-to-Consumer Marketplace',
        abstract: 'Direct farmer-to-consumer marketplace eliminating middlemen. Features GPS-based local sourcing, real-time pricing based on mandi rates, cold chain logistics tracking, and UPI/wallet payment integration.',
        domain: 'Mobile Development', techStack: 'Flutter, Dart, Firebase, Node.js, Razorpay API, Google Maps',
        sdgGoals: [1, 2, 8, 12], status: 'APPROVED',
        githubLink: 'https://github.com/agri-connect-app',
      },
    },
    {
      name: 'CSE-FIN-B-G2', dept: 'CSE', year: 'FINAL', div: 'B', sem: 7, acYear: '2025-26',
      guide: 'FAC005', coord: 'FAC003',
      members: [{ prn: '21CS013', leader: true }, { prn: '21CS014' }, { prn: '21CS015' }, { prn: '21CS016' }],
      project: {
        title: 'MedSecure: Healthcare Data on Blockchain',
        abstract: 'Permissioned blockchain for patient health records with role-based access for doctors, labs, and patients. Supports cross-hospital data sharing with patient consent via zero-knowledge proofs.',
        domain: 'Blockchain', techStack: 'Hyperledger Fabric, React, Node.js, MongoDB, Docker',
        sdgGoals: [3, 9, 16], status: 'SUBMITTED',
      },
    },

    // ── IT SY A — 2 groups ──────────────────
    {
      name: 'IT-SY-A-G1', dept: 'IT', year: 'SY', div: 'A', sem: 3, acYear: '2025-26',
      guide: 'FAC009', coord: 'FAC008',
      members: [{ prn: '23IT001', leader: true }, { prn: '23IT002' }, { prn: '23IT003' }],
      project: {
        title: 'Campus Marketplace for Students',
        abstract: 'Peer-to-peer marketplace app for buying/selling textbooks, notes, gadgets, and services within campus. Features in-app chat, rating system, and safe campus meetup point scheduling.',
        domain: 'Mobile Development', techStack: 'Flutter, Firebase, Dart, Cloud Functions',
        sdgGoals: [8, 12], status: 'SUBMITTED',
      },
    },
    {
      name: 'IT-SY-A-G2', dept: 'IT', year: 'SY', div: 'A', sem: 3, acYear: '2025-26',
      guide: 'FAC010', coord: 'FAC008',
      members: [{ prn: '23IT004', leader: true }, { prn: '23IT005' }, { prn: '23IT006' }],
      project: {
        title: 'Mental Health Chatbot for Students',
        abstract: 'AI chatbot providing mental health first-aid through guided conversations, mood tracking, and anonymized peer-support matching. Automatically refers severe cases to counselors.',
        domain: 'Artificial Intelligence', techStack: 'Python, Rasa, React, PostgreSQL, Twilio',
        sdgGoals: [3, 4], status: 'DRAFT',
      },
    },
    // ── IT SY B — 2 groups ──────────────────
    {
      name: 'IT-SY-B-G1', dept: 'IT', year: 'SY', div: 'B', sem: 3, acYear: '2025-26',
      guide: 'FAC011', coord: 'FAC008',
      members: [{ prn: '23IT007', leader: true }, { prn: '23IT008' }, { prn: '23IT009' }],
      project: {
        title: 'Smart Library Management with RFID',
        abstract: 'RFID-based library automation with self-checkout kiosk, automatic fine calculation, book recommendation engine, and real-time seat availability tracking for reading halls.',
        domain: 'IoT', techStack: 'Arduino, RFID, Node.js, React, MySQL',
        sdgGoals: [4, 9], status: 'UNDER_REVIEW',
      },
    },
    {
      name: 'IT-SY-B-G2', dept: 'IT', year: 'SY', div: 'B', sem: 3, acYear: '2025-26',
      guide: 'FAC009', coord: 'FAC008',
      members: [{ prn: '23IT010', leader: true }, { prn: '23IT011' }, { prn: '23IT012' }],
      project: {
        title: 'Automated MCQ Generator from Notes',
        abstract: 'NLP-based tool that generates multiple-choice questions from uploaded lecture notes and textbook chapters. Supports difficulty grading and Bloom\'s taxonomy tagging.',
        domain: 'Natural Language Processing', techStack: 'Python, spaCy, Transformers, Flask, React',
        sdgGoals: [4], status: 'DRAFT',
      },
    },

    // ── IT FINAL A — 2 groups ───────────────
    {
      name: 'IT-FIN-A-G1', dept: 'IT', year: 'FINAL', div: 'A', sem: 7, acYear: '2025-26',
      guide: 'FAC010', coord: null,
      members: [{ prn: '21IT001', leader: true }, { prn: '21IT002' }, { prn: '21IT003' }, { prn: '21IT004' }],
      project: {
        title: 'IoT Smart Campus Energy Monitor',
        abstract: 'Real-time energy monitoring across campus buildings using IoT sensors with ML-based anomaly detection. Features automated alerts for energy waste, department-wise consumption dashboards, and monthly savings reports.',
        domain: 'Internet of Things', techStack: 'ESP32, MQTT, InfluxDB, Grafana, Python, TensorFlow Lite',
        sdgGoals: [7, 9, 11, 13], status: 'PUBLISHED', isPublished: true,
        githubLink: 'https://github.com/smart-campus-iot',
        videoLink: 'https://youtube.com/watch?v=campus_energy_demo',
      },
    },
    {
      name: 'IT-FIN-A-G2', dept: 'IT', year: 'FINAL', div: 'A', sem: 7, acYear: '2025-26',
      guide: 'FAC011', coord: null,
      members: [{ prn: '21IT005', leader: true }, { prn: '21IT006' }, { prn: '21IT007' }, { prn: '21IT008' }],
      project: {
        title: 'Natural Language to SQL Query Generator',
        abstract: 'Converts plain English database queries to optimized SQL using fine-tuned LLMs. Auto-detects schema, suggests joins, handles aggregations, and provides query explanation in simple language.',
        domain: 'Machine Learning', techStack: 'Python, OpenAI API, LangChain, FastAPI, React, PostgreSQL',
        sdgGoals: [9, 4], status: 'APPROVED',
        githubLink: 'https://github.com/nl2sql-generator',
      },
    },
    // ── IT FINAL B — 2 groups ───────────────
    {
      name: 'IT-FIN-B-G1', dept: 'IT', year: 'FINAL', div: 'B', sem: 7, acYear: '2025-26',
      guide: 'FAC009', coord: null,
      members: [{ prn: '21IT009', leader: true }, { prn: '21IT010' }, { prn: '21IT011' }, { prn: '21IT012' }],
      project: {
        title: 'Women Safety App with Real-time Tracking',
        abstract: 'Emergency SOS app with real-time location sharing, fake call generator, shake-to-alert, nearby police station finder, and anonymous crime reporting with heat-map visualization.',
        domain: 'Mobile Development', techStack: 'React Native, Node.js, Socket.IO, Google Maps API, Twilio',
        sdgGoals: [5, 11, 16], status: 'COMPLETED',
        githubLink: 'https://github.com/women-safety-app',
      },
    },

    // ── ME FINAL A — 1 group ────────────────
    {
      name: 'ME-FIN-A-G1', dept: 'ME', year: 'FINAL', div: 'A', sem: 7, acYear: '2025-26',
      guide: 'FAC014', coord: 'FAC013',
      members: [{ prn: '21ME001', leader: true }, { prn: '21ME002' }, { prn: '21ME003' }, { prn: '21ME004' }],
      project: {
        title: 'Automated Solar Panel Cleaning Robot',
        abstract: 'Autonomous robot for periodic dry-cleaning of solar panels using rubber scrapers and compressed air jets. Increases panel efficiency by 25-30%. Solar-powered with rain detection auto-pause.',
        domain: 'Robotics & Automation', techStack: 'Arduino Mega, Raspberry Pi, Python, ROS, SolidWorks',
        sdgGoals: [7, 9, 13], status: 'PUBLISHED', isPublished: true,
        githubLink: 'https://github.com/solar-clean-bot',
        videoLink: 'https://youtube.com/watch?v=solar_robot_demo',
      },
    },
    // ── ME FINAL B — 1 group ────────────────
    {
      name: 'ME-FIN-B-G1', dept: 'ME', year: 'FINAL', div: 'B', sem: 7, acYear: '2025-26',
      guide: 'FAC015', coord: 'FAC013',
      members: [{ prn: '21ME005', leader: true }, { prn: '21ME006' }, { prn: '21ME007' }, { prn: '21ME008' }],
      project: {
        title: 'Industrial Waste Heat Recovery System',
        abstract: 'Thermoelectric generator system to convert waste heat from industrial furnaces into electrical energy. Prototype recovers up to 15% heat energy with phase-change material thermal storage.',
        domain: 'Renewable Energy', techStack: 'MATLAB Simulink, SolidWorks, Arduino, LabVIEW',
        sdgGoals: [7, 9, 12, 13], status: 'UNDER_REVIEW',
      },
    },

    // ── ENTC TY A — 1 group ─────────────────
    {
      name: 'ENTC-TY-A-G1', dept: 'ENTC', year: 'TY', div: 'A', sem: 5, acYear: '2025-26',
      guide: 'FAC018', coord: 'FAC017',
      members: [{ prn: '22EC001', leader: true }, { prn: '22EC002' }, { prn: '22EC003' }, { prn: '22EC004' }],
      project: {
        title: 'PCB Defect Detection using Computer Vision',
        abstract: 'Automated optical inspection system for printed circuit boards using CNNs. Detects solder bridges, missing components, misalignment, and trace breaks with 98% accuracy on test dataset.',
        domain: 'Computer Vision', techStack: 'Python, OpenCV, YOLOv8, Raspberry Pi 4, Flask',
        sdgGoals: [9, 12], status: 'APPROVED',
        githubLink: 'https://github.com/pcb-defect-detector',
      },
    },
    // ── ENTC FINAL A — 1 group ──────────────
    {
      name: 'ENTC-FIN-A-G1', dept: 'ENTC', year: 'FINAL', div: 'A', sem: 7, acYear: '2025-26',
      guide: 'FAC019', coord: null,
      members: [{ prn: '21EC001', leader: true }, { prn: '21EC002' }, { prn: '21EC003' }, { prn: '21EC004' }],
      project: {
        title: 'LoRa-based Environmental Monitoring Network',
        abstract: 'Low-power wide-area network using LoRa for monitoring air quality, temperature, humidity, and noise across college campus. Gateway uploads data to cloud with alert thresholds for hazardous conditions.',
        domain: 'Internet of Things', techStack: 'LoRa SX1276, STM32, The Things Network, InfluxDB, Grafana',
        sdgGoals: [3, 11, 13], status: 'PUBLISHED', isPublished: true,
        githubLink: 'https://github.com/lora-env-monitor',
        videoLink: 'https://youtube.com/watch?v=lora_campus_demo',
      },
    },
    // ── ENTC FINAL B — 1 group ──────────────
    {
      name: 'ENTC-FIN-B-G1', dept: 'ENTC', year: 'FINAL', div: 'B', sem: 7, acYear: '2025-26',
      guide: 'FAC020', coord: null,
      members: [{ prn: '21EC005', leader: true }, { prn: '21EC006' }, { prn: '21EC007' }, { prn: '21EC008' }],
      project: {
        title: 'Voice-Controlled Home Automation System',
        abstract: 'Marathi and Hindi voice command based smart home controller using offline speech recognition. Controls lights, fans, and appliances via relay modules with scheduling, energy monitoring, and mobile app.',
        domain: 'Embedded Systems', techStack: 'ESP32, Vosk (offline ASR), Relay Module, Flutter, MQTT',
        sdgGoals: [7, 9, 11], status: 'SUBMITTED',
      },
    },
  ];

  for (const g of groupData) {
    let group = await prisma.group.findFirst({
      where: { name: g.name, departmentId: dept[g.dept].id },
    });
    if (!group) {
      group = await prisma.group.create({
        data: {
          name: g.name, departmentId: dept[g.dept].id,
          year: g.year, division: g.div, academicYear: g.acYear, semester: g.sem,
          guideId: fac[g.guide]?.id ?? null,
          coordinatorId: g.coord ? fac[g.coord]?.id ?? null : null,
        },
      });
    }
    for (const m of g.members) {
      if (!stu[m.prn]) continue;
      await prisma.groupMember.upsert({
        where: { groupId_studentId: { groupId: group.id, studentId: stu[m.prn].id } },
        update: {},
        create: { groupId: group.id, studentId: stu[m.prn].id, isLeader: m.leader ?? false },
      });
    }
    if (g.project) {
      const exists = await prisma.project.findUnique({ where: { groupId: group.id } });
      if (!exists) {
        const proj = await prisma.project.create({
          data: {
            groupId: group.id, departmentId: dept[g.dept].id,
            title: g.project.title, abstract: g.project.abstract ?? null,
            domain: g.project.domain ?? null, techStack: g.project.techStack ?? null,
            sdgGoals: g.project.sdgGoals ?? [], status: g.project.status,
            githubLink: g.project.githubLink ?? null, videoLink: g.project.videoLink ?? null,
            isPublished: g.project.isPublished ?? false,
            publishedAt: g.project.isPublished ? new Date('2026-01-15') : null,
            ff180Status: ['APPROVED', 'COMPLETED', 'PUBLISHED'].includes(g.project.status) ? 'APPROVED' : 'PENDING',
          },
        });

        // Add reviews for projects that have been reviewed
        if (['APPROVED', 'COMPLETED', 'PUBLISHED'].includes(g.project.status)) {
          const guideId = fac[g.guide]?.id;
          if (guideId) {
            await prisma.projectReview.create({
              data: {
                projectId: proj.id, reviewerId: guideId,
                comment: 'Good progress. Project objectives are well-defined and implementation is on track. Approved for next phase.',
                isApproved: true,
              },
            });
          }
        }
        if (['UNDER_REVIEW'].includes(g.project.status)) {
          const guideId = fac[g.guide]?.id;
          if (guideId) {
            await prisma.projectReview.create({
              data: {
                projectId: proj.id, reviewerId: guideId,
                comment: 'Initial submission reviewed. Some improvements needed in documentation. Please add more detail to the system architecture section.',
                isApproved: false, rejectionReason: 'Documentation needs improvement',
              },
            });
          }
        }
        if (['REJECTED'].includes(g.project.status)) {
          const guideId = fac[g.guide]?.id;
          if (guideId) {
            await prisma.projectReview.create({
              data: {
                projectId: proj.id, reviewerId: guideId,
                comment: 'Project scope is too broad. Please narrow down to a specific problem statement and resubmit with feasibility analysis.',
                isApproved: false, rejectionReason: 'Scope too broad, needs focused problem statement',
              },
            });
          }
        }
      }
    }
    console.log(`  ✓ ${g.name} → ${g.project?.status ?? 'no project'}`);
  }
  console.log(`✅ ${groupData.length} Groups & Projects ready\n`);

  // ═══ Audit Logs ══════════════════════════════════════════════════════════
  for (const code of ['CSE', 'IT', 'ME', 'ENTC']) {
    const hodFac = facultyData.find(f => f.dept === code && f.role === 'HOD');
    if (hodFac && fac[hodFac.prnNo]) {
      await prisma.auditLog.create({
        data: {
          userId: admin.id, action: 'ASSIGN_HOD', entityType: 'Department',
          entityId: dept[code].id, metadata: { assignedTo: fac[hodFac.prnNo].id },
        },
      });
    }
  }
  console.log('✅ Audit logs created\n');

  // ═══ Summary ═════════════════════════════════════════════════════════════
  console.log('══════════════════════════════════════════════════════════════');
  console.log('🎉 SEED COMPLETE!');
  console.log('══════════════════════════════════════════════════════════════');
  console.log(`🔑 Password for ALL users: 12345678`);
  console.log(`📊 ${facultyData.length} Faculty | ${studentData.length} Students | ${groupData.length} Groups | 4 Departments`);
  console.log('══════════════════════════════════════════════════════════════\n');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());

