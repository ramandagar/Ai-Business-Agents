// Tests for the Gemini service layer.
// These mock the LangChain Google GenAI SDK so no real API calls are made.

// Mock the entire module before any imports
jest.mock('@langchain/google-genai', () => {
  const mockInvoke = jest.fn();
  const mockEmbedQuery = jest.fn();
  const mockEmbedDocuments = jest.fn();

  return {
    ChatGoogleGenerativeAI: jest.fn().mockImplementation(() => ({
      invoke: mockInvoke,
    })),
    GoogleGenerativeAIEmbeddings: jest.fn().mockImplementation(() => ({
      embedQuery: mockEmbedQuery,
      embedDocuments: mockEmbedDocuments,
    })),
    __mockInvoke: mockInvoke,
    __mockEmbedQuery: mockEmbedQuery,
    __mockEmbedDocuments: mockEmbedDocuments,
  };
});

// Re-import after mock setup — we need to get the mock references
const mockModule = jest.requireMock('@langchain/google-genai');
const mockInvoke = mockModule.__mockInvoke;
const mockEmbedQuery = mockModule.__mockEmbedQuery;
const mockEmbedDocuments = mockModule.__mockEmbedDocuments;

// Set env before importing the module
process.env.GEMINI_API_KEY = 'test-key-for-unit-tests';

// Import the functions under test
import { generateContent, generateEmbedding, generateEmbeddings, generateJSON, generateImage } from '../gemini';

beforeEach(() => {
  jest.clearAllMocks();
});

describe('generateContent', () => {
  it('returns text from AI response', async () => {
    mockInvoke.mockResolvedValue({
      content: [{ type: 'text', text: 'Hello from Gemini!' }],
    });

    const result = await generateContent('system prompt', 'user prompt');
    expect(result).toBe('Hello from Gemini!');
    expect(mockInvoke).toHaveBeenCalledTimes(1);
  });

  it('handles string response content', async () => {
    mockInvoke.mockResolvedValue({
      content: 'Simple string response',
    });

    const result = await generateContent('sys', 'usr');
    expect(result).toBe('Simple string response');
  });

  it('throws on API error', async () => {
    mockInvoke.mockRejectedValue(new Error('API quota exceeded'));

    await expect(generateContent('sys', 'usr')).rejects.toThrow('API quota exceeded');
  });
});

describe('generateEmbedding', () => {
  it('returns a number array from embedding model', async () => {
    mockEmbedQuery.mockResolvedValue([0.1, 0.2, 0.3]);

    const result = await generateEmbedding('test text');
    expect(result).toEqual([0.1, 0.2, 0.3]);
    expect(mockEmbedQuery).toHaveBeenCalledWith('test text');
  });
});

describe('generateEmbeddings', () => {
  it('returns arrays for each input text', async () => {
    mockEmbedDocuments.mockResolvedValue([
      [0.1, 0.2],
      [0.3, 0.4],
    ]);

    const result = await generateEmbeddings(['text1', 'text2']);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual([0.1, 0.2]);
    expect(mockEmbedDocuments).toHaveBeenCalledWith(['text1', 'text2']);
  });

  it('handles empty array', async () => {
    mockEmbedDocuments.mockResolvedValue([]);

    const result = await generateEmbeddings([]);
    expect(result).toEqual([]);
  });
});

describe('generateJSON', () => {
  it('parses clean JSON response', async () => {
    mockInvoke.mockResolvedValue({
      content: [{ type: 'text', text: '{"name": "test", "value": 42}' }],
    });

    const result = await generateJSON<{ name: string; value: number }>('sys', 'usr');
    expect(result).toEqual({ name: 'test', value: 42 });
  });

  it('strips markdown code fences', async () => {
    mockInvoke.mockResolvedValue({
      content: [{ type: 'text', text: '```json\n{"key": "value"}\n```' }],
    });

    const result = await generateJSON<Record<string, string>>('sys', 'usr');
    expect(result).toEqual({ key: 'value' });
  });

  it('strips think blocks', async () => {
    mockInvoke.mockResolvedValue({
      content: [{ type: 'text', text: '<think\nSome reasoning here\n</think\n{"result": true}' }],
    });

    const result = await generateJSON<{ result: boolean }>('sys', 'usr');
    expect(result).toEqual({ result: true });
  });

  it('handles JSON array response', async () => {
    mockInvoke.mockResolvedValue({
      content: [{ type: 'text', text: '[{"id": 1}, {"id": 2}]' }],
    });

    const result = await generateJSON<{ id: number }[]>('sys', 'usr');
    expect(result).toEqual([{ id: 1 }, { id: 2 }]);
  });

  it('throws on unparseable response', async () => {
    mockInvoke.mockResolvedValue({
      content: [{ type: 'text', text: 'This is not JSON at all, just plain text.' }],
    });

    await expect(generateJSON('sys', 'usr')).rejects.toThrow('invalid JSON');
  });
});

describe('generateImage', () => {
  it('returns placeholder when image generation fails', async () => {
    // First call is for alt text (generateContent)
    mockInvoke.mockResolvedValueOnce({
      content: [{ type: 'text', text: 'A professional blog image' }],
    });
    // Second call is for image generation — will fail
    mockInvoke.mockRejectedValueOnce(new Error('Image not available'));

    const result = await generateImage('a prompt', 896, 512);

    // Should get a placeholder URL since generation failed
    expect(result).toHaveProperty('alt');
    expect(result.url || result.base64).toBeDefined();
  });
});

describe('exports', () => {
  it('exports contentModel and embeddingsModel', async () => {
    const mod = await import('../gemini');
    expect(mod.contentModel).toBeDefined();
    expect(mod.embeddingsModel).toBeDefined();
  });
});
