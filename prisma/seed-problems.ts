import 'dotenv/config';
import { prisma } from '../lib/prisma';

/**
 * Seed script for Rotating Problem Statements (BuildStorm track)
 *
 * Run: npx tsx prisma/seed-problems.ts
 *
 * This creates 10 problem statements, each allowing 30 teams.
 * The first one is marked as `isCurrent = true` to kick off rotation.
 * Total capacity: 300 teams (10 problems × 30 submissions each).
 */
const PROBLEM_STATEMENTS = [
  {
    order: 1,
    title: 'Disaster Response Coordination',
    objective:
      'Build a real-time, offline-first system to connect flood victims with local rescue teams.',
    description:
      'During natural disasters, communication infrastructure often fails. Build a system that works offline, syncs when connectivity is restored, and helps coordinate rescue operations with location tracking.',
  },
  {
    order: 2,
    title: 'Rural Healthcare Access',
    objective:
      'Create a telemedicine platform that enables remote diagnosis and prescription for underserved rural communities.',
    description:
      'Many rural areas lack access to qualified healthcare professionals. Build a platform that connects patients with doctors via low-bandwidth video, supports AI-assisted preliminary diagnosis, and manages digital prescriptions.',
  },
  {
    order: 3,
    title: 'Smart Waste Management',
    objective:
      'Design an IoT-integrated system to optimize municipal waste collection routes and promote recycling.',
    description:
      'Urban waste management is inefficient. Build a system that uses sensor data to optimize collection schedules, tracks fill levels of bins, gamifies recycling for citizens, and provides analytics for municipal authorities.',
  },
  {
    order: 4,
    title: 'Student Mental Health Support',
    objective:
      'Build an AI-powered platform that provides early detection of mental health issues and connects students with counselors.',
    description:
      'Mental health among students is a growing concern. Create a platform that uses journaling, mood tracking, and AI analysis to identify early warning signs, while maintaining privacy and providing peer support features.',
  },
  {
    order: 5,
    title: 'Agricultural Supply Chain',
    objective:
      'Create a transparent marketplace connecting farmers directly with consumers, eliminating middlemen exploitation.',
    description:
      'Farmers often receive unfair prices due to middlemen. Build a blockchain-backed marketplace with quality verification, fair pricing algorithms, logistics coordination, and real-time market price visibility.',
  },
  {
    order: 6,
    title: 'Accessible Education for Differently-Abled',
    objective:
      'Build an adaptive learning platform that customizes content delivery for students with visual, hearing, or motor disabilities.',
    description:
      'Educational platforms rarely cater to differently-abled students. Create a system with multi-modal content delivery (text-to-speech, sign language, gesture controls), adaptive UI, and personalized learning paths.',
  },
  {
    order: 7,
    title: 'Water Quality Monitoring Network',
    objective:
      'Design a distributed sensor network and dashboard for real-time monitoring of water quality in urban water supply systems.',
    description:
      'Contaminated water affects millions. Build a system combining IoT sensors, machine learning for anomaly detection, citizen reporting, and automated alerts to local authorities when contamination is detected.',
  },
  {
    order: 8,
    title: 'Elderly Care Companion',
    objective:
      'Create an intelligent companion system that monitors elderly health vitals, medication schedules, and provides emergency assistance.',
    description:
      'The aging population needs better care solutions. Build a wearable-integrated system with fall detection, medication reminders, health trend analysis, family dashboard, and one-tap emergency services integration.',
  },
  {
    order: 9,
    title: 'Sustainable Energy Marketplace',
    objective:
      'Build a peer-to-peer renewable energy trading platform for residential solar panel owners to sell excess energy.',
    description:
      'Many rooftop solar owners produce excess energy that goes unused. Create a marketplace with smart metering integration, automated pricing, regulatory compliance tracking, and community energy sharing features.',
  },
  {
    order: 10,
    title: 'Traffic Congestion Predictor',
    objective:
      'Develop an AI system that predicts traffic congestion 30 minutes ahead and suggests optimal re-routing for city commuters.',
    description:
      'Traffic congestion wastes millions of hours. Build a system using historical data, real-time feeds, event calendars, and weather data to predict congestion patterns and proactively suggest alternative routes.',
  },
];

async function main() {
  console.log('🌱 Seeding problem statements...\n');

  for (const ps of PROBLEM_STATEMENTS) {
    const existing = await prisma.problemStatement.findFirst({
      where: { order: ps.order },
    });

    if (existing) {
      console.log(
        `  ⏭  Problem #${ps.order} already exists: "${existing.title}" (${existing.submissionCount}/${existing.maxSubmissions} submissions)`
      );
      continue;
    }

    await prisma.problemStatement.create({
      data: {
        ...ps,
        maxSubmissions: 30,
        isActive: true,
        isCurrent: ps.order === 1, // First problem is active by default
      },
    });
    console.log(
      `  ✅ Created Problem #${ps.order}: "${ps.title}"${ps.order === 1 ? ' [CURRENT]' : ''}`
    );
  }

  console.log('\n✅ Done! Problem statements seeded successfully.');
  console.log(`   Total problems: ${PROBLEM_STATEMENTS.length}`);
  console.log(
    `   Total capacity: ${PROBLEM_STATEMENTS.length * 30} teams (${PROBLEM_STATEMENTS.length} × 30)\n`
  );
}

main()
  .catch((e) => {
    console.error('❌ Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
