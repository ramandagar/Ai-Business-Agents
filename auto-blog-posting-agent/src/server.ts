import express from 'express';
import cors from 'cors';
import path from 'path';
import { v4 as uuid } from 'uuid';
import dotenv from 'dotenv';
import http from 'http';

dotenv.config();

import { SiteConfig, BlogType, GenerationRequest } from './types';
import {
  saveSiteConfig, loadSiteConfig, loadAllSites, deleteSiteConfig,
  loadBlogPosts, loadBlogPost, updateBlogPost, deleteBlogPost,
  getSiteAnalytics,
} from './services/data-store';
import { generateBlogPostGraph } from './engine/graph';
import { researchTopics } from './engine/topic-researcher';
import { knowledgeBase } from './rag/knowledge-base';
import {
  initializeAllSchedules, startSchedule, stopSchedule,
  getScheduleStatus, updateSchedule, stopAllSchedules,
} from './scheduler/cron-manager';
import { crawlSite } from './services/site-crawler';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, '../public')));

function asyncHandler(
  fn: (req: express.Request, res: express.Response, next: express.NextFunction) => Promise<any>,
) {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

// ── Site Management ──

app.post('/api/sites/register', asyncHandler(async (req, res) => {
  let {
    name, url, niche, targetAudience, brandVoice,
    systemPrompt, schedule, autoPublish, includeImages,
    internalLinking, blogType, keywords, restrictions,
  } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'Site name is required' });
  }

  // If "niche" looks like a URL, treat it as the URL
  if (!url && niche && (niche.includes('http') || niche.includes('.com') || niche.includes('.co') || niche.includes('.io') || niche.includes('.org'))) {
    url = niche;
    niche = '';
  }

  const site: SiteConfig = {
    id: uuid(),
    name: name || 'My Blog',
    url: url || '',
    niche: niche || 'general',
    targetAudience: targetAudience || 'general audience',
    brandVoice: brandVoice || 'professional and friendly',
    systemPrompt: systemPrompt || '',
    schedule: schedule || '0 9 * * *',
    autoPublish: autoPublish || false,
    includeImages: includeImages !== false,
    internalLinking: internalLinking !== false,
    blogType: (blogType as BlogType) || 'educational',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    keywords: keywords || [],
    restrictions: restrictions || [],
  };

  let crawlResult = null;
  if (site.url) {
    try {
      console.log(`Crawling ${site.url} for site "${site.name}"...`);
      crawlResult = await crawlSite(site.url);

      if (!niche || niche === 'general') site.niche = crawlResult.niche;
      if (!targetAudience || targetAudience === 'general audience') site.targetAudience = crawlResult.targetAudience;
      if (!systemPrompt) site.systemPrompt = crawlResult.systemPrompt;
      if (!keywords || keywords.length === 0) site.keywords = crawlResult.keywords;
    } catch (crawlError) {
      console.warn(`   Crawl failed (non-blocking): ${(crawlError as Error).message}`);
    }
  }

  await saveSiteConfig(site);
  await knowledgeBase.initializeSite(site.id);

  if (crawlResult) {
    const crawlContent = [
      `Site Overview: ${crawlResult.siteSummary}`,
      `Key Features: ${crawlResult.keyFeatures.join(', ')}`,
      `Target Audience: ${crawlResult.targetAudience}`,
    ].join('\n');

    await knowledgeBase.addCustomKnowledge(site.id, 'site-overview', `${site.name} Website Overview`, crawlContent);
    console.log(`   Crawl results stored in RAG for "${site.name}"`);
  }

  if (site.schedule) {
    startSchedule(site);
  }

  console.log(`Site registered: "${site.name}" (${site.id})`);
  res.status(201).json({ success: true, site, crawlResult });
}));

app.get('/api/sites', asyncHandler(async (req, res) => {
  const sites = await loadAllSites();
  res.json({ sites });
}));

app.get('/api/sites/:id', asyncHandler(async (req, res) => {
  const site = await loadSiteConfig(req.params.id);
  if (!site) return res.status(404).json({ error: 'Site not found' });
  res.json({ site });
}));

app.put('/api/sites/:id/config', asyncHandler(async (req, res) => {
  const site = await loadSiteConfig(req.params.id);
  if (!site) return res.status(404).json({ error: 'Site not found' });

  const updated: SiteConfig = {
    ...site,
    ...req.body,
    id: site.id,
    createdAt: site.createdAt,
    updatedAt: new Date().toISOString(),
  };

  await saveSiteConfig(updated);

  if (req.body.schedule && req.body.schedule !== site.schedule) {
    await updateSchedule(site.id, req.body.schedule);
  }

  res.json({ success: true, site: updated });
}));

