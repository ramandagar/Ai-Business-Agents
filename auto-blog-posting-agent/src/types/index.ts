// ============================================================
// TypeScript Interfaces & Types for Auto Blog Agent
// ============================================================

export interface SiteConfig {
  id: string;
  name: string;
  url: string;
  niche: string;
  targetAudience: string;
  brandVoice: string;
  systemPrompt: string;
  schedule: string; // cron expression
  autoPublish: boolean;
  includeImages: boolean;
  internalLinking: boolean;
  blogType: BlogType;
  createdAt: string;
  updatedAt: string;
  keywords: string[];
  restrictions: string[];
}

export type BlogType = 'educational' | 'viral' | 'listicle' | 'tutorial' | 'review' | 'how-to' | 'opinion' | 'news';

export type PostStatus = 'draft' | 'review' | 'published' | 'scheduled' | 'failed';

export interface BlogPost {
  id: string;
  siteId: string;
  title: string;
  slug: string;
  metaTitle: string;
  metaDescription: string;
  content: string;            // Full HTML content
  contentMarkdown: string;    // Markdown version
  excerpt: string;
  tags: string[];
  category: string;
  primaryKeyword: string;
  secondaryKeywords: string[];
  images: BlogImage[];
  seoScore: SEOScore;
  readabilityScore: number;   // 0-100
  wordCount: number;
  estimatedReadTime: number;  // minutes
  status: PostStatus;
  internalLinks: InternalLink[];
  schemaMarkup: string;       // JSON-LD
  createdAt: string;
  publishedAt?: string;
  generationMeta: GenerationMeta;
}

export interface BlogImage {
  id: string;
  prompt: string;
  url?: string;
  base64?: string;
  alt: string;
  caption: string;
  position: string;    // after which section heading
  width: number;
  height: number;
}

export interface SEOScore {
  overall: number;       // 0-100
  titleScore: number;
  metaDescScore: number;
  keywordDensity: number;
  headingStructure: number;
  internalLinks: number;
  readability: number;
  contentLength: number;
}

export interface InternalLink {
  anchorText: string;
  targetPostId: string;
  targetUrl: string;
  relevanceScore: number;
}

export interface GenerationMeta {
  model: string;
  tokensUsed: number;
  generationTime: number;     // ms
  topicResearchTime: number;
  seoOptimizationTime: number;
  imageGenerationTime: number;
  totalPipelineTime: number;
}

export interface KnowledgeEntry {
  id: string;
  siteId: string;
  type: 'previous_post' | 'about_page' | 'brand_guide' | 'custom' | 'site-overview';
  title: string;
  content: string;
  summary: string;
  embedding?: number[];
  metadata: Record<string, any>;
  createdAt: string;
}

export interface TopicSuggestion {
  topic: string;
  title: string;
  reasoning: string;
  estimatedEngagement: 'low' | 'medium' | 'high';
  keywords: string[];
  blogType: BlogType;
}

export interface GenerationRequest {
  siteId: string;
  topic?: string;              // Optional - AI picks if not provided
  blogType?: BlogType;
  includeImages?: boolean;
  customPrompt?: string;
  exploreDifferent?: boolean;  // true = find NEW topic area, false = deepen existing coverage
}

export interface ScheduleConfig {
  siteId: string;
  cronExpression: string;
  timezone: string;
  enabled: boolean;
  maxPostsPerDay: number;
}

export interface SiteAnalytics {
  siteId: string;
  totalPosts: number;
  publishedPosts: number;
  draftPosts: number;
  averageSeoScore: number;
  averageReadability: number;
  averageWordCount: number;
  topKeywords: { keyword: string; count: number }[];
  postsByMonth: { month: string; count: number }[];
  topPerformingTopics: string[];
}

// Vector store types
export interface VectorEntry {
  id: string;
  content: string;
  embedding: number[];
  metadata: Record<string, any>;
}

export interface SearchResult {
  entry: VectorEntry;
  similarity: number;
}
