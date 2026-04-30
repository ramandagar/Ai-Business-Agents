// src/services/knowledgeBase.ts — Supabase pgvector RAG
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import pricing from '../../pricing.json';

export interface KBChunk {
  text: string;
  source: string;
  metadata?: Record<string, any>;
}

export interface KBDocument {
  id: string;
  filename: string;
  chunks: KBChunk[];
  uploadedAt: string;
}

export interface ProjectResult {
  name: string;
  description: string;
  cost?: number;
  currency?: string;
  timeline?: string;
  scope?: string;
  impact?: string;
  live_url?: string;
  image_url?: string;
  category?: string;
  similarity: number;
}

export interface ServiceResult {
  name: string;
  tags: string[];
  min_price: number;
  max_price: number;
  currency: string;
  timeline: string;
  includes: string[];
  description?: string;
  similarity: number;
}

class KnowledgeBase {
  private supabase: SupabaseClient | null = null;
  private ready = false;
  private fallbackChunks: KBChunk[] = [];
  private uploadDir: string;

  constructor() {
    this.uploadDir = path.join(__dirname, '../../knowledgebase');
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
    }
    this.initFallback();
    this.initSupabase();
  }

  private initSupabase() {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_KEY;
    if (url && key && !url.includes('your_') && !key.includes('your_')) {
      this.supabase = createClient(url, key);
      this.ready = true;
      console.log('[KB] Supabase pgvector connected');
    } else {
      console.log('[KB] Supabase not configured — using in-memory fallback');
    }
  }

  /** Fallback: keyword search if Supabase unavailable */
  private initFallback() {
    for (const s of pricing.services) {
      this.fallbackChunks.push({
        text: `Service: ${s.name}\nTags: ${s.tags.join(', ')}\nPrice: ${pricing.currency} ${s.minPrice.toLocaleString()}–${s.maxPrice.toLocaleString()}\nTimeline: ${s.timeline}\nIncludes: ${s.includes.join(', ')}`,
        source: 'pricing_catalog',
        metadata: { service: s.name, minPrice: s.minPrice, maxPrice: s.maxPrice, timeline: s.timeline, includes: s.includes },
      });
    }
    for (const r of (pricing as any).rateCard || []) {
      this.fallbackChunks.push({
        text: `Rate Card: ${r.role} at ${pricing.currency} ${r.rate}/${r.unit}`,
        source: 'pricing_catalog',
        metadata: { type: 'rate', role: r.role, rate: r.rate },
      });
    }
    for (const p of (pricing as any).pastProjects || []) {
      this.fallbackChunks.push({
        text: `Past Project: ${p.name}\nCost: ${pricing.currency} ${p.cost.toLocaleString()}\nTimeline: ${p.timeline}\nScope: ${p.scope}\nImpact: ${p.impact}`,
        source: 'pricing_catalog',
        metadata: { type: 'project', name: p.name, cost: p.cost },
      });
    }
    this.fallbackChunks.push({
      text: `Business: ${pricing.businessName}\n${pricing.tagline}\nPolicies:\n- Payment: ${pricing.policies.payment}\n- Revisions: ${pricing.policies.revisions}\n- Support: ${pricing.policies.support}\n- Ownership: ${pricing.policies.ownership}`,
      source: 'pricing_catalog',
      metadata: { type: 'policies' },
    });
  }

  // ── Embedding via Gemini REST API ──────────────────────────────────────
  private async embed(text: string): Promise<number[]> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('GEMINI_API_KEY not set');

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'models/gemini-embedding-001',
          content: { parts: [{ text }] },
        }),
      },
    );
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Embedding API error: ${err}`);
    }
    const data = await res.json();
    return data.embedding.values;
  }

  private async embedBatch(texts: string[]): Promise<number[][]> {
    // Embed sequentially to avoid rate limits
    const results: number[][] = [];
    for (const text of texts) {
      results.push(await this.embed(text));
    }
    return results;
  }

  // ── Semantic search via Supabase ───────────────────────────────────────
  async searchProjects(query: string, topK = 5): Promise<ProjectResult[]> {
    if (!this.supabase) return [];

    try {
      const embedding = await this.embed(query);
      const { data, error } = await this.supabase.rpc('match_projects', {
        query_embedding: embedding,
        match_count: topK,
        match_threshold: 0.4,
      });
      if (error) {
        console.error('[KB] Project search error:', error.message);
        return [];
      }
      return data || [];
    } catch (err: any) {
      console.error('[KB] Project search failed:', err.message);
      return [];
    }
  }

  async searchServices(query: string, topK = 5): Promise<ServiceResult[]> {
    if (!this.supabase) return [];

    try {
      const embedding = await this.embed(query);
      const { data, error } = await this.supabase.rpc('match_services', {
        query_embedding: embedding,
        match_count: topK,
        match_threshold: 0.35,
      });
      if (error) {
        console.error('[KB] Service search error:', error.message);
        return [];
      }
      return data || [];
    } catch (err: any) {
      console.error('[KB] Service search failed:', err.message);
      return [];
    }
  }

  async searchAll(query: string, topK = 8): Promise<KBChunk[]> {
    // Try Supabase vector search first
    if (this.supabase) {
      try {
        const embedding = await this.embed(query);
        const { data, error } = await this.supabase.rpc('match_all', {
          query_embedding: embedding,
          match_count: topK,
          match_threshold: 0.35,
        });

        if (!error && data && data.length > 0) {
          return data.map((row: any) => ({
            text: row.content,
            source: row.source,
            metadata: row.metadata,
          }));
        }

        if (error) console.error('[KB] Unified search error:', error.message);
      } catch (err: any) {
        console.error('[KB] Vector search failed, falling back:', err.message);
      }
    }

    // Fallback to keyword search
    return this.keywordSearch(query, topK);
  }

  private keywordSearch(query: string, topK = 8): KBChunk[] {
    const q = query.toLowerCase();
    const words = q.split(/\s+/).filter(w => w.length > 2);

    return this.fallbackChunks
      .map(chunk => {
        const t = chunk.text.toLowerCase();
        const src = chunk.source ? chunk.source.toLowerCase() : '';
        let score = 0;
        if (src.includes(q)) score += 50;
        if (t.includes(q)) score += 10;
        for (const w of words) {
          if (t.includes(w)) score += 2;
          if (src.includes(w)) score += 5;
        }
        return { chunk, score };
      })
      .filter(r => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, topK)
      .map(r => r.chunk);
  }

  // ── Seeding ────────────────────────────────────────────────────────────
  async seedFromPricing(): Promise<{ services: number; projects: number }> {
    if (!this.supabase) throw new Error('Supabase not configured');

    let serviceCount = 0;
    let projectCount = 0;

    // Seed services
    const serviceTexts = pricing.services.map(s =>
      `Service: ${s.name}. Tags: ${s.tags.join(', ')}. Price: ${pricing.currency} ${s.minPrice.toLocaleString()}–${s.maxPrice.toLocaleString()}. Timeline: ${s.timeline}. Includes: ${s.includes.join(', ')}.`
    );
    const serviceEmbeddings = await this.embedBatch(serviceTexts);

    for (let i = 0; i < pricing.services.length; i++) {
      const s = pricing.services[i];
      const { error } = await this.supabase.from('services').insert({
        name: s.name,
        tags: s.tags,
        min_price: s.minPrice,
        max_price: s.maxPrice,
        currency: pricing.currency,
        timeline: s.timeline,
        includes: s.includes,
        description: serviceTexts[i],
        embedding: serviceEmbeddings[i],
      });

      if (error) console.error(`[KB] Seed service "${s.name}" error:`, error.message);
      else serviceCount++;
    }

    // Seed past projects
    const projectTexts = (pricing as any).pastProjects.map((p: any) =>
      `Project: ${p.name}. Cost: ${pricing.currency} ${p.cost.toLocaleString()}. Timeline: ${p.timeline}. Scope: ${p.scope}. Impact: ${p.impact}.`
    );
    const projectEmbeddings = await this.embedBatch(projectTexts);

    for (let i = 0; i < (pricing as any).pastProjects.length; i++) {
      const p = (pricing as any).pastProjects[i];
      const { error } = await this.supabase.from('projects').insert({
        name: p.name,
        description: p.scope,
        cost: p.cost,
        currency: pricing.currency,
        timeline: p.timeline,
        scope: p.scope,
        impact: p.impact,
        category: p.name.includes('e-commerce') || p.name.includes('E-commerce') ? 'ecommerce'
          : p.name.includes('Real Estate') || p.name.includes('Dashboard') ? 'web-app'
          : p.name.includes('Mobile') || p.name.includes('Fintech') ? 'mobile'
          : 'other',
        embedding: projectEmbeddings[i],
      });

      if (error) console.error(`[KB] Seed project "${p.name}" error:`, error.message);
      else projectCount++;
    }

    console.log(`[KB] Seeded: ${serviceCount} services, ${projectCount} projects`);
    return { services: serviceCount, projects: projectCount };
  }

  // ── Add project directly ───────────────────────────────────────────────
  async addProject(project: {
    name: string;
    description: string;
    cost?: number;
    timeline?: string;
    scope?: string;
    impact?: string;
    live_url?: string;
    image_url?: string;
    category?: string;
    tech_stack?: string[];
  }): Promise<boolean> {
    if (!this.supabase) return false;

    try {
      const text = `Project: ${project.name}. ${project.description}. ${project.scope || ''} ${project.impact || ''}`;
      const embedding = await this.embed(text);

      const { error } = await this.supabase.from('projects').insert({
        ...project,
        embedding,
      });

      if (error) {
        console.error('[KB] Add project error:', error.message);
        return false;
      }
      return true;
    } catch (err: any) {
      console.error('[KB] Add project failed:', err.message);
      return false;
    }
  }

  // ── Legacy compatibility ───────────────────────────────────────────────
  search(query: string, topK = 8): KBChunk[] {
    return this.keywordSearch(query, topK);
  }

  getDocuments() { return []; }
  removeDocument() { return false; }

  async addPDF(filename: string, buffer: Buffer): Promise<KBDocument> {
    const pdfParse = require('pdf-parse');
    const data = await pdfParse(buffer);
    return this.addTextDoc(filename, data.text);
  }

  async addTextDoc(filename: string, text: string): Promise<KBDocument> {
    const chunks = text.split(/\n{2,}/).map(c => c.trim()).filter(c => c.length > 15);
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

    if (this.supabase && chunks.length > 0) {
      const embeddings = await this.embedBatch(chunks);
      for (let i = 0; i < chunks.length; i++) {
        await this.supabase.from('documents').insert({
          filename,
          content: chunks[i],
          source_type: 'upload',
          embedding: embeddings[i],
        });
      }
    }

    return {
      id,
      filename,
      chunks: chunks.map(c => ({ text: c, source: filename })),
      uploadedAt: new Date().toISOString(),
    };
  }

  isReady() { return this.ready; }
}

export const kb = new KnowledgeBase();
