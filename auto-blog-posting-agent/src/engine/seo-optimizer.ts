import { BlogPost, SEOScore, SiteConfig, InternalLink } from '../types';
import { generateJSON, generateContent } from '../services/gemini';
import { knowledgeBase } from '../rag/knowledge-base';

function calculateReadability(text: string): number {
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
  const words = text.split(/\s+/).filter(w => w.trim().length > 0);
  const syllables = words.reduce((count, word) => count + countSyllables(word), 0);

  if (sentences.length === 0 || words.length === 0) return 50;

  const avgWordsPerSentence = words.length / sentences.length;
  const avgSyllablesPerWord = syllables / words.length;

  // Flesch Reading Ease
  const score = 206.835 - (1.015 * avgWordsPerSentence) - (84.6 * avgSyllablesPerWord);
  return Math.max(0, Math.min(100, Math.round(score)));
}

function countSyllables(word: string): number {
  word = word.toLowerCase().replace(/[^a-z]/g, '');
  if (word.length <= 3) return 1;

  const vowels = 'aeiouy';
  let count = 0;
  let prevVowel = false;

  for (const char of word) {
    const isVowel = vowels.includes(char);
    if (isVowel && !prevVowel) count++;
    prevVowel = isVowel;
  }

  if (word.endsWith('e') && count > 1) count--;
  return Math.max(1, count);
}

function calculateKeywordDensity(content: string, keyword: string): number {
  const words = content.toLowerCase().split(/\s+/);
  const keywordLower = keyword.toLowerCase();
  const keywordWords = keywordLower.split(/\s+/);

  let count = 0;
  for (let i = 0; i <= words.length - keywordWords.length; i++) {
    const phrase = words.slice(i, i + keywordWords.length).join(' ');
    if (phrase === keywordLower) count++;
  }

  return (count * keywordWords.length) / words.length * 100;
}

