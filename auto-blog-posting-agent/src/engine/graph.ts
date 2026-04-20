// LangGraph Blog Generation Pipeline
// START → researchTopic → writeContent → optimizeSEO → generateInternalLinks
//   → (conditional: images?) → generateImages/skipImages → finalize → END

import { StateGraph, Annotation, END, START } from '@langchain/langgraph';
import { v4 as uuid } from 'uuid';

import {
  SiteConfig, BlogPost, BlogImage, GenerationRequest,
  TopicSuggestion, InternalLink, SEOScore,
} from '../types';
import { generateContent, generateJSON } from '../services/gemini';
import { knowledgeBase } from '../rag/knowledge-base';
import { researchTopics, generateOptimalTitle } from './topic-researcher';
import {
  analyzeSEO, optimizeForSEO, generateInternalLinks as genLinks,
  generateTags,
} from './seo-optimizer';
import {
  generateBlogImages,
  insertImagesIntoContent, generateFeaturedImage,
} from './image-handler';
import { loadSiteConfig, saveBlogPost } from '../services/data-store';
import { buildSystemPrompt, markdownToHTML } from './generator';

export type ProgressCallback = (stage: string, message: string, step: number, total: number) => void;

const STAGES = [
  { key: 'research', label: 'Researching topic...' },
  { key: 'writing', label: 'Writing content...' },
  { key: 'seo', label: 'Optimizing for SEO...' },
  { key: 'links', label: 'Adding internal links...' },
  { key: 'images', label: 'Generating images...' },
  { key: 'finalize', label: 'Finalizing post...' },
] as const;
const TOTAL_STAGES = STAGES.length;

const BlogGraphState = Annotation.Root({
  request: Annotation<GenerationRequest>,
  site: Annotation<SiteConfig>,
  onProgress: Annotation<ProgressCallback | undefined>,

  topic: Annotation<TopicSuggestion>,
  selectedTitle: Annotation<string>,
  titleAlternatives: Annotation<string[]>,
  ragContext: Annotation<string>,
  previousPostSummaries: Annotation<string>,

  rawContent: Annotation<string>,
  optimizedContent: Annotation<string>,
  metaTitle: Annotation<string>,
  metaDescription: Annotation<string>,
  slug: Annotation<string>,
  schemaMarkup: Annotation<string>,

  seoScore: Annotation<SEOScore>,
  seoAttempts: Annotation<number>,

  internalLinks: Annotation<InternalLink[]>,
  images: Annotation<BlogImage[]>,
  tags: Annotation<string[]>,
  category: Annotation<string>,
  excerpt: Annotation<string>,

  startTime: Annotation<number>,
  topicTime: Annotation<number>,
  seoTime: Annotation<number>,
  imageTime: Annotation<number>,

  post: Annotation<BlogPost>,
  error: Annotation<string>,
});

type BlogState = typeof BlogGraphState.State;

function emitProgress(state: BlogState, stageIndex: number): void {
  state.onProgress?.(STAGES[stageIndex].key, STAGES[stageIndex].label, stageIndex + 1, TOTAL_STAGES);
}

async function researchTopicNode(state: BlogState): Promise<Partial<BlogState>> {
  const { request, site } = state;
  emitProgress(state, 0);
  const topicStart = Date.now();

  console.log(`\n[Graph] Research Topic for "${site.name}"...`);

  let topic: TopicSuggestion;

  if (request.topic) {
    const uniqueness = await knowledgeBase.checkTopicUniqueness(site.id, request.topic);
    topic = {
      topic: request.topic,
      title: request.topic,
      reasoning: 'User-provided topic',
      estimatedEngagement: 'medium',
      keywords: site.keywords,
      blogType: request.blogType || site.blogType,
    };
    if (!uniqueness.isUnique) {
      console.log(`   Similar content exists — AI will differentiate.`);
    }
  } else {
    const explore = request.exploreDifferent ?? false;
    console.log(`   Mode: ${explore ? 'White Space (new topic)' : 'Deepen (related topic)'}`);
    const suggestions = await researchTopics(site, 3, explore);
    topic = suggestions[0];
    console.log(`   Selected: "${topic.title}"`);
  }

  const { selectedTitle, alternatives } = await generateOptimalTitle(
    site, topic.topic, topic.keywords,
  );
  console.log(`   Title: "${selectedTitle}"`);

  const ragContext = await knowledgeBase.getContext(site.id, topic.topic, 5);
  const previousPostSummaries = await knowledgeBase.getPreviousPostSummaries(site.id);

  return {
    topic,
    selectedTitle,
    titleAlternatives: alternatives,
    ragContext,
    previousPostSummaries,
    topicTime: Date.now() - topicStart,
  };
}

