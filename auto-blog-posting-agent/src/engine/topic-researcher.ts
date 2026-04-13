// Topic Researcher — Two-Mode Topic Discovery
//
// "Deepen" (default) — writes follow-up posts on popular existing topics
// "White Space" (exploreDifferent=true) — finds uncovered areas in the niche

import { SiteConfig, TopicSuggestion, BlogType } from '../types';
import { generateJSON, generateContent } from '../services/gemini';
import { knowledgeBase } from '../rag/knowledge-base';
import { vectorStore } from '../rag/vector-store';

export async function researchTopics(
  site: SiteConfig,
  count: number = 5,
  exploreDifferent: boolean = false,
): Promise<TopicSuggestion[]> {

  const previousPosts = await knowledgeBase.getPreviousPostSummaries(site.id);
  const coverageMap = vectorStore.getCoverageMap(site.id);
  const embeddedCount = vectorStore.getEmbeddedCount(site.id);

  const coverageSummary = coverageMap.length > 0
    ? coverageMap.map(c => `"${c.title}" (${c.type})`).join('\n')
    : 'No posts published yet.';

  let modeInstruction: string;

  if (exploreDifferent) {
    modeInstruction = `
## STRATEGY: Explore New Territory

You MUST suggest topics that are COMPLETELY DIFFERENT from all existing posts.
Look at the coverage map below. Every topic listed has already been covered.
Your job is to find "blind spots" — areas of the niche that have NOT been explored.

Think about:
- Sub-niches that haven't been touched
- Audience segments that haven't been addressed
- Contrarian or unexpected angles
- Emerging trends not yet covered
- Cross-domain intersections (e.g., niche + psychology, niche + economics)

DO NOT suggest anything that overlaps with the existing coverage map.
`;
  } else {
    let relatedContext = '';
    try {
      const similar = await vectorStore.search(site.niche, 3, site.id);
      relatedContext = similar
        .map(r => `"${r.entry.metadata.title}" (similarity: ${(r.similarity * 100).toFixed(0)}%)`)
        .join('\n');
    } catch {
      relatedContext = 'Vector search unavailable — use niche keywords instead.';
    }

    modeInstruction = `
## STRATEGY: Deepen Existing Coverage

The blog already has posts in certain areas (see coverage map).
Your job is to suggest FOLLOW-UP or DEEPER-DIVE posts that expand on existing topics.

Think about:
- Part 2 / Advanced versions of popular posts
- "How-to" guides that complement existing theory posts
- Case studies or real-world examples related to covered topics
- FAQ / troubleshooting posts based on covered areas

Most relevant existing posts:
${relatedContext}

Build upon these — don't repeat them, go DEEPER.
`;
  }

  const systemPrompt = `You are an expert content strategist and SEO researcher.
You suggest blog topics that will:
1. Drive organic traffic through SEO
2. Be unique from existing content
3. Match the brand's niche and audience
4. Have high engagement potential

IMPORTANT: Return ONLY valid JSON array.`;

  const userPrompt = `
Website: ${site.name} (${site.url})
Niche: ${site.niche}
Target Audience: ${site.targetAudience}
Brand Voice: ${site.brandVoice}
Preferred Blog Type: ${site.blogType}
Focus Keywords: ${site.keywords.join(', ')}

## Coverage Map (${embeddedCount} posts embedded):
${coverageSummary}

## Previously Published Posts:
${previousPosts}

${modeInstruction}

## Task:
Generate ${count} unique blog topic suggestions.

Return as JSON array:
[
  {
    "topic": "main topic in 3-5 words",
    "title": "SEO-optimized full blog title (50-60 chars)",
    "reasoning": "why this topic will perform well and how it differs from existing content",
    "estimatedEngagement": "low|medium|high",
    "keywords": ["keyword1", "keyword2", "keyword3"],
    "blogType": "educational|viral|listicle|tutorial|review|how-to|opinion|news"
  }
]`;

  try {
    const suggestions = await generateJSON<TopicSuggestion[]>(systemPrompt, userPrompt);

    const uniqueSuggestions: TopicSuggestion[] = [];
    for (const suggestion of suggestions) {
      const { isUnique } = await knowledgeBase.checkTopicUniqueness(site.id, suggestion.title);
      if (isUnique) {
        uniqueSuggestions.push(suggestion);
      }
    }

    return uniqueSuggestions.length > 0 ? uniqueSuggestions : suggestions.slice(0, count);
  } catch (error) {
    console.error('Topic research failed:', error);
    return [{
      topic: `${site.niche} guide`,
      title: `The Ultimate ${site.niche} Guide for ${new Date().getFullYear()}`,
      reasoning: 'Evergreen comprehensive guide (fallback)',
      estimatedEngagement: 'medium',
      keywords: site.keywords.slice(0, 3),
      blogType: site.blogType,
    }];
  }
}

export async function generateOptimalTitle(
  site: SiteConfig,
  topic: string,
  keywords: string[],
): Promise<{ selectedTitle: string; alternatives: string[] }> {
  const result = await generateJSON<{ titles: string[]; bestIndex: number; reasoning: string }>(
    `You are an SEO copywriting expert. Generate compelling blog titles.`,
    `Generate 3 SEO-optimized title options for this blog post:

Topic: ${topic}
Niche: ${site.niche}
Target Keywords: ${keywords.join(', ')}
Audience: ${site.targetAudience}

Rules:
- Each title should be 50-60 characters
- Include primary keyword naturally
- Use power words or numbers when appropriate
- Make it click-worthy but NOT clickbait

Return JSON: { "titles": ["title1", "title2", "title3"], "bestIndex": 0, "reasoning": "why" }`,
  );

  return {
    selectedTitle: result.titles[result.bestIndex] || result.titles[0],
    alternatives: result.titles,
  };
}