app.delete('/api/sites/:id', asyncHandler(async (req, res) => {
  stopSchedule(req.params.id);
  const deleted = await deleteSiteConfig(req.params.id);
  if (!deleted) return res.status(404).json({ error: 'Site not found' });
  res.json({ success: true });
}));

// ── Blog Generation ──

app.post('/api/sites/:id/generate', asyncHandler(async (req, res) => {
  const site = await loadSiteConfig(req.params.id);
  if (!site) return res.status(404).json({ error: 'Site not found' });

  if (!site.url && !site.systemPrompt && (!site.niche || site.niche === 'general')) {
    return res.status(400).json({
      error: 'Site not configured',
      details: 'Please add a website URL or configure the site niche before generating posts.',
    });
  }

  const request: GenerationRequest = {
    siteId: req.params.id,
    topic: req.body.topic,
    blogType: req.body.blogType,
    includeImages: req.body.includeImages,
    customPrompt: req.body.customPrompt,
    exploreDifferent: req.body.exploreDifferent ?? false,
  };

  console.log(`Manual blog generation triggered for "${site.name}"`);

  const post = await generateBlogPostGraph(request);
  res.json({ success: true, post });
}));

// SSE streaming endpoint for blog generation
app.post('/api/sites/:id/generate/stream', asyncHandler(async (req, res) => {
  const site = await loadSiteConfig(req.params.id);
  if (!site) return res.status(404).json({ error: 'Site not found' });

  if (!site.url && !site.systemPrompt && (!site.niche || site.niche === 'general')) {
    return res.status(400).json({ error: 'Site not configured' });
  }

  const request: GenerationRequest = {
    siteId: req.params.id,
    topic: req.body.topic,
    blogType: req.body.blogType,
    includeImages: req.body.includeImages,
    customPrompt: req.body.customPrompt,
    exploreDifferent: req.body.exploreDifferent ?? false,
  };

  console.log(`SSE blog generation triggered for "${site.name}"`);

  // SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  const sendSSE = (event: string, data: any) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  const onProgress = (stage: string, message: string, step: number, total: number) => {
    sendSSE('progress', { stage, message, step, total });
  };

  try {
    const post = await generateBlogPostGraph(request, onProgress);
    // Send lightweight complete — don't embed base64 images in SSE
    sendSSE('complete', {
      id: post.id,
      title: post.title,
      slug: post.slug,
      wordCount: post.wordCount,
      status: post.status,
      seoScore: post.seoScore,
    });
  } catch (err: any) {
    sendSSE('error', { error: err.message });
  } finally {
    res.end();
  }
}));

app.get('/api/sites/:id/topics', asyncHandler(async (req, res) => {
  const site = await loadSiteConfig(req.params.id);
  if (!site) return res.status(404).json({ error: 'Site not found' });

  const count = parseInt(req.query.count as string) || 5;
  const topics = await researchTopics(site, count);
  res.json({ topics });
}));

// ── Blog Posts ──

app.get('/api/sites/:id/posts', asyncHandler(async (req, res) => {
  const posts = await loadBlogPosts(req.params.id);

  const lightPosts = posts.map(p => ({
    id: p.id,
    title: p.title,
    slug: p.slug,
    excerpt: p.excerpt,
    status: p.status,
    seoScore: p.seoScore.overall,
    wordCount: p.wordCount,
    tags: p.tags,
    category: p.category,
    createdAt: p.createdAt,
    publishedAt: p.publishedAt,
    images: p.images.length,
  }));

  res.json({ posts: lightPosts, total: lightPosts.length });
}));

app.get('/api/sites/:siteId/posts/:postId', asyncHandler(async (req, res) => {
  const post = await loadBlogPost(req.params.siteId, req.params.postId);
  if (!post) return res.status(404).json({ error: 'Post not found' });
  res.json({ post });
}));

app.put('/api/sites/:siteId/posts/:postId', asyncHandler(async (req, res) => {
  const updated = await updateBlogPost(req.params.siteId, req.params.postId, req.body);
  if (!updated) return res.status(404).json({ error: 'Post not found' });
  res.json({ success: true, post: updated });
}));

app.post('/api/sites/:siteId/posts/:postId/publish', asyncHandler(async (req, res) => {
  const updated = await updateBlogPost(req.params.siteId, req.params.postId, {
    status: 'published',
    publishedAt: new Date().toISOString(),
  });
  if (!updated) return res.status(404).json({ error: 'Post not found' });
  res.json({ success: true, post: updated });
}));

app.delete('/api/sites/:siteId/posts/:postId', asyncHandler(async (req, res) => {
  const deleted = await deleteBlogPost(req.params.siteId, req.params.postId);
  if (!deleted) return res.status(404).json({ error: 'Post not found' });
  res.json({ success: true });
}));

