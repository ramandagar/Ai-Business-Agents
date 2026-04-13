import axios from 'axios';

const API = 'http://localhost:3001/api';

async function seed() {
  console.log('🌱 Seeding demo data for Auto Blog Agent...');

  try {
    // 1. Register a Demo Site
    const siteResponse = await axios.post(`${API}/sites/register`, {
      name: 'Future Pulse Tech',
      url: 'https://futurepulse.tech',
      niche: 'Cutting-edge technology, AI, and Future Trends',
      targetAudience: 'Tech enthusiasts, developers, and CTOs',
      brandVoice: 'Professional, forward-thinking, and insightful',
      keywords: ['AI', 'Quantum Computing', 'Future of Work', 'Automation'],
      blogType: 'educational',
      schedule: '0 9 * * *',
      includeImages: true,
      internalLinking: true
    });

    const site = siteResponse.data.site;
    console.log(`✅ Registered Site: ${site.name} (${site.id})`);

    // 2. Add some initial Knowledge (About Page)
    await axios.post(`${API}/sites/${site.id}/knowledge`, {
      title: 'About Future Pulse',
      type: 'about_page',
      content: 'Future Pulse is a leading publication dedicated to exploring the intersection of technology and humanity. We focus on AI, robotics, and the digital transformation of industries. Our mission is to provide deep insights into how technology will shape our world in the next decade.'
    });
    console.log('✅ Added "About" page to Knowledge Base');

    // 3. Add a "Manual" past post to seed the RAG
    await axios.post(`${API}/sites/${site.id}/knowledge`, {
      title: 'The Rise of Generative AI',
      type: 'previous_post',
      content: 'Generative AI has taken the world by storm in 2024. From LLMs to image generation, the ability for machines to create content is transforming creative industries. However, ethical considerations remain at the forefront of the discussion...'
    });
    console.log('✅ Added previous post to Knowledge Base (for RAG context)');

    console.log('\n🚀 Demo setup complete!');
    console.log(`\nView your dashboard at: http://localhost:3001`);
    console.log(`Select the site "Future Pulse Tech" to start generating posts.`);

  } catch (error: any) {
    console.error('Seeding failed:', error.message);
    if (error.response) console.error(error.response.data);
  }
}

seed();
