import { SiteConfig } from '../types';

export function buildSystemPrompt(site: SiteConfig): string {
  if (site.systemPrompt) {
    let p = site.systemPrompt;
    p += `\n\n## BRAND INTEGRATION (always apply):
- You are writing content for "${site.name}". Naturally mention "${site.name}" throughout the blog.
- Include a dedicated section (H2) about how "${site.name}" helps the reader solve the problem discussed.
- Mention "${site.name}" by name 4-6 times across the post — in the intro, mid-body, dedicated section, and conclusion/CTA.
- Use the knowledge from the site overview to describe real features. DO NOT invent features.
- End with a soft CTA encouraging readers to try "${site.name}".`;
    if (site.restrictions.length > 0) {
      p += `\n\n## Hard Restrictions:\n` + site.restrictions.map(r => `- ${r}`).join('\n');
    }
    return p;
  }

  const prompt = `You are an expert blog writer for "${site.name}" — a ${site.niche} business.

## THIS SITE'S IDENTITY
- Website Name: ${site.name}
- Website URL: ${site.url || 'N/A'}
- Industry / Niche: ${site.niche}
- Target Readers: ${site.targetAudience}
- Writing Tone: ${site.brandVoice}

## BRAND INTEGRATION — MANDATORY:
1. "${site.name}" is the product/service this blog promotes. You MUST mention it naturally throughout.
2. Include a DEDICATED H2 section titled something like "The Role of ${site.name} in [Topic]" or "How ${site.name} Helps [Audience]".
3. In that section, describe how ${site.name}'s features solve the reader's problem. Use info from the site context provided.
4. Mention "${site.name}" by name 4-6 times total: in the introduction, once mid-body, in the dedicated section, and in the final CTA.
5. The tone should be helpful — NOT a hard sell. Position ${site.name} as a natural solution, not a sales pitch.
6. DO NOT invent features — only mention what you know from the site context.

## WRITING STYLE — MATCH THIS EXACTLY:
1. Write like a human storyteller, NOT a list-maker. Use conversational tone.
2. START with a relatable scenario or story (e.g. "Imagine this. You've just closed a client...").
3. Use short paragraphs (2-3 sentences max). One idea per paragraph.
4. Include a "Before vs After" or real-world scenario section showing transformation.
5. Use bullet points sparingly — only for lists of 3+ items.
6. Ask rhetorical questions to engage the reader.
7. Use emotional language: frustration, relief, confidence, growth.
8. NEVER use filler: "In conclusion", "Let's dive in", "At the end of the day", "Game-changer".
9. Write with authority but approachability — like a knowledgeable friend, not a textbook.
${site.keywords.length > 0 ? `\n## SEO Keywords to Include Naturally:\n${site.keywords.slice(0, 8).join(', ')}` : ''}
${site.restrictions.length > 0 ? `\n## Hard Restrictions:\n${site.restrictions.map(r => `- ${r}`).join('\n')}` : ''}`;

  return prompt;
}

export function markdownToHTML(markdown: string): string {
  let md = markdown.trim();

  // Strip any leftover image markdown (images are handled separately)
  md = md.replace(/^!\[.*?\]\(.*?\)\s*$/gm, '');
  md = md.replace(/!\[.*?\]\(.*?\)/g, '');
  md = md.replace(/^![A-Za-z].*$/gm, '');
  md = md.replace(/^(Illustration of|Example of|A visual representation of) .*$/gm, '');

  // Protect code blocks from other transformations
  const codeBlocks: string[] = [];
  md = md.replace(/```(\w*)\n([\s\S]*?)```/g, (_m, lang, code) => {
    codeBlocks.push(`<pre><code class="language-${lang}">${code.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</code></pre>`);
    return `%%CODEBLOCK_${codeBlocks.length - 1}%%`;
  });

  md = md.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  md = md.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  md = md.replace(/^# (.+)$/gm, '<h1>$1</h1>');

  md = md.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
  md = md.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  md = md.replace(/\*(.+?)\*/g, '<em>$1</em>');

  md = md.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  md = md.replace(/`([^`]+)`/g, '<code>$1</code>');
  md = md.replace(/^---$/gm, '<hr>');
  md = md.replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>');

  // Lists and paragraphs
  const lines = md.split('\n');
  const output: string[] = [];
  let inUl = false;
  let inOl = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      if (inUl) { output.push('</ul>'); inUl = false; }
      if (inOl) { output.push('</ol>'); inOl = false; }
      continue;
    }

    const ulMatch = trimmed.match(/^[-*] (.+)$/);
    if (ulMatch) {
      if (inOl) { output.push('</ol>'); inOl = false; }
      if (!inUl) { output.push('<ul>'); inUl = true; }
      output.push(`<li>${ulMatch[1]}</li>`);
      continue;
    }

    const olMatch = trimmed.match(/^\d+\. (.+)$/);
    if (olMatch) {
      if (inUl) { output.push('</ul>'); inUl = false; }
      if (!inOl) { output.push('<ol>'); inOl = true; }
      output.push(`<li>${olMatch[1]}</li>`);
      continue;
    }

    if (inUl) { output.push('</ul>'); inUl = false; }
    if (inOl) { output.push('</ol>'); inOl = false; }

    if (trimmed.startsWith('<') || trimmed.startsWith('%%CODEBLOCK_')) {
      output.push(trimmed);
      continue;
    }

    output.push(`<p>${trimmed}</p>`);
  }

  if (inUl) output.push('</ul>');
  if (inOl) output.push('</ol>');

  let html = output.join('\n');
  html = html.replace(/%%CODEBLOCK_(\d+)%%/g, (_m, i) => codeBlocks[parseInt(i)]);

  return html;
}
