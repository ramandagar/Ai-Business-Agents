// scripts/seed-supabase.ts
// Run: npx ts-node scripts/seed-supabase.ts
import * as dotenv from 'dotenv';
dotenv.config();

async function main() {
  // Dynamic import to load the module after dotenv
  const { kb } = await require('../src/services/knowledgeBase');

  if (!kb.isReady()) {
    console.error('Supabase not configured. Set SUPABASE_URL and SUPABASE_KEY in .env');
    process.exit(1);
  }

  console.log('Seeding Supabase from pricing.json...');
  const result = await kb.seedFromPricing();
  console.log(`Done! Seeded ${result.services} services and ${result.projects} projects.`);
}

main().catch(err => {
  console.error('Seed failed:', err);
  process.exit(1);
});
