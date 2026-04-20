import { BlogImage, SiteConfig } from '../types';
import { generateJSON, generateImage } from '../services/gemini';
import { v4 as uuid } from 'uuid';

export async function identifyImagePlacements(
  content: string,
  site: SiteConfig,
  maxImages: number = 3
): Promise<{ position: string; prompt: string; caption: string }[]> {
  const result = await generateJSON<{
    images: { position: string; prompt: string; caption: string }[];
  }>(
    `You are a visual content strategist. Determine the best places in a blog post to add images.`,
    `Analyze this blog post and suggest where images should be placed for maximum engagement.

## Blog Content:
${content.slice(0, 4000)}

## Rules:
- Max ${maxImages} images
- Place images after complex explanations to break up text
- Place images near key concepts that benefit from visualization
- Each image prompt should be detailed enough for AI generation
- Captions should add context, not just describe the image

Return JSON:
{
  "images": [
    {
      "position": "after the section heading 'Example Section Title'",
      "prompt": "detailed image generation prompt - modern, clean design, professional quality",
      "caption": "Figure caption that adds context"
    }
  ]
}`
  );

  return result.images || [];
}

export async function generateBlogImages(
  placements: { position: string; prompt: string; caption: string }[]
): Promise<BlogImage[]> {
  const images: BlogImage[] = [];

  for (const placement of placements) {
    try {
      const { url, base64, alt } = await generateImage(placement.prompt, 896, 512);
      const imageUrl = base64 ? `data:image/jpeg;base64,${base64}` : url;

      images.push({
        id: uuid(),
        prompt: placement.prompt,
        url: imageUrl,
        base64,
        alt,
        caption: placement.caption,
        position: placement.position,
        width: 896,
        height: 512,
      });
    } catch (error) {
      console.error(`Failed to generate image for position "${placement.position}":`, error);
      images.push({
        id: uuid(),
        prompt: placement.prompt,
        url: `https://placehold.co/896x512/2d2d44/e0e0e0?text=Image+Unavailable`,
        alt: placement.caption,
        caption: placement.caption,
        position: placement.position,
        width: 896,
        height: 512,
      });
    }
  }

  return images;
}

// Insert images into markdown at specified section headings (reverse order to avoid index shifts)
export function insertImagesIntoContent(content: string, images: BlogImage[]): string {
  let result = content;
  const sortedImages = [...images].reverse();

  for (const image of sortedImages) {
    const positionLower = image.position.toLowerCase();
    const titleMatch = positionLower.match(/(?:after|before|near|under)\s+(?:the\s+)?(?:section\s+)?(?:heading\s+)?['"]?(.+?)['"]?\s*$/);

    if (titleMatch) {
      const sectionTitle = titleMatch[1].trim();
      const headingRegex = new RegExp(
        `(^#{1,3}\\s+.*${escapeRegex(sectionTitle)}.*$)`,
        'mi'
      );
      const match = result.match(headingRegex);

      if (match && match.index !== undefined) {
        const insertPos = result.indexOf('\n', match.index);
        if (insertPos !== -1) {
          const imageMarkdown = `\n\n![${image.alt}](${image.url})\n*${image.caption}*\n`;
          result = result.slice(0, insertPos + 1) + imageMarkdown + result.slice(insertPos + 1);
        }
      }
    }
  }

  return result;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export async function generateFeaturedImage(
  title: string,
  niche: string
): Promise<BlogImage> {
  const prompt = `A professional, modern blog hero image for an article titled "${title}" in the ${niche} niche. Clean, minimal design with subtle gradients, abstract shapes, and professional color palette. No text overlay needed. High quality, 16:9 aspect ratio.`;

  try {
    const { url, base64, alt } = await generateImage(prompt, 1344, 704);
    const imageUrl = base64 ? `data:image/jpeg;base64,${base64}` : url;

    return {
      id: uuid(),
      prompt,
      url: imageUrl,
      base64,
      alt,
      caption: title,
      position: 'hero',
      width: 1344,
      height: 704,
    };
  } catch {
    return {
      id: uuid(),
      prompt,
      url: `https://placehold.co/1344x704/1a1a2e/c0c0c0?text=${encodeURIComponent(title.slice(0, 40))}`,
      alt: title,
      caption: title,
      position: 'hero',
      width: 1344,
      height: 704,
    };
  }
}
