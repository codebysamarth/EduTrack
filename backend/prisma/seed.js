const { PrismaClient } = require('../generated/prisma');
const { PrismaPg } = require('@prisma/adapter-pg');
const bcrypt = require('bcryptjs');

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  // Create ADMIN role
  const adminRole = await prisma.role.upsert({
    where: { name: 'ADMIN' },
    update: {},
    create: { name: 'ADMIN' },
  });

  // Hash password
  const hashedPassword = await bcrypt.hash('12345678', 10);

  // Create admin user
  const admin = await prisma.user.upsert({
    where: { email: 'pawarsamarth786@gmail.com' },
    update: {},
    create: {
      email: 'pawarsamarth786@gmail.com',
      password: hashedPassword,
      name: 'Admin',
      isApproved: true,
    },
  });

  // Assign ADMIN role (if not already assigned)
  const existingRole = await prisma.userRole.findFirst({
    where: { userId: admin.id, roleId: adminRole.id },
  });
  if (!existingRole) {
    await prisma.userRole.create({
      data: { userId: admin.id, roleId: adminRole.id },
    });
  }

  console.log('✅ Admin seeded:', admin.email);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
