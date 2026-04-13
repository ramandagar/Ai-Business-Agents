import fs from 'fs/promises';
import path from 'path';
import { v4 as uuid } from 'uuid';
import { KnowledgeEntry, SiteConfig, BlogPost } from '../types';
import { vectorStore } from './vector-store';
import { generateContent } from '../services/gemini';

const DATA_DIR = path.join(__dirname, '../../data/sites');

async function ensureDir(dir: string): Promise<void> {
  await fs.mkdir(dir, { recursive: true });
}

function safeJsonParse<T>(text: string, fallback: T): T {
  try {
    return JSON.parse(text) as T;
  } catch {
    return fallback;
  }
}

async function ensureSiteDir(siteId: string): Promise<string> {
  const siteDir = path.join(DATA_DIR, siteId);
  await ensureDir(siteDir);
  return siteDir;
}

async function loadKnowledge(siteId: string): Promise<KnowledgeEntry[]> {
  const filePath = path.join(await ensureSiteDir(siteId), 'knowledge.json');
  try {
    const data = await fs.readFile(filePath, 'utf-8');
    return safeJsonParse<KnowledgeEntry[]>(data, []);
  } catch {
    return [];
  }
}

async function saveKnowledge(siteId: string, entries: KnowledgeEntry[]): Promise<void> {
  const filePath = path.join(await ensureSiteDir(siteId), 'knowledge.json');
  await fs.writeFile(filePath, JSON.stringify(entries, null, 2));
}

export class KnowledgeBase {

  // Load existing entries into vector store on startup
  // Skips if already loaded (prevents duplicates on restart)
  async initializeSite(siteId: string): Promise<number> {
    const entries = await loadKnowledge(siteId);
    if (entries.length === 0) return 0;

    if (vectorStore.hasSite(siteId)) {
      console.log(`Knowledge base already loaded for site ${siteId} — skipping.`);
      return entries.length;
    }

    const documents = entries.map(entry => ({
      content: `${entry.title}\n\n${entry.summary}\n\n${entry.content}`,
      metadata: {
        siteId,
        type: entry.type,
        entryId: entry.id,
        title: entry.title,
      },
    }));

    await vectorStore.addDocuments(documents);
    console.log(`Loaded ${entries.length} knowledge entries for site ${siteId}`);

    return entries.length;
  }

  async addPreviousPost(siteId: string, post: BlogPost): Promise<string> {
    // Generate a short summary for RAG context
    let summary = post.contentMarkdown.slice(0, 200).replace(/\n/g, ' ') + '...';
    try {
      summary = await generateContent(
        'Create a concise 2-3 sentence summary of this blog post.',
        `Summarize:\n\nTitle: ${post.title}\n\nContent: ${post.contentMarkdown.slice(0, 3000)}`,
        false,
      );
      summary = summary.trim();
    } catch (e: any) {
      console.warn(`Failed to generate summary for "${post.title}":`, e.message);
    }

    const entry: KnowledgeEntry = {
      id: uuid(),
      siteId,
      type: 'previous_post',
      title: post.title,
      content: post.contentMarkdown.slice(0, 5000),
      summary,
      metadata: {
        postId: post.id,
        slug: post.slug,
        tags: post.tags,
        category: post.category,
        primaryKeyword: post.primaryKeyword,
        publishedAt: post.publishedAt,
      },
      createdAt: new Date().toISOString(),
    };

    const entries = await loadKnowledge(siteId);
    entries.push(entry);
    await saveKnowledge(siteId, entries);

    try {
      await vectorStore.addDocument(
        `${entry.title}\n\n${entry.summary}\n\n${entry.content}`,
        { siteId, type: 'previous_post', entryId: entry.id, title: entry.title },
      );
    } catch (e: any) {
      console.warn(`Embedding failed for "${entry.title}" — RAG won't cover this post.`);
    }

    return entry.id;
  }

  async addCustomKnowledge(
    siteId: string,
    type: KnowledgeEntry['type'],
    title: string,
    content: string,
  ): Promise<string> {
    let summary = content.slice(0, 200).replace(/\n/g, ' ') + '...';
    try {
      summary = await generateContent(
        'Summarize this content in 2-3 concise sentences.',
        content.slice(0, 3000),
        false,
      );
      summary = summary.trim();
    } catch (e: any) {
      console.warn(`Failed to generate summary for "${title}":`, e.message);
    }

    const entry: KnowledgeEntry = {
      id: uuid(),
      siteId,
      type,
      title,
      content,
      summary,
      metadata: {},
      createdAt: new Date().toISOString(),
    };

    const entries = await loadKnowledge(siteId);
    entries.push(entry);
    await saveKnowledge(siteId, entries);

    try {
      await vectorStore.addDocument(
        `${title}\n\n${summary}\n\n${content}`,
        { siteId, type, entryId: entry.id, title },
      );
    } catch (e: any) {
      console.warn(`Could not generate embeddings for "${title}" — RAG will be limited.`);
    }

    return entry.id;
  }

  async getContext(siteId: string, topic: string, topK: number = 5): Promise<string> {
    const results = await vectorStore.search(topic, topK, siteId);

    if (results.length === 0) {
      return 'No previous context available. This appears to be the first post for this site.';
    }

    let context = '## Previous Content Context\n\n';
    for (const result of results) {
      const meta = result.entry.metadata;
      context += `### ${meta.title || 'Untitled'} (Relevance: ${(result.similarity * 100).toFixed(1)}%)\n`;
      context += `Type: ${meta.type}\n`;
      context += `${result.entry.content.slice(0, 500)}\n\n`;
    }

    return context;
  }

  async getPreviousPostSummaries(siteId: string): Promise<string> {
    const entries = await loadKnowledge(siteId);
    const posts = entries.filter(e => e.type === 'previous_post');

    if (posts.length === 0) return 'No previous posts found.';

    let summaries = '';
    for (const post of posts) {
      summaries += `- **${post.title}**: ${post.summary}\n`;
      if (post.metadata.tags) {
        summaries += `  Tags: ${(post.metadata.tags as string[]).join(', ')}\n`;
      }
    }

    return summaries;
  }

  async checkTopicUniqueness(siteId: string, topic: string): Promise<{
    isUnique: boolean;
    similarTopics: string[];
    suggestion: string;
  }> {
    const { isDuplicate, similarPost } = await vectorStore.isDuplicate(topic, siteId, 0.82);

    if (isDuplicate && similarPost) {
      const suggestion = await generateContent(
        'Suggest unique angles for this topic that differ from existing content.',
        `Topic: "${topic}"\nSimilar existing post: "${similarPost.entry.metadata.title}"\nSuggest 3 alternative angles, one per line.`,
        false,
      );

      return {
        isUnique: false,
        similarTopics: [similarPost.entry.metadata.title as string],
        suggestion: suggestion.trim(),
      };
    }

    return { isUnique: true, similarTopics: [], suggestion: '' };
  }

  async listKnowledge(siteId: string): Promise<KnowledgeEntry[]> {
    return loadKnowledge(siteId);
  }

  async deleteKnowledge(siteId: string, entryId: string): Promise<boolean> {
    const entries = await loadKnowledge(siteId);
    const index = entries.findIndex(e => e.id === entryId);
    if (index === -1) return false;

    entries.splice(index, 1);
    await saveKnowledge(siteId, entries);
    await vectorStore.remove(entryId);

    return true;
  }
}

export const knowledgeBase = new KnowledgeBase();
