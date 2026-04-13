import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { GoogleGenerativeAIEmbeddings } from '@langchain/google-genai';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';

const API_KEY = process.env.GEMINI_API_KEY || '';
const CONTENT_MODEL = process.env.GEMINI_CONTENT_MODEL || 'gemini-2.5-flash';
const EMBED_MODEL = process.env.GEMINI_EMBED_MODEL || 'text-embedding-001';
const IMAGE_MODEL = process.env.GEMINI_IMAGE_MODEL || 'gemini-2.0-flash-preview-image-generation';

if (!API_KEY) {
  console.warn('GEMINI_API_KEY is not set. AI features will fail.');
}

export const contentModel = new ChatGoogleGenerativeAI({
  model: CONTENT_MODEL,
  apiKey: API_KEY,
  temperature: 0.7,
  maxOutputTokens: 8192,
});

export const embeddingsModel = new GoogleGenerativeAIEmbeddings({
  model: EMBED_MODEL,
  apiKey: API_KEY,
});

function extractText(content: unknown): string {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .map((block: any) => {
        if (typeof block === 'string') return block;
        if (block?.type === 'text') return block.text || '';
        return '';
      })
      .join('');
  }
  return String(content);
}

export async function generateContent(
  systemPrompt: string,
  userPrompt: string,
  _useHighQuality: boolean = true,
): Promise<string> {
  const response = await contentModel.invoke([
    new SystemMessage(systemPrompt),
    new HumanMessage(userPrompt),
  ]);
  return extractText(response.content);
}

export async function generateEmbedding(text: string): Promise<number[]> {
  return embeddingsModel.embedQuery(text);
}

export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  return embeddingsModel.embedDocuments(texts);
}

export async function generateImage(
  prompt: string,
  width: number = 896,
  height: number = 512,
): Promise<{ url?: string; base64?: string; alt: string }> {
  const altText = await generateContent(
    'Return ONLY concise alt text for an image, nothing else.',
    `Alt text for: ${prompt}`,
    false,
  );

  try {
    const imageModel = new ChatGoogleGenerativeAI({
      model: IMAGE_MODEL,
      apiKey: API_KEY,
      temperature: 1.0,
      maxOutputTokens: 8192,
    });

    const response = await imageModel.invoke([
      new HumanMessage(
        `Generate an image: ${prompt}. The image should be ${width}x${height} pixels, professional quality, modern design.`
      ),
    ]);

    const parts = Array.isArray(response.content) ? response.content : [response.content];
    for (const part of parts as any[]) {
      if (part.type === 'image_url' && part.image_url?.url) {
        const dataUrl = part.image_url.url;
        const base64Match = dataUrl.match(/^data:image\/[^;]+;base64,(.+)$/);
        if (base64Match) {
          console.log(`   Image generated (${width}x${height})`);
          return { base64: base64Match[1], alt: altText.trim() };
        }
      }
      if (part.inlineData || part.inline_data) {
        const imageData = part.inlineData || part.inline_data;
        if (imageData.data) {
          console.log(`   Image generated (${width}x${height})`);
          return { base64: imageData.data, alt: altText.trim() };
        }
      }
    }

    throw new Error('No image data found in response');
  } catch (err: any) {
    console.warn(`   Image generation failed: ${err.message} — using placeholder`);
    const url = `https://placehold.co/${width}x${height}/1a1a2e/c0c0c0?text=${encodeURIComponent(prompt.slice(0, 50))}`;
    return { url, alt: altText.trim() };
  }
}

export async function generateJSON<T>(
  systemPrompt: string,
  userPrompt: string,
): Promise<T> {
  const jsonModel = new ChatGoogleGenerativeAI({
    model: CONTENT_MODEL,
    apiKey: API_KEY,
    temperature: 0.1,
    maxOutputTokens: 4096,
    json: true,
  });

  const response = await jsonModel.invoke([
    new SystemMessage(
      `${systemPrompt}\n\nRespond with ONLY valid JSON. No explanation, no markdown, no code fences.`,
    ),
    new HumanMessage(userPrompt),
  ]);

  const raw = extractText(response.content).trim();

  let cleaned = raw;

  // Strip reasoning tags some models add
  cleaned = cleaned.replace(/<think[\s\S]*?<\/think>/gi, '').trim();

  // Strip markdown code fences
  cleaned = cleaned
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  // Find actual JSON boundaries
  const jsonStart = cleaned.search(/[{[]/);
  if (jsonStart > 0) cleaned = cleaned.slice(jsonStart);

  const lastClose = Math.max(cleaned.lastIndexOf('}'), cleaned.lastIndexOf(']'));
  if (lastClose !== -1 && lastClose < cleaned.length - 1) {
    cleaned = cleaned.slice(0, lastClose + 1);
  }

  try {
    return JSON.parse(cleaned) as T;
  } catch (e) {
    console.error('JSON parse failed. Raw (first 500 chars):\n', raw.slice(0, 500));
    throw new Error(`AI returned invalid JSON: ${(e as Error).message}`);
  }
}
