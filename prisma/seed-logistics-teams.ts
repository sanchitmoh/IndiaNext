/**
 * seed-logistics-teams.ts
 * Creates 8 demo teams of 4 members each for logistics and attendance testing.
 *
 * Run:  npx tsx prisma/seed-logistics-teams.ts
 *
 * Safe to re-run — cleans up previous demo data first (by shortCode prefix TEST-).
 * All users get emails: test.xxx@indianext.test (won't clash with real participants).
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool as any);
const prisma = new PrismaClient({ adapter });

// ────────────────────────────────────────────────────────────
// Demo data definition - 8 teams for comprehensive testing
// ────────────────────────────────────────────────────────────

const TEST_TEAMS = [
  {
    shortCode: 'IS-TEST1',
    name: 'Alpha Innovators',
    track: 'IDEA_SPRINT' as const,
    college: 'IIT Delhi',
    attendance: 'NOT_MARKED' as const,
    members: [
      {
        name: 'Rahul Gupta',
        email: 'test.rahul@indianext.test',
        role: 'LEADER' as const,
        gender: 'Male',
        year: '3rd',
        branch: 'Computer Science',
        isPresent: false,
      },
      {
        name: 'Kavya Sharma',
        email: 'test.kavya@indianext.test',
        role: 'CO_LEADER' as const,
        gender: 'Female',
        year: '3rd',
        branch: 'Information Technology',
        isPresent: false,
      },
      {
        name: 'Arjun Singh',
        email: 'test.arjun@indianext.test',
        role: 'MEMBER' as const,
        gender: 'Male',
        year: '2nd',
        branch: 'Electronics',
        isPresent: false,
      },
      {
        name: 'Priya Nair',
        email: 'test.priya@indianext.test',
        role: 'MEMBER' as const,
        gender: 'Female',
        year: '2nd',
        branch: 'Computer Science',
        isPresent: false,
      },
    ],
  },
  {
    shortCode: 'BS-TEST2',
    name: 'Beta Builders',
    track: 'BUILD_STORM' as const,
    college: 'IIT Bombay',
    attendance: 'PRESENT' as const,
    members: [
      {
        name: 'Vikram Patel',
        email: 'test.vikram@indianext.test',
        role: 'LEADER' as const,
        gender: 'Male',
        year: '4th',
        branch: 'Computer Science',
        isPresent: true,
      },
      {
        name: 'Ananya Reddy',
        email: 'test.ananya@indianext.test',
        role: 'CO_LEADER' as const,
        gender: 'Female',
        year: '4th',
        branch: 'Data Science',
        isPresent: true,
      },
      {
        name: 'Karan Mehta',
        email: 'test.karan@indianext.test',
        role: 'MEMBER' as const,
        gender: 'Male',
        year: '3rd',
        branch: 'Electrical Engineering',
        isPresent: true,
      },
      {
        name: 'Riya Joshi',
        email: 'test.riya@indianext.test',
        role: 'MEMBER' as const,
        gender: 'Female',
        year: '3rd',
        branch: 'Computer Science',
        isPresent: true,
      },
    ],
  },
  {
    shortCode: 'IS-TEST3',
    name: 'Gamma Creators',
    track: 'IDEA_SPRINT' as const,
    college: 'NIT Trichy',
    attendance: 'PARTIAL' as const,
    members: [
      {
        name: 'Dev Kumar',
        email: 'test.dev@indianext.test',
        role: 'LEADER' as const,
        gender: 'Male',
        year: '3rd',
        branch: 'Computer Science',
        isPresent: true,
      },
      {
        name: 'Sneha Iyer',
        email: 'test.sneha@indianext.test',
        role: 'CO_LEADER' as const,
        gender: 'Female',
        year: '3rd',
        branch: 'Mathematics',
        isPresent: true,
      },
      {
        name: 'Rohit Verma',
        email: 'test.rohit@indianext.test',
        role: 'MEMBER' as const,
        gender: 'Male',
        year: '2nd',
        branch: 'Computer Science',
        isPresent: false,
      },
      {
        name: 'Meera Shah',
        email: 'test.meera@indianext.test',
        role: 'MEMBER' as const,
        gender: 'Female',
        year: '2nd',
        branch: 'Electronics',
        isPresent: false,
      },
    ],
  },
  {
    shortCode: 'BS-TEST4',
    name: 'Delta Developers',
    track: 'BUILD_STORM' as const,
    college: 'BITS Pilani',
    attendance: 'ABSENT' as const,
    members: [
      {
        name: 'Aditya Rao',
        email: 'test.aditya@indianext.test',
        role: 'LEADER' as const,
        gender: 'Male',
        year: '4th',
        branch: 'Computer Science',
        isPresent: false,
      },
      {
        name: 'Pooja Kulkarni',
        email: 'test.pooja@indianext.test',
        role: 'CO_LEADER' as const,
        gender: 'Female',
        year: '4th',
        branch: 'Information Technology',
        isPresent: false,
      },
      {
        name: 'Sanjay Mishra',
        email: 'test.sanjay@indianext.test',
        role: 'MEMBER' as const,
        gender: 'Male',
        year: '3rd',
        branch: 'Mechanical Engineering',
        isPresent: false,
      },
      {
        name: 'Divya Agarwal',
        email: 'test.divya@indianext.test',
        role: 'MEMBER' as const,
        gender: 'Female',
        year: '3rd',
        branch: 'Computer Science',
        isPresent: false,
      },
    ],
  },
  {
    shortCode: 'IS-TEST5',
    name: 'Epsilon Explorers',
    track: 'IDEA_SPRINT' as const,
    college: 'IIT Madras',
    attendance: 'NOT_MARKED' as const,
    members: [
      {
        name: 'Harsh Bansal',
        email: 'test.harsh@indianext.test',
        role: 'LEADER' as const,
        gender: 'Male',
        year: '3rd',
        branch: 'Computer Science',
        isPresent: false,
      },
      {
        name: 'Nisha Gupta',
        email: 'test.nisha@indianext.test',
        role: 'CO_LEADER' as const,
        gender: 'Female',
        year: '3rd',
        branch: 'Data Science',
        isPresent: false,
      },
      {
        name: 'Akash Tiwari',
        email: 'test.akash@indianext.test',
        role: 'MEMBER' as const,
        gender: 'Male',
        year: '2nd',
        branch: 'Electronics',
        isPresent: false,
      },
      {
        name: 'Shreya Pandey',
        email: 'test.shreya@indianext.test',
        role: 'MEMBER' as const,
        gender: 'Female',
        year: '2nd',
        branch: 'Computer Science',
        isPresent: false,
      },
    ],
  },
  {
    shortCode: 'BS-TEST6',
    name: 'Zeta Zealots',
    track: 'BUILD_STORM' as const,
    college: 'NIT Warangal',
    attendance: 'PRESENT' as const,
    members: [
      {
        name: 'Manish Jain',
        email: 'test.manish@indianext.test',
        role: 'LEADER' as const,
        gender: 'Male',
        year: '4th',
        branch: 'Computer Science',
        isPresent: true,
      },
      {
        name: 'Tanvi Saxena',
        email: 'test.tanvi@indianext.test',
        role: 'CO_LEADER' as const,
        gender: 'Female',
        year: '4th',
        branch: 'Information Technology',
        isPresent: true,
      },
      {
        name: 'Nikhil Agrawal',
        email: 'test.nikhil@indianext.test',
        role: 'MEMBER' as const,
        gender: 'Male',
        year: '3rd',
        branch: 'Electrical Engineering',
        isPresent: true,
      },
      {
        name: 'Isha Malhotra',
        email: 'test.isha@indianext.test',
        role: 'MEMBER' as const,
        gender: 'Female',
        year: '3rd',
        branch: 'Computer Science',
        isPresent: true,
      },
    ],
  },
  {
    shortCode: 'IS-TEST7',
    name: 'Eta Engineers',
    track: 'IDEA_SPRINT' as const,
    college: 'IIIT Hyderabad',
    attendance: 'PARTIAL' as const,
    members: [
      {
        name: 'Gaurav Sinha',
        email: 'test.gaurav@indianext.test',
        role: 'LEADER' as const,
        gender: 'Male',
        year: '3rd',
        branch: 'Computer Science',
        isPresent: true,
      },
      {
        name: 'Ritika Chopra',
        email: 'test.ritika@indianext.test',
        role: 'CO_LEADER' as const,
        gender: 'Female',
        year: '3rd',
        branch: 'Electronics',
        isPresent: false,
      },
      {
        name: 'Varun Khanna',
        email: 'test.varun@indianext.test',
        role: 'MEMBER' as const,
        gender: 'Male',
        year: '2nd',
        branch: 'Computer Science',
        isPresent: true,
      },
      {
        name: 'Sakshi Dubey',
        email: 'test.sakshi@indianext.test',
        role: 'MEMBER' as const,
        gender: 'Female',
        year: '2nd',
        branch: 'Information Technology',
        isPresent: false,
      },
    ],
  },
  {
    shortCode: 'BS-TEST8',
    name: 'Theta Titans',
    track: 'BUILD_STORM' as const,
    college: 'DTU Delhi',
    attendance: 'NOT_MARKED' as const,
    members: [
      {
        name: 'Yash Goyal',
        email: 'test.yash@indianext.test',
        role: 'LEADER' as const,
        gender: 'Male',
        year: '4th',
        branch: 'Computer Science',
        isPresent: false,
      },
      {
        name: 'Kriti Sharma',
        email: 'test.kriti@indianext.test',
        role: 'CO_LEADER' as const,
        gender: 'Female',
        year: '4th',
        branch: 'Data Science',
        isPresent: false,
      },
      {
        name: 'Abhishek Modi',
        email: 'test.abhishek@indianext.test',
        role: 'MEMBER' as const,
        gender: 'Male',
        year: '3rd',
        branch: 'Mechanical Engineering',
        isPresent: false,
      },
      {
        name: 'Neha Kapoor',
        email: 'test.neha@indianext.test',
        role: 'MEMBER' as const,
        gender: 'Female',
        year: '3rd',
        branch: 'Computer Science',
        isPresent: false,
      },
    ],
  },
];

// ────────────────────────────────────────────────────────────
// Seed function
// ────────────────────────────────────────────────────────────

async function seedLogisticsTeams() {
  console.log('🌱 Seeding 8 test teams for logistics and attendance testing...\n');

  // ── Step 1: Clean up any previous test data ──────────────────────────────
  const existingTeams = await prisma.team.findMany({
    where: { shortCode: { startsWith: 'TEST' } },
    include: { members: true },
  });

  if (existingTeams.length > 0) {
    console.log('🗑️  Cleaning up existing test teams...');

    // Collect all user IDs from test team members
    const userIds = existingTeams.flatMap((t) => t.members.map((m) => m.userId));

    // Delete TeamMembers first (cascade would do it, but explicit is clearer)
    await prisma.teamMember.deleteMany({
      where: { teamId: { in: existingTeams.map((t) => t.id) } },
    });

    // Delete the teams
    await prisma.team.deleteMany({
      where: { id: { in: existingTeams.map((t) => t.id) } },
    });

    // Delete the test users
    if (userIds.length > 0) {
      await prisma.user.deleteMany({
        where: { id: { in: userIds } },
      });
    }

    console.log('   ✅ Cleaned up previous test data\n');
  }

  // ── Step 2: Create each team ─────────────────────────────────────────────
  for (const teamDef of TEST_TEAMS) {
    console.log(`📦 Creating team: ${teamDef.name} (${teamDef.shortCode})`);

    // Create all 4 users for this team
    const createdUsers = await Promise.all(
      teamDef.members.map((m) =>
        prisma.user.create({
          data: {
            email: m.email,
            name: m.name,
            phone: `+91${Math.floor(7000000000 + Math.random() * 2999999999)}`,
            gender: m.gender,
            college: teamDef.college,
            degree: 'B.Tech',
            year: m.year,
            branch: m.branch,
            emailVerified: true,
          },
        })
      )
    );

    // Pick the leader as the team creator
    const leaderUser = createdUsers[teamDef.members.findIndex((m) => m.role === 'LEADER')];

    // Set check-in time for present teams
    const checkedInAt = teamDef.attendance === 'PRESENT' ? new Date() : null;

    // Create the team
    const team = await prisma.team.create({
      data: {
        shortCode: teamDef.shortCode,
        name: teamDef.name,
        track: teamDef.track,
        status: 'APPROVED',
        size: teamDef.members.length,
        college: teamDef.college,
        attendance: teamDef.attendance,
        checkedInAt,
        attendanceNotes: teamDef.attendance === 'PARTIAL' ? 'Some members present' : undefined,
        hearAbout: 'Test seed',
        createdBy: leaderUser.id,
        // Create all 4 members inline
        members: {
          create: teamDef.members.map((m, i) => ({
            userId: createdUsers[i].id,
            role: m.role,
            isPresent: m.isPresent,
            checkedInAt: m.isPresent ? checkedInAt : null,
          })),
        },
      },
      include: { members: true },
    });

    const attendanceIcon =
      teamDef.attendance === 'PRESENT'
        ? '✅'
        : teamDef.attendance === 'PARTIAL'
          ? '⚠️'
          : teamDef.attendance === 'ABSENT'
            ? '❌'
            : '⏳';

    console.log(`   ${attendanceIcon} ${team.name} — ${team.shortCode} — ${team.attendance}`);
    for (const m of teamDef.members) {
      const roleIcon = m.role === 'LEADER' ? '👑' : m.role === 'CO_LEADER' ? '🥈' : '  ';
      const presentIcon = m.isPresent ? '✅' : '❌';
      console.log(`      ${roleIcon} ${presentIcon} ${m.role.padEnd(10)} ${m.name}`);
    }
    console.log();
  }

  console.log('🎉 Done! 8 test teams seeded with varied attendance states.\n');

  // Summary statistics
  const presentTeams = TEST_TEAMS.filter((t) => t.attendance === 'PRESENT').length;
  const absentTeams = TEST_TEAMS.filter((t) => t.attendance === 'ABSENT').length;
  const partialTeams = TEST_TEAMS.filter((t) => t.attendance === 'PARTIAL').length;
  const notMarkedTeams = TEST_TEAMS.filter((t) => t.attendance === 'NOT_MARKED').length;
  const totalPresentUsers = TEST_TEAMS.reduce(
    (sum, t) => sum + t.members.filter((m) => m.isPresent).length,
    0
  );
  const totalUsers = TEST_TEAMS.length * 4;

  console.log('📊 Attendance Summary:');
  console.log(`   Present Teams: ${presentTeams}`);
  console.log(`   Absent Teams: ${absentTeams}`);
  console.log(`   Partial Teams: ${partialTeams}`);
  console.log(`   Not Marked Teams: ${notMarkedTeams}`);
  console.log(
    `   Present Users: ${totalPresentUsers}/${totalUsers} (${((totalPresentUsers / totalUsers) * 100).toFixed(1)}%)`
  );

  console.log('\n📱 Test QR scan URLs:');
  for (const t of TEST_TEAMS) {
    console.log(`   https://www.indianexthackthon.online/checkin?code=${t.shortCode}`);
  }
  console.log('\n💡 Teams have varied attendance states for comprehensive testing');
  console.log('   Open the admin dashboard to see attendance statistics');
  console.log('   Open the logistics dashboard to test QR scanning and check-in flows\n');
}

seedLogisticsTeams()
  .catch((e) => {
    console.error('❌ Seed error:', e.message);
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect().then(() => pool.end()));