async function writeContentNode(state: BlogState): Promise<Partial<BlogState>> {
  const { site, topic, selectedTitle, ragContext, previousPostSummaries, request } = state;
  emitProgress(state, 1);
  console.log(`\n[Graph] Writing content...`);

  const systemPrompt = buildSystemPrompt(site);
  const contentPrompt = `
## Your Task
Write a blog post for "${site.name}" (a ${site.niche} business) that reads like it was written by a human expert — conversational, engaging, and naturally promoting "${site.name}".

## Title
${selectedTitle}

## Topic Details
- Main Topic: ${topic.topic}
- Blog Type: ${topic.blogType}
- Primary Keywords: ${topic.keywords.join(', ')}
- Target Audience: ${site.targetAudience}

## BRAND MENTIONS — REQUIRED:
- Mention "${site.name}" naturally 4-6 times throughout the post.
- Include ONE dedicated H2 section about "${site.name}" (e.g. "The Role of ${site.name} in [Topic]" or "How ${site.name} Simplifies [Problem]").
- In that section, describe how ${site.name} helps solve the problem discussed. Use the site context below.
- End with a soft CTA: "Try ${site.name}" or "Explore ${site.name}'s free plan" — NOT a hard sell.
- DO NOT invent features — only describe what's in the site context.

## Site Context (use this for brand mentions):
${ragContext}

## Previous Post Summaries (DO NOT repeat similar topics):
${previousPostSummaries}

## WRITING STYLE — CRITICAL:
Follow this exact structure and tone:

1. **Opening (80-120 words):** Start with a relatable scenario or story. NOT a definition.
   Example: "Imagine this. You've just closed a client in another country. The deal feels like a breakthrough..."
   Make the reader feel the problem emotionally before offering solutions.

2. **Problem Section (100-150 words):** Describe the pain points.
   Use specific scenarios, not generic lists. Show ONE person's struggle.
   Ask rhetorical questions: "What if you continue doing this manually?"

3. **Solution Sections (300-400 words across 2-3 H2s):** Each section covers ONE aspect.
   Mix prose paragraphs with occasional bullet points (3-5 items max).
   Use "Before vs After" comparisons or mini case studies.

4. **${site.name} Section (150-200 words):** Dedicated H2 about how ${site.name} helps.
   Be specific: mention real features from the site context.
   Position as a natural fit, not a sales pitch.

5. **Final Thoughts + CTA (80-100 words):** Wrap up with impact.
   Soft CTA: "Start small. Test the free plan. See how it fits."
   End with a memorable line.

## HARD RULES:
- WORD COUNT: Write between 800-1200 words. Do NOT write less than 800 words.
- TONE: Conversational, like talking to a friend who happens to be an expert.
- PARAGRAPHS: 2-3 sentences max. One idea per paragraph. Use line breaks between paragraphs.
- NO FILLER: Never use "In conclusion", "Let's dive in", "At the end of the day", "Game-changer", "In today's fast-paced world".
- KEYWORD: Use "${topic.keywords[0]}" in the first 100 words and in 2-3 H2 headings.
- FORMAT: Markdown only. Start with # H1 title, use ## for sections, ### for sub-sections.
- NO IMAGES OR PLACEHOLDERS: Do NOT include image markdown. Do NOT write image descriptions like "!A visual of..." or "Illustration of...". The blog must be 100% text only.
- NO KEYWORD DUMPS: Do NOT list keywords at the end of the post. End with the CTA paragraph.
${request.customPrompt ? `\n## Custom Instructions from user:\n${request.customPrompt}` : ''}
`;

  const rawContent = await generateContent(systemPrompt, contentPrompt);

  return { rawContent };
}

async function optimizeSEONode(state: BlogState): Promise<Partial<BlogState>> {
  const { rawContent, optimizedContent, topic, site, seoAttempts } = state;
  const seoStart = Date.now();
  emitProgress(state, 2);
  const attempt = (seoAttempts || 0) + 1;

  console.log(`\n[Graph] SEO Optimization (attempt ${attempt})...`);

  const contentToOptimize = optimizedContent || rawContent;
  const primaryKeyword = topic.keywords[0] || topic.topic;
  const secondaryKeywords = topic.keywords.slice(1);

  const seoResult = await optimizeForSEO(
    contentToOptimize, primaryKeyword, secondaryKeywords, site,
    state.seoScore
  );

  const wordCount = seoResult.optimizedContent.split(/\s+/).length;
  const seoScore = analyzeSEO({
    metaTitle: seoResult.metaTitle,
    metaDescription: seoResult.metaDescription,
    contentMarkdown: seoResult.optimizedContent,
    primaryKeyword,
    internalLinks: state.internalLinks || [],
    wordCount,
  });

  console.log(`   SEO Score: ${seoScore.overall}/100`);

  return {
    optimizedContent: seoResult.optimizedContent,
    metaTitle: seoResult.metaTitle,
    metaDescription: seoResult.metaDescription,
    slug: seoResult.slug,
    schemaMarkup: seoResult.schemaMarkup,
    seoScore,
    seoAttempts: attempt,
    seoTime: (state.seoTime || 0) + (Date.now() - seoStart),
  };
}

async function internalLinksNode(state: BlogState): Promise<Partial<BlogState>> {
  const { optimizedContent, site } = state;
  emitProgress(state, 3);
  if (!site.internalLinking) {
    console.log(`\n[Graph] Internal linking disabled — skipping.`);
    return { internalLinks: [] };
  }

  console.log(`\n[Graph] Generating internal links...`);
  const links = await genLinks(optimizedContent, site.id, site);
  console.log(`   Found ${links.length} link opportunities.`);

  return { internalLinks: links };
}

async function generateImagesNode(state: BlogState): Promise<Partial<BlogState>> {
  const { selectedTitle, site } = state;
  emitProgress(state, 4);
  const imgStart = Date.now();

  console.log(`\n[Graph] Generating hero image...`);

  const heroImage = await generateFeaturedImage(selectedTitle, site.niche);

  console.log(`   Generated 1 hero image.`);

  return {
    images: [heroImage],
    imageTime: Date.now() - imgStart,
  };
}

async function skipImagesNode(state: BlogState): Promise<Partial<BlogState>> {
  state.onProgress?.('images', 'Skipping images...', 5, TOTAL_STAGES);
  console.log(`\n[Graph] Images skipped.`);
  return { images: [], imageTime: 0 };
}

async function finalizeNode(state: BlogState): Promise<Partial<BlogState>> {
  emitProgress(state, 5);
  const {
    site, request, selectedTitle, topic, optimizedContent, metaTitle,
    metaDescription, slug, schemaMarkup, seoScore, internalLinks,
    images, startTime,
  } = state;

  console.log(`\n[Graph] Finalizing blog post...`);

  const primaryKeyword = topic.keywords[0] || topic.topic;
  const secondaryKeywords = topic.keywords.slice(1);

  const tags = await generateTags(optimizedContent, primaryKeyword, site);

  const categoryResult = await generateJSON<{ category: string }>(
    'You are a blog categorizer.',
    `What single category best fits this blog post? Niche: ${site.niche}. Title: ${selectedTitle}. Return JSON: { "category": "category name" }`,
  );

  // Generate a short excerpt for previews
  const excerpt = await generateContent(
    'Write compelling blog post excerpts.',
    `Write a 2-3 sentence excerpt that makes readers want to read more:\n\nTitle: ${selectedTitle}\n\nContent: ${optimizedContent.slice(0, 1000)}\n\nReturn ONLY the excerpt.`,
    false,
  );

  let finalContent = optimizedContent;
  if (images.length > 1) {
    finalContent = insertImagesIntoContent(finalContent, images.slice(1));
  }

  const wordCount = finalContent.split(/\s+/).length;

  const post: BlogPost = {
    id: uuid(),
    siteId: site.id,
    title: selectedTitle,
    slug,
    metaTitle,
    metaDescription,
    content: markdownToHTML(finalContent),
    contentMarkdown: finalContent,
    excerpt: excerpt.trim(),
    tags,
    category: categoryResult.category || site.niche,
    primaryKeyword,
    secondaryKeywords,
    images,
    seoScore,
    readabilityScore: seoScore.readability,
    wordCount,
    estimatedReadTime: Math.ceil(wordCount / 200),
    status: site.autoPublish ? 'published' : 'draft',
    internalLinks,
    schemaMarkup,
    createdAt: new Date().toISOString(),
    publishedAt: site.autoPublish ? new Date().toISOString() : undefined,
    generationMeta: {
      model: process.env.GEMINI_CONTENT_MODEL || 'gemini-2.5-flash',
      tokensUsed: 0,
      generationTime: Date.now() - startTime,
      topicResearchTime: state.topicTime || 0,
      seoOptimizationTime: state.seoTime || 0,
      imageGenerationTime: state.imageTime || 0,
      totalPipelineTime: Date.now() - startTime,
    },
  };

  await saveBlogPost(site.id, post);
  await knowledgeBase.addPreviousPost(site.id, post);

  const totalSec = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\nBlog post complete in ${totalSec}s`);
  console.log(`   Title:  "${post.title}"`);
  console.log(`   Words:  ${post.wordCount}`);
  console.log(`   SEO:    ${post.seoScore.overall}/100`);
  console.log(`   Images: ${post.images.length}`);
  console.log(`   Status: ${post.status}\n`);

  return { post };
}

