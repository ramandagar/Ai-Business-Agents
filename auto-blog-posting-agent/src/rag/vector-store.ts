import fs from 'fs/promises';
import path from 'path';
import { v4 as uuid } from 'uuid';
import { VectorEntry, SearchResult } from '../types';
import { generateEmbedding, generateEmbeddings } from '../services/gemini';

const DATA_DIR = path.join(__dirname, '../../data/sites');

async function ensureDir(dir: string): Promise<void> {
  await fs.mkdir(dir, { recursive: true });
}

async function vectorFilePath(siteId: string): Promise<string> {
  const dir = path.join(DATA_DIR, siteId);
  await ensureDir(dir);
  return path.join(dir, 'vectors.json');
}

async function loadVectors(siteId: string): Promise<VectorEntry[]> {
  try {
    const fp = await vectorFilePath(siteId);
    const data = await fs.readFile(fp, 'utf-8');
    return JSON.parse(data);
  } catch {
    return [];
  }
}

async function saveVectors(siteId: string, entries: VectorEntry[]): Promise<void> {
  const fp = await vectorFilePath(siteId);
  await fs.writeFile(fp, JSON.stringify(entries));
}

function cosine(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  const d = Math.sqrt(na) * Math.sqrt(nb);
  return d === 0 ? 0 : dot / d;
}

export class VectorStore {
  private cache: Map<string, VectorEntry[]> = new Map();

  hasSite(siteId: string): boolean {
    return this.cache.has(siteId);
  }

  private async ensureLoaded(siteId: string): Promise<VectorEntry[]> {
    if (!this.cache.has(siteId)) {
      const entries = await loadVectors(siteId);
      this.cache.set(siteId, entries);
    }
    return this.cache.get(siteId)!;
  }

  private async persist(siteId: string): Promise<void> {
    const entries = this.cache.get(siteId) || [];
    await saveVectors(siteId, entries);
  }

  async addDocument(content: string, metadata: Record<string, any>): Promise<string> {
    const siteId = metadata.siteId as string;
    if (!siteId) throw new Error('metadata.siteId is required');

    const embedding = await generateEmbedding(content);
    const entry: VectorEntry = { id: uuid(), content, embedding, metadata };

    const entries = await this.ensureLoaded(siteId);
    entries.push(entry);
    await this.persist(siteId);

    return entry.id;
  }

  async addDocuments(docs: { content: string; metadata: Record<string, any> }[]): Promise<string[]> {
    if (docs.length === 0) return [];

    const siteId = docs[0].metadata.siteId as string;
    if (!siteId) throw new Error('metadata.siteId is required');

    const contents = docs.map(d => d.content);
    const embeddings = await generateEmbeddings(contents);
    const ids: string[] = [];

    const entries = await this.ensureLoaded(siteId);
    for (let i = 0; i < docs.length; i++) {
      const entry: VectorEntry = {
        id: uuid(),
        content: docs[i].content,
        embedding: embeddings[i],
        metadata: docs[i].metadata,
      };
      entries.push(entry);
      ids.push(entry.id);
    }
    await this.persist(siteId);

    return ids;
  }

  // Find similar posts (for deepening / context retrieval)
  async search(
    query: string,
    topK: number = 5,
    siteId?: string,
    filter?: (e: VectorEntry) => boolean,
  ): Promise<SearchResult[]> {
    const qEmb = await generateEmbedding(query);
    const candidates = siteId ? await this.ensureLoaded(siteId) : this.getAllEntries();
    const filtered = filter ? candidates.filter(filter) : candidates;

    const scored: SearchResult[] = filtered.map(entry => ({
      entry,
      similarity: cosine(qEmb, entry.embedding),
    }));

    scored.sort((a, b) => b.similarity - a.similarity);
    return scored.slice(0, topK);
  }

  // Find least-similar posts (for white-space / diverse topic discovery)
  async searchDiverse(
    query: string,
    topK: number = 5,
    siteId?: string,
  ): Promise<SearchResult[]> {
    const qEmb = await generateEmbedding(query);
    const candidates = siteId ? await this.ensureLoaded(siteId) : this.getAllEntries();

    const scored: SearchResult[] = candidates.map(entry => ({
      entry,
      similarity: cosine(qEmb, entry.embedding),
    }));

    scored.sort((a, b) => a.similarity - b.similarity);
    return scored.slice(0, topK);
  }

  getCoverageMap(siteId: string): { title: string; keywords: string[]; type: string }[] {
    const entries = this.cache.get(siteId) || [];
    return entries.map(e => ({
      title: (e.metadata.title as string) || 'Untitled',
      keywords: (e.metadata.keywords as string[]) || [],
      type: (e.metadata.type as string) || 'unknown',
    }));
  }

  getEmbeddedCount(siteId: string): number {
    const entries = this.cache.get(siteId) || [];
    return entries.filter(e => e.embedding && e.embedding.length > 0).length;
  }

  async isDuplicate(
    content: string,
    siteId: string,
    threshold: number = 0.85,
  ): Promise<{ isDuplicate: boolean; similarPost?: SearchResult }> {
    const results = await this.search(content, 1, siteId);
    if (results.length > 0 && results[0].similarity >= threshold) {
      return { isDuplicate: true, similarPost: results[0] };
    }
    return { isDuplicate: false };
  }

  async remove(id: string): Promise<boolean> {
    for (const [siteId, entries] of this.cache) {
      const idx = entries.findIndex(e => e.id === id);
      if (idx !== -1) {
        entries.splice(idx, 1);
        await this.persist(siteId);
        return true;
      }
    }
    return false;
  }

  async removeSite(siteId: string): Promise<number> {
    const entries = await this.ensureLoaded(siteId);
    const count = entries.length;
    this.cache.set(siteId, []);
    await this.persist(siteId);
    return count;
  }

  getStats(): { totalEntries: number; siteCount: number; siteBreakdown: Record<string, number> } {
    const breakdown: Record<string, number> = {};
    let total = 0;
    for (const [siteId, entries] of this.cache) {
      breakdown[siteId] = entries.length;
      total += entries.length;
    }
    return { totalEntries: total, siteCount: this.cache.size, siteBreakdown: breakdown };
  }

  private getAllEntries(): VectorEntry[] {
    const all: VectorEntry[] = [];
    for (const entries of this.cache.values()) all.push(...entries);
    return all;
  }
}

export const vectorStore = new VectorStore();