// ── Knowledge Base ──

app.post('/api/sites/:id/knowledge', asyncHandler(async (req, res) => {
  const { type, title, content } = req.body;
  if (!title || !content) {
    return res.status(400).json({ error: 'Title and content are required' });
  }

  const entryId = await knowledgeBase.addCustomKnowledge(
    req.params.id,
    type || 'custom',
    title,
    content,
  );

  res.json({ success: true, entryId });
}));

app.get('/api/sites/:id/knowledge', asyncHandler(async (req, res) => {
  const entries = await knowledgeBase.listKnowledge(req.params.id);
  res.json({ entries, total: entries.length });
}));

app.delete('/api/sites/:id/knowledge/:entryId', asyncHandler(async (req, res) => {
  const deleted = await knowledgeBase.deleteKnowledge(req.params.id, req.params.entryId);
  if (!deleted) return res.status(404).json({ error: 'Entry not found' });
  res.json({ success: true });
}));

// ── Scheduling ──

app.put('/api/sites/:id/schedule', asyncHandler(async (req, res) => {
  const { cronExpression, enabled, schedule, autoPublish } = req.body;
  const siteId = req.params.id;
  const site = await loadSiteConfig(siteId);
  if (!site) return res.status(404).json({ error: 'Site not found' });

  const cronVal = schedule ?? cronExpression ?? '';

  if (enabled === false || cronVal === '') {
    stopSchedule(siteId);
    site.schedule = '';
    if (autoPublish !== undefined) site.autoPublish = autoPublish;
    site.updatedAt = new Date().toISOString();
    await saveSiteConfig(site);
    return res.json({ success: true, message: 'Schedule stopped' });
  }

  if (autoPublish !== undefined) site.autoPublish = autoPublish;
  site.schedule = cronVal;
  site.updatedAt = new Date().toISOString();
  await saveSiteConfig(site);

  const success = await updateSchedule(siteId, cronVal);
  if (!success) {
    startSchedule(site);
  }

  res.json({ success: true, message: `Schedule updated to: ${cronVal}` });
}));

app.get('/api/schedules', (req, res) => {
  const schedules = getScheduleStatus();
  res.json({ schedules });
});

// ── Analytics ──

app.get('/api/sites/:id/analytics', asyncHandler(async (req, res) => {
  const analytics = await getSiteAnalytics(req.params.id);
  res.json({ analytics });
}));

// ── Embeddable Widget ──

app.get('/api/widget/:siteId/posts', asyncHandler(async (req, res) => {
  const posts = await loadBlogPosts(req.params.siteId);
  const published = posts
    .filter(p => p.status === 'published')
    .map(p => ({
      id: p.id,
      title: p.title,
      slug: p.slug,
      excerpt: p.excerpt,
      content: p.content,
      metaTitle: p.metaTitle,
      metaDescription: p.metaDescription,
      tags: p.tags,
      category: p.category,
      featuredImage: p.images.find(i => i.position === 'hero'),
      images: p.images,
      wordCount: p.wordCount,
      estimatedReadTime: p.estimatedReadTime,
      schemaMarkup: p.schemaMarkup,
      publishedAt: p.publishedAt,
    }));

  res.json({ posts: published });
}));

app.get('/api/widget/:siteId/posts/:slug', asyncHandler(async (req, res) => {
  const posts = await loadBlogPosts(req.params.siteId);
  const post = posts.find(p => p.slug === req.params.slug && p.status === 'published');

  if (!post) return res.status(404).json({ error: 'Post not found' });

  res.json({
    post: {
      ...post,
      featuredImage: post.images.find(i => i.position === 'hero'),
    },
  });
}));

// ── Health ──

app.get('/api/health', asyncHandler(async (req, res) => {
  const sites = await loadAllSites();
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    schedules: getScheduleStatus().length,
    sites: sites.length,
  });
}));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/dashboard.html'));
});

// Global error handler
app.use((err: Error, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// ── Start Server ──

const server = app.listen(PORT, async () => {
  console.log(`
Auto Blog Agent v1.0
Server running on http://localhost:${PORT}

API:
  POST /api/sites/register     Register a website
  POST /api/sites/:id/generate Generate a blog post
  GET  /api/sites/:id/posts    List all posts
  GET  /api/sites/:id/topics   Research topics
  `);

  const sites = await loadAllSites();
  for (const site of sites) {
    try {
      await knowledgeBase.initializeSite(site.id);
    } catch (e) {
      console.error(`Failed to init knowledge for site ${site.name}:`, e);
    }
  }

  await initializeAllSchedules();
});

function gracefulShutdown() {
  console.log('\nShutting down...');
  stopAllSchedules();
  server.close(() => {
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 5000);
}

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

export default app;
