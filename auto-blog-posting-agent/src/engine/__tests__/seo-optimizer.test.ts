import { analyzeSEO } from '../../engine/seo-optimizer';

describe('analyzeSEO', () => {
  it('scores a well-structured post highly', () => {
    const post = {
      metaTitle: 'How to Invoice International Clients - Complete Guide 2025',
      metaDescription: 'Learn how to create professional invoices for international clients with our step-by-step guide covering currency, taxes, and payment methods.',
      contentMarkdown: generateWellStructuredContent(),
      primaryKeyword: 'invoice international clients',
      internalLinks: [
        { anchorText: 'invoicing guide', targetPostId: '1', targetUrl: '/guide', relevanceScore: 0.9 },
      ],
      wordCount: 1800,
    };

    const score = analyzeSEO(post);
    expect(score.overall).toBeGreaterThan(60);
    expect(score.titleScore).toBeGreaterThan(0);
    expect(score.headingStructure).toBeGreaterThan(50);
  });

  it('penalizes missing meta title', () => {
    const post = {
      contentMarkdown: '# Some Title\n\nSome content here.',
      primaryKeyword: 'test',
      wordCount: 100,
    };

    const score = analyzeSEO(post);
    expect(score.titleScore).toBe(0);
  });

  it('penalizes missing meta description', () => {
    const post = {
      metaTitle: 'A test title that is long enough',
      contentMarkdown: '# Some Title\n\nSome content.',
      primaryKeyword: 'test',
      wordCount: 100,
    };

    const score = analyzeSEO(post);
    expect(score.metaDescScore).toBe(0);
  });

  it('rewards keyword in title and description', () => {
    const withKeyword = analyzeSEO({
      metaTitle: 'Best invoicing software for small businesses',
      metaDescription: 'Discover the best invoicing software for small businesses with our comparison guide.',
      contentMarkdown: '# Best Invoicing Software\n\nContent here.',
      primaryKeyword: 'invoicing software',
      wordCount: 2000,
    });

    const withoutKeyword = analyzeSEO({
      metaTitle: 'A random title that has good length for testing',
      metaDescription: 'A completely unrelated description that also has a good length for SEO purposes here.',
      contentMarkdown: '# Random Title\n\nContent here.',
      primaryKeyword: 'invoicing software',
      wordCount: 2000,
    });

    expect(withKeyword.titleScore).toBeGreaterThan(withoutKeyword.titleScore);
    expect(withKeyword.metaDescScore).toBeGreaterThan(withoutKeyword.metaDescScore);
  });

  it('handles empty content gracefully', () => {
    const score = analyzeSEO({
      contentMarkdown: '',
      primaryKeyword: '',
      wordCount: 0,
    });

    expect(score.overall).toBeGreaterThanOrEqual(0);
    expect(score.readability).toBe(50); // default for empty
  });

  it('scores ideal title length (50-60 chars) perfectly', () => {
    const title = 'How to Create Professional Invoices in Ten Minutes';
    expect(title.length).toBe(50);
    expect(title.length).toBeGreaterThanOrEqual(50);
    expect(title.length).toBeLessThanOrEqual(60);

    const score = analyzeSEO({
      metaTitle: title,
      contentMarkdown: '# Title\n\nContent.',
      primaryKeyword: 'invoices',
      wordCount: 1000,
    });

    expect(score.titleScore).toBeGreaterThanOrEqual(100);
  });
});

describe('heading structure scoring', () => {
  it('scores perfect H1/H2/H3 hierarchy', () => {
    const content = `# Main Title

## First Section
Content here.

## Second Section
Content here.

### Sub-section A
Content here.

### Sub-section B
Content here.

## Third Section
Content here.`;

    const score = analyzeSEO({ contentMarkdown: content, primaryKeyword: 'test', wordCount: 500 });
    expect(score.headingStructure).toBe(100);
  });

  it('penalizes multiple H1s', () => {
    const content = `# First H1
Content.
# Second H1
More content.
## A Section
Content.`;

    const score = analyzeSEO({ contentMarkdown: content, primaryKeyword: 'test', wordCount: 500 });
    expect(score.headingStructure).toBeLessThan(100);
  });
});

function generateWellStructuredContent(): string {
  return `# How to Invoice International Clients

When you start working with international clients, invoicing can feel overwhelming. Let's break it down.

## Understanding International Invoicing

The first step is understanding the basics. International invoices need additional details like SWIFT codes and IBAN numbers.

## Choosing the Right invoicing software

Using dedicated invoicing software saves hours of manual work. Look for multi-currency support.

### Key Features to Look For

- Multi-currency conversion
- Automatic tax calculation
- PDF export with professional templates

### Common Mistakes to Avoid

Many freelancers forget to include payment terms in their invoices.

## Getting Paid Faster

Set clear expectations upfront about payment methods and timelines.

## How BillingBee Helps with International Invoicing

BillingBee automates the entire invoicing workflow for international payments. With support for 50+ currencies and automatic tax calculations, it eliminates the manual work.

## Conclusion

Start with a simple template, upgrade to dedicated software as you grow.`;
}
