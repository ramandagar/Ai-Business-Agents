// scripts/add-project.ts
// Add a project to Supabase vector store
// Usage: npx ts-node scripts/add-project.ts
import * as dotenv from 'dotenv';
dotenv.config();
import * as readline from 'readline';

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (q: string) => new Promise<string>(res => rl.question(q, res));

async function main() {
  const { kb } = await require('../src/services/knowledgeBase');

  if (!kb.isReady()) {
    console.error('Supabase not configured.');
    process.exit(1);
  }

  console.log('Add a new project to the portfolio:\n');

  const name = await ask('Project name: ');
  const description = await ask('Description: ');
  const cost = parseInt(await ask('Cost (INR, e.g. 250000): ') || '0');
  const timeline = await ask('Timeline (e.g. 10 weeks): ');
  const scope = await ask('Scope: ');
  const impact = await ask('Impact: ');
  const live_url = await ask('Live URL (optional): ');
  const image_url = await ask('Image URL (optional): ');
  const category = await ask('Category (ecommerce/web-app/mobile/other): ') || 'other';
  const tech_stack = (await ask('Tech stack (comma-separated, e.g. React,Node,PostgreSQL): ')).split(',').map(s => s.trim()).filter(Boolean);

  const ok = await kb.addProject({
    name, description, cost, timeline, scope, impact,
    live_url: live_url || undefined,
    image_url: image_url || undefined,
    category,
    tech_stack,
  });

  console.log(ok ? `Project "${name}" added!` : 'Failed to add project.');
  rl.close();
}

main().catch(err => { console.error(err); process.exit(1); });
