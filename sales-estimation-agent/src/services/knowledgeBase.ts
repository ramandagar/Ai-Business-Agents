// src/services/knowledgeBase.ts
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

class KnowledgeBase {
  private documents: KBDocument[] = [];
  private pricingChunks: KBChunk[] = [];
  private uploadDir: string;

  constructor() {
    this.uploadDir = path.join(__dirname, '../../knowledgebase');
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
    }
    this.initFromPricing();
    this.loadSavedDocs();
  }

  private initFromPricing() {
    for (const s of pricing.services) {
      this.pricingChunks.push({
        text: `Service: ${s.name}\nTags: ${s.tags.join(', ')}\nPrice: ${pricing.currency} ${s.minPrice.toLocaleString()}–${s.maxPrice.toLocaleString()}\nTimeline: ${s.timeline}\nIncludes: ${s.includes.join(', ')}`,
        source: 'pricing_catalog',
        metadata: { service: s.name, minPrice: s.minPrice, maxPrice: s.maxPrice, timeline: s.timeline, includes: s.includes },
      });
    }
    if ((pricing as any).rateCard) {
      for (const r of (pricing as any).rateCard) {
        this.pricingChunks.push({
          text: `Rate Card: ${r.role} at ${pricing.currency} ${r.rate}/${r.unit}`,
          source: 'pricing_catalog',
          metadata: { type: 'rate', role: r.role, rate: r.rate },
        });
      }
    }
    if ((pricing as any).pastProjects) {
      for (const p of (pricing as any).pastProjects) {
        this.pricingChunks.push({
          text: `Past Project: ${p.name}\nCost: ${pricing.currency} ${p.cost.toLocaleString()}\nTimeline: ${p.timeline}\nScope: ${p.scope}\nImpact: ${p.impact}`,
          source: 'pricing_catalog',
          metadata: { type: 'project', name: p.name, cost: p.cost },
        });
      }
    }
    this.pricingChunks.push({
      text: `Business: ${pricing.businessName}\n${pricing.tagline}\nPolicies:\n- Payment: ${pricing.policies.payment}\n- Revisions: ${pricing.policies.revisions}\n- Support: ${pricing.policies.support}\n- Ownership: ${pricing.policies.ownership}`,
      source: 'pricing_catalog',
      metadata: { type: 'policies' },
    });
  }

  private loadSavedDocs() {
    const f = path.join(this.uploadDir, 'meta.json');
    if (fs.existsSync(f)) {
      try { this.documents = JSON.parse(fs.readFileSync(f, 'utf-8')).documents || []; } catch { }
    }
  }

  private saveMeta() {
    fs.writeFileSync(path.join(this.uploadDir, 'meta.json'), JSON.stringify({ documents: this.documents }, null, 2));
  }

  async addPDF(filename: string, buffer: Buffer): Promise<KBDocument> {
    const pdfParse = require('pdf-parse');
    const data = await pdfParse(buffer);
    return this.addText(filename, data.text);
  }

  addText(filename: string, text: string): KBDocument {
    const rawChunks = text
      .split(/\n{2,}/)
      .map(c => c.trim())
      .filter(c => c.length > 15);

    const chunks: KBChunk[] = rawChunks.map(c => ({ text: c, source: filename }));
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    const doc: KBDocument = { id, filename, chunks, uploadedAt: new Date().toISOString() };
    this.documents.push(doc);
    this.saveMeta();
    return doc;
  }

  search(query: string, topK = 8): KBChunk[] {
    const q = query.toLowerCase();
    const words = q.split(/\s+/).filter(w => w.length > 2);
    const allChunks = [...this.pricingChunks, ...this.documents.flatMap(d => d.chunks)];

    return allChunks
      .map(chunk => {
        const t = chunk.text.toLowerCase();
        const src = chunk.source ? chunk.source.toLowerCase() : '';
        let score = 0;
        
        // Exact filename match gets high priority to ensure the AI reads the right doc
        if (src.includes(q)) score += 50; 
        
        if (t.includes(q)) score += 10;
        for (const w of words) { 
          if (t.includes(w)) score += 2; 
          if (src.includes(w)) score += 5; // words from query matching the file name
        }
        return { chunk, score };
      })
      .filter(r => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, topK)
      .map(r => r.chunk);
  }

  getDocuments() {
    return this.documents.map(d => ({ id: d.id, filename: d.filename, uploadedAt: d.uploadedAt, chunkCount: d.chunks.length }));
  }

  removeDocument(id: string): boolean {
    const idx = this.documents.findIndex(d => d.id === id);
    if (idx === -1) return false;
    this.documents.splice(idx, 1);
    this.saveMeta();
    return true;
  }
}

export const kb = new KnowledgeBase();
