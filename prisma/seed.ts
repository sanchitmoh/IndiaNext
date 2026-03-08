import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding setup...');

  // Insert default admins based on roles
  const admins = [
    {
      email: 'superadmin@indianext.in',
      name: 'Super Admin',
      password: process.env.SEED_SUPERADMIN_PASSWORD || 'ChangeMe@123',
      role: 'SUPER_ADMIN' as const,
    },
    {
      email: 'admin@indianext.in',
      name: 'Admin',
      password: process.env.SEED_ADMIN_PASSWORD || 'ChangeMe@123',
      role: 'ADMIN' as const,
    },
    {
      email: 'organizer@indianext.in',
      name: 'Organizer',
      password: process.env.SEED_ORGANIZER_PASSWORD || 'ChangeMe@123',
      role: 'ORGANIZER' as const,
    },
    {
      email: 'judge1@indianext.in',
      name: 'Judge 1',
      password: process.env.SEED_JUDGE_PASSWORD || 'ChangeMe@123',
      role: 'JUDGE' as const,
    },
  ];

  for (const admin of admins) {
    const hashedPassword = await bcrypt.hash(admin.password, 10);
    await prisma.admin.upsert({
      where: { email: admin.email },
      update: {
        password: hashedPassword,
        role: admin.role,
        name: admin.name,
      },
      create: {
        email: admin.email,
        name: admin.name,
        password: hashedPassword,
        role: admin.role,
      },
    });
    console.log(`Upserted admin: ${admin.email}`);
  }

  // Also seed ProblemStatements for BuildStorm if needed?
  // Wait, if we clear the database, problem statements are gone too.
  // The schema has ProblemStatement model. Do we need to seed them?
  // Let's just reset the DB and see what was originally there. We don't have the original seed.ts...

  console.log('Seed completed successfully.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
