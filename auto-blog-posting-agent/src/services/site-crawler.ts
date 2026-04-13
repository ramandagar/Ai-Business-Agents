import { generateJSON } from './gemini';

function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, '')
    .replace(/<nav[\s\S]*?<\/nav>/gi, '')
    .replace(/<footer[\s\S]*?<\/footer>/gi, '')
    .replace(/<\/?(p|div|br|h[1-6]|li|tr)[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

async function fetchPage(url: string): Promise<string> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const resp = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; AutoBlogAgent/1.0)',
        'Accept': 'text/html',
      },
    });
    clearTimeout(timeout);

    if (!resp.ok) return '';
    const html = await resp.text();
    return htmlToText(html);
  } catch {
    return '';
  }
}

function normalizeUrl(input: string): string {
  let url = input.trim();
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = 'https://' + url;
  }
  return url.replace(/\/+$/, '');
}

export interface CrawlResult {
  siteSummary: string;
  niche: string;
  targetAudience: string;
  keywords: string[];
  keyFeatures: string[];
  systemPrompt: string;
}

export async function crawlSite(siteUrl: string): Promise<CrawlResult> {
  const baseUrl = normalizeUrl(siteUrl);
  console.log(`\nCrawling ${baseUrl}...`);

  const pagePaths = ['', '/about', '/about-us', '/pricing', '/services', '/features', '/products'];
  const pages = await Promise.all(
    pagePaths.map(p => fetchPage(`${baseUrl}${p}`))
  );

  const allText = pages
    .filter(text => text.length > 50)
    .map((text, i) => `--- Page: ${pagePaths[i] || 'Homepage'} ---\n${text.slice(0, 3000)}`)
    .join('\n\n');

  if (allText.length < 100) {
    console.warn(`Could not extract meaningful content from ${baseUrl}`);
    return {
      siteSummary: `Website at ${baseUrl}`,
      niche: 'general',
      targetAudience: 'general audience',
      keywords: [],
      keyFeatures: [],
      systemPrompt: '',
    };
  }

  console.log(`Extracted ${allText.length} chars from ${pages.filter(t => t.length > 50).length} pages`);

  const result = await generateJSON<CrawlResult>(
    `You are a website analyst. Given the text content of a website, extract structured information about what the business does.
Be specific and accurate — only state what you can clearly see from the content.`,
    `Analyze this website content and return a JSON object with these fields:
- siteSummary: 2-3 sentence description of what this business/website does
- niche: the industry/niche (be specific, e.g. "SaaS Invoicing & Billing" not just "tech")
- targetAudience: who the site targets (e.g. "Small businesses and freelancers")
- keywords: array of 8-12 SEO keywords relevant to this site's content
- keyFeatures: array of the main products/services/features mentioned on the site
- systemPrompt: a detailed blog writing instruction like: "You are a blog writer for [site name]. [site name] is a [what it does]. Write blog posts about [topics]. When mentioning [site name], you may highlight these features: [actual features]. Target audience: [audience]."

WEBSITE CONTENT:
${allText.slice(0, 8000)}`
  );

  console.log(`Site analyzed: ${result.niche}`);
  console.log(`Summary: ${result.siteSummary.slice(0, 100)}...`);
  console.log(`Keywords: ${result.keywords.slice(0, 5).join(', ')}`);

  return result;
}
