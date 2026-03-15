/**
 * seed-demo-teams.ts
 * Creates 3 demo teams of 4 members each for QR scan flow testing.
 *
 * Run:  npx tsx prisma/seed-demo-teams.ts
 *
 * Safe to re-run — cleans up previous demo data first (by shortCode prefix DEMO-).
 * All users get emails: demo.xxx@indianext.test (won't clash with real participants).
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool as any);
const prisma = new PrismaClient({ adapter });

// ────────────────────────────────────────────────────────────
// Demo data definition
// ────────────────────────────────────────────────────────────

const DEMO_TEAMS = [
  {
    shortCode: 'IS-DEMO1',
    name: 'Team Quantum',
    track: 'IDEA_SPRINT' as const,
    college: 'IIT Bombay',
    members: [
      { name: 'Arjun Sharma',   email: 'demo.arjun@indianext.test',   role: 'LEADER' as const, gender: 'Male',   year: '3rd', branch: 'Computer Science' },
      { name: 'Priya Nair',     email: 'demo.priya@indianext.test',    role: 'CO_LEADER' as const, gender: 'Female', year: '3rd', branch: 'Information Technology' },
      { name: 'Rohit Verma',    email: 'demo.rohit@indianext.test',    role: 'MEMBER' as const, gender: 'Male',   year: '2nd', branch: 'Electronics' },
      { name: 'Sneha Iyer',     email: 'demo.sneha@indianext.test',    role: 'MEMBER' as const, gender: 'Female', year: '2nd', branch: 'Computer Science' },
    ],
  },
  {
    shortCode: 'BS-DEMO2',
    name: 'NexGen Builders',
    track: 'BUILD_STORM' as const,
    college: 'NIT Trichy',
    members: [
      { name: 'Karan Mehta',    email: 'demo.karan@indianext.test',    role: 'LEADER' as const, gender: 'Male',   year: '4th', branch: 'Computer Science' },
      { name: 'Ananya Singh',   email: 'demo.ananya@indianext.test',   role: 'CO_LEADER' as const, gender: 'Female', year: '4th', branch: 'Data Science' },
      { name: 'Dev Patel',      email: 'demo.dev@indianext.test',      role: 'MEMBER' as const, gender: 'Male',   year: '3rd', branch: 'Electrical Engineering' },
      { name: 'Riya Kulkarni',  email: 'demo.riya@indianext.test',     role: 'MEMBER' as const, gender: 'Female', year: '3rd', branch: 'Computer Science' },
    ],
  },
  {
    shortCode: 'IS-DEMO3',
    name: 'Innovate Squad',
    track: 'IDEA_SPRINT' as const,
    college: 'BITS Pilani',
    members: [
      { name: 'Vikram Rao',     email: 'demo.vikram@indianext.test',   role: 'LEADER' as const, gender: 'Male',   year: '3rd', branch: 'Computer Science' },
      { name: 'Meera Joshi',    email: 'demo.meera@indianext.test',    role: 'CO_LEADER' as const, gender: 'Female', year: '3rd', branch: 'Mathematics' },
      { name: 'Aditya Kumar',   email: 'demo.aditya@indianext.test',   role: 'MEMBER' as const, gender: 'Male',   year: '2nd', branch: 'Computer Science' },
      { name: 'Pooja Reddy',    email: 'demo.pooja@indianext.test',    role: 'MEMBER' as const, gender: 'Female', year: '2nd', branch: 'Electronics' },
    ],
  },
];

// ────────────────────────────────────────────────────────────
// Seed function
// ────────────────────────────────────────────────────────────

async function seedDemoTeams() {
  console.log('🌱 Seeding 3 demo teams for QR flow testing...\n');

  // ── Step 1: Clean up any previous demo data ──────────────────────────────
  const existingTeams = await prisma.team.findMany({
    where: { shortCode: { in: DEMO_TEAMS.map((t) => t.shortCode) } },
    include: { members: true },
  });

  if (existingTeams.length > 0) {
    console.log('🗑️  Cleaning up existing demo teams...');

    // Collect all user IDs from demo team members
    const userIds = existingTeams.flatMap((t) => t.members.map((m) => m.userId));

    // Delete TeamMembers first (cascade would do it, but explicit is clearer)
    await prisma.teamMember.deleteMany({
      where: { teamId: { in: existingTeams.map((t) => t.id) } },
    });

    // Delete the teams
    await prisma.team.deleteMany({
      where: { id: { in: existingTeams.map((t) => t.id) } },
    });

    // Delete the demo users
    if (userIds.length > 0) {
      await prisma.user.deleteMany({
        where: { id: { in: userIds } },
      });
    }

    console.log('   ✅ Cleaned up previous demo data\n');
  }

  // ── Step 2: Create each team ─────────────────────────────────────────────
  for (const teamDef of DEMO_TEAMS) {
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

    // Create the team
    const team = await prisma.team.create({
      data: {
        shortCode: teamDef.shortCode,
        name: teamDef.name,
        track: teamDef.track,
        status: 'APPROVED',
        size: teamDef.members.length,
        college: teamDef.college,
        attendance: 'NOT_MARKED',
        hearAbout: 'Demo seed',
        createdBy: leaderUser.id,
        // Create all 4 members inline
        members: {
          create: teamDef.members.map((m, i) => ({
            userId: createdUsers[i].id,
            role: m.role,
          })),
        },
      },
      include: { members: true },
    });

    console.log(`   ✅ ${team.name} — ${team.shortCode} — ${team.members.length} members`);
    for (const m of teamDef.members) {
      const icon = m.role === 'LEADER' ? '👑' : m.role === 'CO_LEADER' ? '🥈' : '  ';
      console.log(`      ${icon} ${m.role.padEnd(10)} ${m.name} (${m.email})`);
    }
    console.log();
  }

  console.log('🎉 Done! 3 demo teams seeded.\n');
  console.log('📱 Test QR scan URLs:');
  for (const t of DEMO_TEAMS) {
    console.log(`   https://www.indianexthackthon.online/checkin?code=${t.shortCode}`);
  }
  console.log('\n💡 All teams have status=APPROVED and attendance=NOT_MARKED');
  console.log('   Open the logistics dashboard to see them, or scan the URLs above on mobile.\n');
}

seedDemoTeams()
  .catch((e) => {
    console.error('❌ Seed error:', e.message);
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect().then(() => pool.end()));
