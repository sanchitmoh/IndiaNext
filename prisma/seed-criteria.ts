/**
 * Seed Scoring Criteria for Both Tracks
 *
 * IdeaSprint Criteria:
 * - Innovation & Creativity (25%)
 * - Feasibility & Viability (20%)
 * - Impact & Value (25%)
 * - Market Potential (15%)
 * - Presentation Quality (15%)
 *
 * BuildStorm Criteria:
 * - Technical Excellence (30%)
 * - Functionality & Features (25%)
 * - Innovation & Creativity (20%)
 * - UI/UX Design (15%)
 * - Completion & Polish (10%)
 */

import 'dotenv/config';
import { prisma } from '../lib/prisma';

const ideaSprintCriteria = [
  {
    criterionId: 'innovation',
    name: 'Innovation & Creativity',
    description:
      'Originality of the idea, creative approach to solving the problem, uniqueness compared to existing solutions',
    weight: 25,
    maxPoints: 10,
    order: 1,
  },
  {
    criterionId: 'feasibility',
    name: 'Feasibility & Viability',
    description:
      'Practicality of implementation, resource requirements, technical feasibility, business viability',
    weight: 20,
    maxPoints: 10,
    order: 2,
  },
  {
    criterionId: 'impact',
    name: 'Impact & Value',
    description: 'Potential impact on target users, social/economic value, scalability of impact',
    weight: 25,
    maxPoints: 10,
    order: 3,
  },
  {
    criterionId: 'market',
    name: 'Market Potential',
    description: 'Market size, competitive advantage, monetization strategy, growth potential',
    weight: 15,
    maxPoints: 10,
    order: 4,
  },
  {
    criterionId: 'presentation',
    name: 'Presentation Quality',
    description:
      'Clarity of pitch, quality of documentation, visual presentation, communication effectiveness',
    weight: 15,
    maxPoints: 10,
    order: 5,
  },
];

const buildStormCriteria = [
  {
    criterionId: 'technical',
    name: 'Technical Excellence',
    description:
      'Code quality, architecture design, use of best practices, technical complexity, performance optimization',
    weight: 30,
    maxPoints: 10,
    order: 1,
  },
  {
    criterionId: 'functionality',
    name: 'Functionality & Features',
    description: 'Feature completeness, functionality depth, error handling, edge case coverage',
    weight: 25,
    maxPoints: 10,
    order: 2,
  },
  {
    criterionId: 'innovation',
    name: 'Innovation & Creativity',
    description:
      'Novel technical approaches, creative problem-solving, unique features or implementations',
    weight: 20,
    maxPoints: 10,
    order: 3,
  },
  {
    criterionId: 'uiux',
    name: 'UI/UX Design',
    description:
      'User interface design, user experience, accessibility, responsiveness, visual appeal',
    weight: 15,
    maxPoints: 10,
    order: 4,
  },
  {
    criterionId: 'completion',
    name: 'Completion & Polish',
    description:
      'Project completeness, attention to detail, documentation quality, deployment readiness',
    weight: 10,
    maxPoints: 10,
    order: 5,
  },
];

async function seedCriteria() {
  console.log('🌱 Seeding scoring criteria...');

  // Seed IdeaSprint criteria
  for (const criterion of ideaSprintCriteria) {
    await prisma.scoringCriterion.upsert({
      where: {
        track_criterionId: {
          track: 'IDEA_SPRINT',
          criterionId: criterion.criterionId,
        },
      },
      update: {
        name: criterion.name,
        description: criterion.description,
        weight: criterion.weight,
        maxPoints: criterion.maxPoints,
        order: criterion.order,
      },
      create: {
        track: 'IDEA_SPRINT',
        ...criterion,
      },
    });
  }

  console.log(`✅ Seeded ${ideaSprintCriteria.length} IdeaSprint criteria`);

  // Seed BuildStorm criteria
  for (const criterion of buildStormCriteria) {
    await prisma.scoringCriterion.upsert({
      where: {
        track_criterionId: {
          track: 'BUILD_STORM',
          criterionId: criterion.criterionId,
        },
      },
      update: {
        name: criterion.name,
        description: criterion.description,
        weight: criterion.weight,
        maxPoints: criterion.maxPoints,
        order: criterion.order,
      },
      create: {
        track: 'BUILD_STORM',
        ...criterion,
      },
    });
  }

  console.log(`✅ Seeded ${buildStormCriteria.length} BuildStorm criteria`);

  // Verify totals
  const ideaSprintTotal = ideaSprintCriteria.reduce((sum, c) => sum + c.weight, 0);
  const buildStormTotal = buildStormCriteria.reduce((sum, c) => sum + c.weight, 0);

  console.log(`\n📊 Weight Totals:`);
  console.log(`   IdeaSprint: ${ideaSprintTotal}%`);
  console.log(`   BuildStorm: ${buildStormTotal}%`);

  if (ideaSprintTotal !== 100 || buildStormTotal !== 100) {
    console.warn('⚠️  Warning: Weights do not sum to 100%');
  }
}

seedCriteria()
  .catch((e) => {
    console.error('❌ Error seeding criteria:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
