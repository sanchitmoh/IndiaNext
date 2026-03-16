/**
 * reset-attendance.ts
 * Resets all test teams to NOT_MARKED attendance status
 *
 * Run: npx tsx prisma/reset-attendance.ts
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool as any);
const prisma = new PrismaClient({ adapter });

async function resetAttendance() {
  console.log('🔄 Resetting all test teams to NOT_MARKED attendance...\n');

  // Find all test teams (those with shortCode starting with TEST or DEMO)
  const testTeams = await prisma.team.findMany({
    where: {
      OR: [
        { shortCode: { startsWith: 'TEST' } },
        { shortCode: { startsWith: 'DEMO' } },
        { shortCode: { startsWith: 'IS-TEST' } },
        { shortCode: { startsWith: 'BS-TEST' } },
        { shortCode: { startsWith: 'IS-DEMO' } },
        { shortCode: { startsWith: 'BS-DEMO' } },
      ],
    },
    include: { members: true },
  });

  if (testTeams.length === 0) {
    console.log('❌ No test teams found to reset');
    return;
  }

  console.log(`📋 Found ${testTeams.length} test teams to reset:`);
  testTeams.forEach((team) => {
    console.log(`   ${team.shortCode} - ${team.name} (${team.attendance})`);
  });
  console.log();

  // Reset team attendance
  await prisma.team.updateMany({
    where: {
      id: { in: testTeams.map((t) => t.id) },
    },
    data: {
      attendance: 'NOT_MARKED',
      checkedInAt: null,
      attendanceNotes: null,
    },
  });

  // Reset all member attendance
  const memberIds = testTeams.flatMap((t) => t.members.map((m) => m.id));
  await prisma.teamMember.updateMany({
    where: {
      id: { in: memberIds },
    },
    data: {
      isPresent: false,
      checkedInAt: null,
    },
  });

  console.log('✅ Successfully reset attendance for all test teams:');
  console.log(`   - ${testTeams.length} teams set to NOT_MARKED`);
  console.log(`   - ${memberIds.length} members set to not present`);
  console.log(`   - All check-in timestamps cleared`);
  console.log();
  console.log('🎯 All test teams are now ready for fresh attendance testing!');
}

resetAttendance()
  .catch((e) => {
    console.error('❌ Reset error:', e.message);
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect().then(() => pool.end()));
