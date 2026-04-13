// Set required env vars before any modules load
process.env.GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'test-key-for-unit-tests';
process.env.GOOGLE_API_KEY = process.env.GOOGLE_API_KEY || 'test-key-for-unit-tests';