// Conditional: SEO quality gate — currently always passes
function seoQualityGate(state: BlogState): string {
  return 'pass';
}

// Conditional: skip or generate images based on site config
function shouldGenerateImages(state: BlogState): string {
  const includeImages = state.request.includeImages !== undefined
    ? state.request.includeImages
    : state.site.includeImages;

  return includeImages ? 'yes' : 'no';
}

function buildBlogGraph() {
  const graph = new StateGraph(BlogGraphState)

    .addNode('researchTopic', researchTopicNode)
    .addNode('writeContent', writeContentNode)
    .addNode('optimizeSEO', optimizeSEONode)
    .addNode('generateInternalLinks', internalLinksNode)
    .addNode('generateImages', generateImagesNode)
    .addNode('skipImages', skipImagesNode)
    .addNode('finalize', finalizeNode)

    .addEdge(START, 'researchTopic')
    .addEdge('researchTopic', 'writeContent')
    .addEdge('writeContent', 'optimizeSEO')

    .addConditionalEdges('optimizeSEO', seoQualityGate, {
      reoptimize: 'optimizeSEO',
      pass: 'generateInternalLinks',
    })

    .addConditionalEdges('generateInternalLinks', shouldGenerateImages, {
      yes: 'generateImages',
      no: 'skipImages',
    })

    .addEdge('generateImages', 'finalize')
    .addEdge('skipImages', 'finalize')
    .addEdge('finalize', END);

  return graph.compile();
}

let _compiledGraph: ReturnType<typeof buildBlogGraph> | null = null;

export function getBlogGraph() {
  if (!_compiledGraph) {
    _compiledGraph = buildBlogGraph();
  }
  return _compiledGraph;
}

export async function generateBlogPostGraph(
  request: GenerationRequest,
  onProgress?: ProgressCallback,
): Promise<BlogPost> {
  const site = await loadSiteConfig(request.siteId);
  if (!site) throw new Error(`Site not found: ${request.siteId}`);

  console.log(`\n[LangGraph] Starting blog generation for "${site.name}"...\n`);

  const graph = getBlogGraph();

  const result = await graph.invoke({
    request,
    site,
    onProgress,
    startTime: Date.now(),
    seoAttempts: 0,
    internalLinks: [],
    images: [],
    tags: [],
    topicTime: 0,
    seoTime: 0,
    imageTime: 0,
  });

  if (result.error) {
    throw new Error(result.error);
  }
  if (!result.post) {
    throw new Error('Graph completed but no post was produced');
  }

  return result.post;
}
