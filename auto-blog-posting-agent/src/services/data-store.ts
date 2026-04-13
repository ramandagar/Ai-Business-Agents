import fs from 'fs/promises';
import path from 'path';
import { SiteConfig, BlogPost, SiteAnalytics } from '../types';

const DATA_DIR = path.join(__dirname, '../../data/sites');

function safeJsonParse<T>(text: string, fallback: T): T {
  try {
    return JSON.parse(text) as T;
  } catch (e) {
    console.warn(`[data-store] JSON parse error: ${(e as Error).message}`);
    return fallback;
  }
}

async function ensureDir(dir: string): Promise<void> {
  await fs.mkdir(dir, { recursive: true });
}

async function pathExists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

// ── Site Config ──

export async function saveSiteConfig(site: SiteConfig): Promise<void> {
  const siteDir = path.join(DATA_DIR, site.id);
  await ensureDir(siteDir);
  await fs.writeFile(
    path.join(siteDir, 'config.json'),
    JSON.stringify(site, null, 2),
  );
}

export async function loadSiteConfig(siteId: string): Promise<SiteConfig | null> {
  const configPath = path.join(DATA_DIR, siteId, 'config.json');
  if (!(await pathExists(configPath))) return null;
  const data = await fs.readFile(configPath, 'utf-8');
  return safeJsonParse<SiteConfig | null>(data, null);
}

export async function loadAllSites(): Promise<SiteConfig[]> {
  if (!(await pathExists(DATA_DIR))) return [];

  const entries = await fs.readdir(DATA_DIR, { withFileTypes: true });
  const sites: SiteConfig[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const configPath = path.join(DATA_DIR, entry.name, 'config.json');
    if (!(await pathExists(configPath))) continue;
    const data = await fs.readFile(configPath, 'utf-8');
    const site = safeJsonParse<SiteConfig | null>(data, null);
    if (site) sites.push(site);
  }

  return sites;
}

export async function deleteSiteConfig(siteId: string): Promise<boolean> {
  const siteDir = path.join(DATA_DIR, siteId);
  if (!(await pathExists(siteDir))) return false;
  await fs.rm(siteDir, { recursive: true });
  return true;
}

// ── Blog Posts ──

export async function saveBlogPost(siteId: string, post: BlogPost): Promise<void> {
  const postsDir = path.join(DATA_DIR, siteId, 'posts');
  await ensureDir(postsDir);
  await fs.writeFile(
    path.join(postsDir, `${post.id}.json`),
    JSON.stringify(post, null, 2),
  );
}

export async function loadBlogPost(siteId: string, postId: string): Promise<BlogPost | null> {
  const postPath = path.join(DATA_DIR, siteId, 'posts', `${postId}.json`);
  if (!(await pathExists(postPath))) return null;
  const data = await fs.readFile(postPath, 'utf-8');
  return safeJsonParse<BlogPost | null>(data, null);
}

export async function loadBlogPosts(siteId: string): Promise<BlogPost[]> {
  const postsDir = path.join(DATA_DIR, siteId, 'posts');
  if (!(await pathExists(postsDir))) return [];

  const files = (await fs.readdir(postsDir)).filter(f => f.endsWith('.json'));
  const posts: BlogPost[] = [];

  for (const f of files) {
    const data = await fs.readFile(path.join(postsDir, f), 'utf-8');
    const post = safeJsonParse<BlogPost | null>(data, null);
    if (post) posts.push(post);
  }

  return posts.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export async function updateBlogPost(siteId: string, postId: string, updates: Partial<BlogPost>): Promise<BlogPost | null> {
  const post = await loadBlogPost(siteId, postId);
  if (!post) return null;

  const updated = { ...post, ...updates };
  await saveBlogPost(siteId, updated);
  return updated;
}

export async function deleteBlogPost(siteId: string, postId: string): Promise<boolean> {
  const postPath = path.join(DATA_DIR, siteId, 'posts', `${postId}.json`);
  if (!(await pathExists(postPath))) return false;
  await fs.unlink(postPath);
  return true;
}

// ── Analytics ──

export async function getSiteAnalytics(siteId: string): Promise<SiteAnalytics> {
  const posts = await loadBlogPosts(siteId);

  const publishedPosts = posts.filter(p => p.status === 'published');
  const draftPosts = posts.filter(p => p.status === 'draft');

  const avgSeo = posts.length > 0
    ? Math.round(posts.reduce((sum, p) => sum + p.seoScore.overall, 0) / posts.length)
    : 0;

  const avgReadability = posts.length > 0
    ? Math.round(posts.reduce((sum, p) => sum + p.readabilityScore, 0) / posts.length)
    : 0;

  const avgWordCount = posts.length > 0
    ? Math.round(posts.reduce((sum, p) => sum + p.wordCount, 0) / posts.length)
    : 0;

  const keywordMap: Record<string, number> = {};
  for (const post of posts) {
    if (post.primaryKeyword) {
      keywordMap[post.primaryKeyword] = (keywordMap[post.primaryKeyword] || 0) + 1;
    }
    for (const tag of post.tags) {
      keywordMap[tag] = (keywordMap[tag] || 0) + 1;
    }
  }
  const topKeywords = Object.entries(keywordMap)
    .map(([keyword, count]) => ({ keyword, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  const monthMap: Record<string, number> = {};
  for (const post of posts) {
    const month = new Date(post.createdAt).toISOString().slice(0, 7);
    monthMap[month] = (monthMap[month] || 0) + 1;
  }
  const postsByMonth = Object.entries(monthMap)
    .map(([month, count]) => ({ month, count }))
    .sort((a, b) => a.month.localeCompare(b.month));

  return {
    siteId,
    totalPosts: posts.length,
    publishedPosts: publishedPosts.length,
    draftPosts: draftPosts.length,
    averageSeoScore: avgSeo,
    averageReadability: avgReadability,
    averageWordCount: avgWordCount,
    topKeywords,
    postsByMonth,
    topPerformingTopics: publishedPosts.slice(0, 5).map(p => p.title),
  };
}
