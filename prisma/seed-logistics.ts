/**
 * Seed Logistics Accounts
 * Creates 3 logistics admin accounts for event-day operations.
 *
 * Run: npx tsx prisma/seed-logistics.ts
 *
 * Default credentials (CHANGE IN PRODUCTION):
 *   logistic1@indianext.in / Logistics@123
 *   logistic2@indianext.in / Logistics@123
 *   logistic3@indianext.in / Logistics@123
 */

import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import bcrypt from "bcryptjs";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// ✅ SECURITY FIX: Read seed password from env var instead of hardcoding
const SEED_PASSWORD = process.env.SEED_LOGISTICS_PASSWORD;
if (!SEED_PASSWORD) {
  console.error("❌ SEED_LOGISTICS_PASSWORD environment variable is required.");
  console.error("   Set it in .env: SEED_LOGISTICS_PASSWORD=YourStrongPassword!123");
  process.exit(1);
}

const LOGISTICS_ACCOUNTS = [
  {
    email: "logistic1@indianext.in",
    name: "Logistics Officer 1",
    password: SEED_PASSWORD,
  },
  {
    email: "logistic2@indianext.in",
    name: "Logistics Officer 2",
    password: SEED_PASSWORD,
  },
  {
    email: "logistic3@indianext.in",
    name: "Logistics Officer 3",
    password: SEED_PASSWORD,
  },
];

async function seedLogistics() {
  console.log("🚛 Seeding logistics accounts...\n");

  for (const account of LOGISTICS_ACCOUNTS) {
    const existing = await prisma.admin.findUnique({
      where: { email: account.email },
    });

    if (existing) {
      console.log(`⚠️  ${account.email} already exists (role: ${existing.role}). Skipping.`);
      continue;
    }

    const hashedPassword = await bcrypt.hash(account.password, 12);

    await prisma.admin.create({
      data: {
        email: account.email,
        name: account.name,
        password: hashedPassword,
        role: "LOGISTICS" as any, // LOGISTICS is valid in schema but may not be in generated types yet
        isActive: true,
      },
    });

    console.log(`✅ Created: ${account.email} (role: LOGISTICS)`);
  }

  console.log("\n🎉 Logistics accounts seeded successfully!");
}

seedLogistics()
  .catch((e) => {
    console.error("❌ Seed error:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