function scoreHeadingStructure(content: string): number {
  const h1Count = (content.match(/^# /gm) || []).length;
  const h2Count = (content.match(/^## /gm) || []).length;
  const h3Count = (content.match(/^### /gm) || []).length;

  let score = 0;

  if (h1Count === 1) score += 30;
  else if (h1Count === 0) score += 10;

  if (h2Count >= 3 && h2Count <= 8) score += 40;
  else if (h2Count >= 1) score += 20;

  if (h3Count >= 1) score += 30;
  else score += 15;

  return Math.min(100, score);
}

export function analyzeSEO(post: Partial<BlogPost>): SEOScore {
  const content = post.contentMarkdown || '';
  const primaryKeyword = post.primaryKeyword || '';

  let titleScore = 0;
  if (post.metaTitle) {
    const len = post.metaTitle.length;
    if (len >= 50 && len <= 60) titleScore = 100;
    else if (len >= 40 && len <= 70) titleScore = 70;
    else titleScore = 40;

    if (post.metaTitle.toLowerCase().includes(primaryKeyword.toLowerCase())) {
      titleScore = Math.min(100, titleScore + 20);
    }
  }

  let metaDescScore = 0;
  if (post.metaDescription) {
    const len = post.metaDescription.length;
    if (len >= 140 && len <= 160) metaDescScore = 100;
    else if (len >= 120 && len <= 170) metaDescScore = 70;
    else metaDescScore = 40;

    if (post.metaDescription.toLowerCase().includes(primaryKeyword.toLowerCase())) {
      metaDescScore = Math.min(100, metaDescScore + 20);
    }
  }

  const density = calculateKeywordDensity(content, primaryKeyword);
  let keywordDensityScore = 0;
  if (density >= 0.8 && density <= 2.5) keywordDensityScore = 100;
  else if (density >= 0.5 && density <= 3.5) keywordDensityScore = 70;
  else if (density > 0) keywordDensityScore = 40;

  const headingStructure = scoreHeadingStructure(content);

  const linkCount = (post.internalLinks || []).length;
  const internalLinksScore = Math.min(100, linkCount * 25);

  const readability = calculateReadability(content);

  const wordCount = post.wordCount || content.split(/\s+/).length;
  let contentLengthScore = 0;
  if (wordCount >= 1500 && wordCount <= 3000) contentLengthScore = 100;
  else if (wordCount >= 800 && wordCount <= 5000) contentLengthScore = 70;
  else if (wordCount >= 500) contentLengthScore = 40;

  const overall = Math.round(
    titleScore * 0.15 +
    metaDescScore * 0.10 +
    keywordDensityScore * 0.20 +
    headingStructure * 0.15 +
    internalLinksScore * 0.10 +
    readability * 0.15 +
    contentLengthScore * 0.15
  );

  return {
    overall,
    titleScore,
    metaDescScore,
    keywordDensity: Math.round(density * 100) / 100,
    headingStructure,
    internalLinks: internalLinksScore,
    readability,
    contentLength: contentLengthScore,
  };
}

export async function optimizeForSEO(
  content: string,
  primaryKeyword: string,
  secondaryKeywords: string[],
  site: SiteConfig,
  previousScore?: SEOScore
): Promise<{
  optimizedContent: string;
  metaTitle: string;
  metaDescription: string;
  slug: string;
  schemaMarkup: string;
}> {
  const result = await generateJSON<{
    optimizedContent: string;
    metaTitle: string;
    metaDescription: string;
    slug: string;
  }>(
    `You are an expert SEO optimizer. Optimize blog content for search engines while keeping it natural and readable.`,
    `Optimize this blog content for SEO:

Primary Keyword: ${primaryKeyword}
Secondary Keywords: ${secondaryKeywords.join(', ')}
Target Audience: ${site.targetAudience}

## Original Content:
${content.slice(0, 6000)}

## Tasks:
1. Ensure the primary keyword "${primaryKeyword}" is present in the first 100 words.
2. Intersperse primary and secondary keywords naturally (targeting 1.5% density).
3. Meta Title: Exactly 50-60 characters, starting with the keyword if possible.
4. Meta Description: Exactly 140-160 characters (action-oriented).
5. Ensure a logical hierarchy (exactly one H1, multiple H2s, optional H3s).
${previousScore ? `\n## Previous Feedback:
The last optimization attempt scored ${previousScore.overall}/100.
Main weaknesses:
- Keyword Density: ${previousScore.keywordDensity}% (Goal: 1.0-2.0%)
- Readability: ${previousScore.readability}/100
- Content Length: ${previousScore.contentLength}/100
Please improve these specific areas.` : ''}

Return JSON:
{
  "optimizedContent": "full optimized blog content in markdown",
  "metaTitle": "SEO title under 60 chars",
  "metaDescription": "compelling meta description under 160 chars",
  "slug": "clean-url-slug"
}`,
    16384
  );

  const schemaMarkup = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    "headline": result.metaTitle,
    "description": result.metaDescription,
    "author": { "@type": "Organization", "name": site.name },
    "publisher": { "@type": "Organization", "name": site.name, "url": site.url },
    "datePublished": new Date().toISOString(),
    "dateModified": new Date().toISOString(),
    "keywords": [primaryKeyword, ...secondaryKeywords].join(', '),
    "mainEntityOfPage": {
      "@type": "WebPage",
      "@id": `${site.url}/blog/${result.slug}`,
    },
  }, null, 2);

  return { ...result, schemaMarkup };
}

export async function generateInternalLinks(
  content: string,
  siteId: string,
  site: SiteConfig
): Promise<InternalLink[]> {
  const context = await knowledgeBase.getContext(siteId, content.slice(0, 500), 5);

  if (context.includes('No previous context')) return [];

  try {
    const links = await generateJSON<InternalLink[]>(
      `You are an SEO internal linking specialist.`,
      `Given this blog content and previous posts, suggest natural internal links.

## Current Blog (excerpt):
${content.slice(0, 2000)}

## Available Posts to Link To:
${context}

## Rules:
- Only suggest links where they naturally fit
- Use descriptive anchor text (not "click here")
- Max 3-5 internal links per post
- Links should add value for the reader

Return JSON array:
[
  {
    "anchorText": "natural anchor text from the content",
    "targetPostId": "post id if available",
    "targetUrl": "/blog/slug-from-context",
    "relevanceScore": 0.85
  }
]`
    );

    return links;
  } catch {
    return [];
  }
}

export async function generateTags(
  content: string,
  primaryKeyword: string,
  site: SiteConfig
): Promise<string[]> {
  const result = await generateJSON<{ tags: string[] }>(
    'You are a blog tagging specialist.',
    `Generate 5-10 relevant tags for this blog post.

Niche: ${site.niche}
Primary Keyword: ${primaryKeyword}
Content (excerpt): ${content.slice(0, 1500)}

Return JSON: { "tags": ["tag1", "tag2", ...] }
Tags should be lowercase, relevant to the content, and useful for categorization.`
  );

  return result.tags || [];
}
