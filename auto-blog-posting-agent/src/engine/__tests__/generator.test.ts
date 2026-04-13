import { markdownToHTML, buildSystemPrompt } from '../../engine/generator';
import { SiteConfig } from '../../types';

const mockSite: SiteConfig = {
  id: 'test-id',
  name: 'BillingBee',
  url: 'https://billingbee.co',
  niche: 'invoicing & billing SaaS',
  targetAudience: 'small businesses and freelancers',
  brandVoice: 'professional and friendly',
  systemPrompt: '',
  schedule: '0 9 * * *',
  autoPublish: false,
  includeImages: true,
  internalLinking: true,
  blogType: 'educational',
  createdAt: '2025-01-01',
  updatedAt: '2025-01-01',
  keywords: ['invoicing', 'billing', 'invoices'],
  restrictions: [],
};

describe('markdownToHTML', () => {
  it('converts H1/H2/H3 headings', () => {
    const md = '# Title\n## Section\n### Subsection';
    const html = markdownToHTML(md);
    expect(html).toContain('<h1>Title</h1>');
    expect(html).toContain('<h2>Section</h2>');
    expect(html).toContain('<h3>Subsection</h3>');
  });

  it('converts bold and italic', () => {
    const md = 'This is **bold** and *italic* and ***both***.';
    const html = markdownToHTML(md);
    expect(html).toContain('<strong>bold</strong>');
    expect(html).toContain('<em>italic</em>');
    expect(html).toContain('<strong><em>both</em></strong>');
  });

  it('converts links', () => {
    const md = 'Check out [BillingBee](https://billingbee.co) today.';
    const html = markdownToHTML(md);
    expect(html).toContain('<a href="https://billingbee.co" target="_blank" rel="noopener">BillingBee</a>');
  });

  it('converts inline code', () => {
    const md = 'Use the `npm install` command.';
    const html = markdownToHTML(md);
    expect(html).toContain('<code>npm install</code>');
  });

  it('converts unordered lists', () => {
    const md = '- Item 1\n- Item 2\n- Item 3';
    const html = markdownToHTML(md);
    expect(html).toContain('<ul>');
    expect(html).toContain('<li>Item 1</li>');
    expect(html).toContain('</ul>');
  });

  it('converts ordered lists', () => {
    const md = '1. First\n2. Second\n3. Third';
    const html = markdownToHTML(md);
    expect(html).toContain('<ol>');
    expect(html).toContain('<li>First</li>');
    expect(html).toContain('</ol>');
  });

  it('converts code blocks', () => {
    const md = '```javascript\nconsole.log("hello");\n```';
    const html = markdownToHTML(md);
    expect(html).toContain('<pre><code class="language-javascript">');
    expect(html).toContain('console.log');
  });

  it('strips AI image placeholders', () => {
    const md = '# Title\n\n![A visual of something](https://example.com/img.png)\n\nReal content here.';
    const html = markdownToHTML(md);
    expect(html).not.toContain('A visual of');
    expect(html).toContain('Real content here.');
  });

  it('wraps plain text in <p> tags', () => {
    const md = 'This is a paragraph.';
    const html = markdownToHTML(md);
    expect(html).toContain('<p>This is a paragraph.</p>');
  });

  it('handles empty input', () => {
    expect(markdownToHTML('')).toBe('');
    expect(markdownToHTML('   ')).toBe('');
  });

  it('converts horizontal rules', () => {
    const md = 'Above\n\n---\n\nBelow';
    const html = markdownToHTML(md);
    expect(html).toContain('<hr>');
  });

  it('converts blockquotes', () => {
    const md = '> This is a quote';
    const html = markdownToHTML(md);
    expect(html).toContain('<blockquote>This is a quote</blockquote>');
  });
});

describe('buildSystemPrompt', () => {
  it('includes site name in generated prompt', () => {
    const prompt = buildSystemPrompt(mockSite);
    expect(prompt).toContain('BillingBee');
    expect(prompt).toContain('invoicing & billing SaaS');
    expect(prompt).toContain('small businesses and freelancers');
  });

  it('includes keywords when present', () => {
    const prompt = buildSystemPrompt(mockSite);
    expect(prompt).toContain('invoicing');
    expect(prompt).toContain('billing');
  });

  it('uses custom system prompt when provided', () => {
    const customSite = {
      ...mockSite,
      systemPrompt: 'You are a pirate blog writer for BillingBee. Use sea metaphors.',
    };
    const prompt = buildSystemPrompt(customSite);
    expect(prompt).toContain('pirate blog writer');
    expect(prompt).toContain('sea metaphors');
    // Still includes brand integration
    expect(prompt).toContain('BillingBee');
  });

  it('includes restrictions when present', () => {
    const restrictedSite = {
      ...mockSite,
      restrictions: ['No competitor mentions', 'No pricing info'],
    };
    const prompt = buildSystemPrompt(restrictedSite);
    expect(prompt).toContain('No competitor mentions');
    expect(prompt).toContain('No pricing info');
  });

  it('works with minimal site config', () => {
    const minimalSite: SiteConfig = {
      id: 'min',
      name: 'Test',
      url: '',
      niche: 'general',
      targetAudience: 'general audience',
      brandVoice: 'casual',
      systemPrompt: '',
      schedule: '0 9 * * *',
      autoPublish: false,
      includeImages: true,
      internalLinking: true,
      blogType: 'educational',
      createdAt: '2025-01-01',
      updatedAt: '2025-01-01',
      keywords: [],
      restrictions: [],
    };
    const prompt = buildSystemPrompt(minimalSite);
    expect(prompt).toContain('Test');
    expect(prompt.length).toBeGreaterThan(100);
  });
});
