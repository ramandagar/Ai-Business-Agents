// src/server.ts
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import multer from 'multer';
import { HumanMessage, BaseMessage } from '@langchain/core/messages';
import { getGraph } from './graph';
import { kb } from './services/knowledgeBase';
import { fetchAvailableSlots } from './tools/index';
import pricing from '../pricing.json';

const app = express();
app.use(express.json({ limit: '100kb' }));
app.use(cors({ origin: '*' }));
app.use(express.static(path.join(__dirname, '../public')));

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// ═══════════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════
const MAX_MSG_LENGTH = 500;         // Max characters per message
const MAX_REQUESTS_PER_MIN = 10;    // Max requests per IP per minute
const MAX_REQUESTS_PER_HOUR = 60;   // Max requests per IP per hour
const MAX_THREADS_PER_IP = 5;       // Max concurrent threads per IP

const rateBuckets = new Map<string, { count: number; resetAt: number }>();
const hourBuckets = new Map<string, { count: number; resetAt: number }>();
const ipThreads = new Map<string, Set<string>>();

// Cleanup stale rate limit entries every 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of rateBuckets) { if (v.resetAt < now) rateBuckets.delete(k); }
  for (const [k, v] of hourBuckets) { if (v.resetAt < now) hourBuckets.delete(k); }
}, 600_000);

function checkRateLimit(ip: string): string | null {
  const now = Date.now();

  // Per-minute check
  let min = rateBuckets.get(ip);
  if (!min || min.resetAt < now) { min = { count: 0, resetAt: now + 60_000 }; rateBuckets.set(ip, min); }
  min.count++;
  if (min.count > MAX_REQUESTS_PER_MIN) return 'Too many requests. Please wait a minute.';

  // Per-hour check
  let hr = hourBuckets.get(ip);
  if (!hr || hr.resetAt < now) { hr = { count: 0, resetAt: now + 3_600_000 }; hourBuckets.set(ip, hr); }
  hr.count++;
  if (hr.count > MAX_REQUESTS_PER_HOUR) return 'Hourly limit reached. Please try again later.';

  return null;
}

function checkThreadLimit(ip: string, threadId: string): string | null {
  let threads = ipThreads.get(ip);
  if (!threads) { threads = new Set(); ipThreads.set(ip, threads); }
  threads.add(threadId);
  if (threads.size > MAX_THREADS_PER_IP) return 'Too many active conversations. Please continue an existing one.';
  return null;
}

// Sanitize user input — strip code, scripts, prompt injection attempts
function sanitizeInput(raw: string): string {
  let msg = raw.trim();

  // Hard length limit
  if (msg.length > MAX_MSG_LENGTH) {
    msg = msg.slice(0, MAX_MSG_LENGTH);
  }

  // Strip HTML/script tags
  msg = msg.replace(/<[^>]*>/g, '');

  // Strip markdown code blocks
  msg = msg.replace(/```[\s\S]*?```/g, '[code removed]');
  msg = msg.replace(/`[^`]+`/g, '[code removed]');

  // Strip common prompt injection patterns
  const injectionPatterns = [
    /ignore\s+(all\s+)?(previous|above|prior)\s+(instructions?|prompts?|rules?)/gi,
    /you\s+are\s+now\s+/gi,
    /system\s*:\s*/gi,
    /\[INST\]/gi,
    /<<SYS>>/gi,
    /forget\s+(everything|all|your)\s*/gi,
    /pretend\s+(you\s+are|to\s+be)/gi,
    /act\s+as\s+(a\s+)?different/gi,
    /new\s+instructions?\s*:/gi,
    /override\s+(system|instructions?|rules?)/gi,
  ];

  for (const p of injectionPatterns) {
    if (p.test(msg)) {
      return "I'd like to help with your project estimation. Could you describe what you need built?";
    }
  }

  return msg;
}

// ═══════════════════════════════════════════════════════════════════
// EXTRACT STRUCTURED DATA from agent messages
// ═══════════════════════════════════════════════════════════════════
function extractEstimate(messages: BaseMessage[]): any | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg._getType() === 'tool') {
      try {
        const content = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
        let parsed = JSON.parse(content);
        if (parsed.items && parsed.totalMin != null && parsed.totalMax != null) {
          if (!Array.isArray(parsed.items)) parsed.items = [parsed.items];
          return parsed;
        }
      } catch { }
    }
  }
  return null;
}

function extractBooking(messages: BaseMessage[]): any | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg._getType() === 'tool') {
      try {
        const content = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
        const parsed = JSON.parse(content);
        if (parsed.success != null && parsed.message) {
          return parsed;
        }
      } catch { }
    }
  }
  return null;
}

function extractSlots(messages: BaseMessage[]): any[] | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg._getType() === 'tool') {
      try {
        const content = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
        const parsed = JSON.parse(content);
        if (parsed.slots && Array.isArray(parsed.slots)) {
          const now = Date.now();
          const valid = parsed.slots.filter((s: any) => s.startTime && new Date(s.startTime).getTime() > now);
          console.log(`[Slot extraction] Found tool message with ${parsed.slots.length} slots. Valid: ${valid.length}`);
          if (valid.length > 0) return valid;
        }
      } catch (err) { }
    }
  }
  return null;
}

function extractProjects(messages: BaseMessage[], aiReply: string): any[] | null {
  // Show project cards when Amit mentions projects/case studies in his response
  const triggerWords = ['project', 'built', 'similar project', 'we\'ve done', 'we built', 'past project', 'case study', 'portfolio', 'our work', 'we delivered', 'we created', 'we developed'];
  const lower = aiReply.toLowerCase();
  const shouldShow = triggerWords.some(k => lower.includes(k));
  if (!shouldShow) return null;

  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg._getType() === 'tool') {
      try {
        const content = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
        const parsed = JSON.parse(content);
        if (parsed.projects && Array.isArray(parsed.projects) && parsed.projects.length > 0) {
          return parsed.projects;
        }
      } catch (err) { }
    }
  }
  return null;
}

// ── Health ─────────────────────────────────────────────────────────
app.get('/health', (_, res) => res.json({ ok: true, business: pricing.businessName, tagline: pricing.tagline }));

// ═══════════════════════════════════════════════════════════════════
// CHAT ENDPOINT — with auto-slots on estimate + security
// ═══════════════════════════════════════════════════════════════════
app.post('/api/chat', async (req, res) => {
  const ip = (req.headers['x-forwarded-for'] as string || req.socket.remoteAddress || 'unknown').split(',')[0].trim();
  const { thread_id, message } = req.body;

  // ── Validate basics ─────────────────────────────────────────────
  if (!thread_id || !message?.trim()) {
    return res.status(400).json({ error: 'thread_id and message required' });
  }

  // ── Rate limit check ────────────────────────────────────────────
  const rateErr = checkRateLimit(ip);
  if (rateErr) {
    return res.status(429).json({ reply: rateErr, thread_id, agent: 'system' });
  }

  const threadErr = checkThreadLimit(ip, thread_id);
  if (threadErr) {
    return res.status(429).json({ reply: threadErr, thread_id, agent: 'system' });
  }

  // ── Sanitize input ──────────────────────────────────────────────
  const cleanMsg = sanitizeInput(message);

  try {
    const graph = getGraph();

    // Get previous message count
    let prevMsgCount = 0;
    try {
      const state = await graph.getState({ configurable: { thread_id } });
      prevMsgCount = state?.values?.messages?.length || 0;
    } catch { }

    const result = await graph.invoke(
      { messages: [new HumanMessage(cleanMsg)] },
      { configurable: { thread_id }, recursionLimit: 25 },
    );

    const newMessages = result.messages.slice(prevMsgCount);

    // Get last AI reply
    const reply = result.messages
      .filter((m: any) => m._getType() === 'ai' && typeof m.content === 'string' && m.content.trim())
      .at(-1)?.content as string
      || "I'd love to help! Could you tell me more about what you're looking for?";

    console.log(`\n============================`);
    console.log(`[DEBUG] Final reply:`, reply);
    console.log(`[DEBUG] New Messages count:`, newMessages.length);
    newMessages.forEach((m, idx) => console.log(`[DEBUG] MSG ${idx} (${m._getType()}):`, typeof m.content === 'string' ? m.content.substring(0, 100) : m.content));
    console.log(`============================\n`);

    // Extract structured data
    const estimate = extractEstimate(newMessages);
    const booking = extractBooking(newMessages);
    const projects = extractProjects(newMessages, reply);
    let slots = extractSlots(newMessages);

    // ══════════════════════════════════════════════════════════════
    // AUTO-SLOTS: Safety Net (Estimate or AI Hallucination)
    // ══════════════════════════════════════════════════════════════
    const isDemandingSlots = reply.toLowerCase().includes('time slot') || reply.toLowerCase().includes('choose a time') || reply.toLowerCase().includes('pick a time') || reply.toLowerCase().includes('schedule a call') || reply.toLowerCase().includes('book a call') || reply.toLowerCase().includes('discovery call');

    if ((estimate || isDemandingSlots) && (!slots || slots.length === 0)) {
      try {
        console.log('📅 Auto-fetching slots (Estimate generated or AI bypassed tool)...');
        slots = await fetchAvailableSlots(7);
      } catch (err: any) {
        console.warn('Auto-slot fetch failed:', err.message);
      }
    }

    return res.json({
      reply,
      thread_id,
      agent: result.activeAgent,
      slots: slots && slots.length > 0 ? slots : null,
      estimate,
      booking,
      projects,
    });
  } catch (err: any) {
    console.error('Chat error:', err?.message, err?.stack?.slice(0, 300));
    return res.json({
      reply: "I'm having a brief technical hiccup. Could you try again in a moment?",
      thread_id,
      agent: 'estimation',
    });
  }
});

// ── PDF Upload (with size + type validation) ──────────────────────
app.post('/api/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const { originalname, buffer, mimetype } = req.file;

    // Security: only allow PDF and text
    const allowedTypes = ['application/pdf', 'text/plain', 'text/csv', 'text/markdown'];
    if (!allowedTypes.some(t => mimetype.startsWith(t.split('/')[0]) || mimetype === t)) {
      return res.status(400).json({ error: 'Only PDF and text files are supported' });
    }

    let doc;
    if (mimetype === 'application/pdf') {
      doc = await kb.addPDF(originalname, buffer);
    } else {
      doc = await kb.addTextDoc(originalname, buffer.toString('utf-8'));
    }

    return res.json({ success: true, document: { id: doc.id, filename: doc.filename, chunks: doc.chunks.length } });
  } catch (err: any) {
    console.error('Upload error:', err.message);
    return res.status(500).json({ error: 'Failed to process file: ' + err.message });
  }
});

// ── Knowledge Base ─────────────────────────────────────────────────
app.get('/api/knowledge', (_, res) => res.json({ documents: kb.getDocuments() }));
app.delete('/api/knowledge/:id', (req, res) => {
  const ok = kb.removeDocument();
  return res.json({ success: ok });
});

// ── Calendar Test ──────────────────────────────────────────────────
app.get('/api/calendar/test', async (_, res) => {
  try {
    if (!process.env.GOOGLE_REFRESH_TOKEN) return res.json({ connected: false, reason: 'No refresh token' });
    const { google } = await import('googleapis');
    const auth = new google.auth.OAuth2(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET, process.env.GOOGLE_REDIRECT_URI);
    auth.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
    const cal = google.calendar({ version: 'v3', auth });
    const now = new Date();
    const events = await cal.events.list({
      calendarId: 'primary', timeMin: now.toISOString(),
      timeMax: new Date(now.getTime() + 86400000).toISOString(),
      maxResults: 3, singleEvents: true, orderBy: 'startTime',
    });
    return res.json({ connected: true, eventCount: events.data.items?.length || 0 });
  } catch (err: any) {
    return res.json({ connected: false, reason: err.message });
  }
});

// ── Google Calendar OAuth ──────────────────────────────────────────
app.get('/auth/google', async (_, res) => {
  if (!process.env.GOOGLE_CLIENT_ID) return res.send('<p>Set GOOGLE_CLIENT_ID in .env first.</p>');
  const { google } = await import('googleapis');
  const auth = new google.auth.OAuth2(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET, process.env.GOOGLE_REDIRECT_URI);
  res.redirect(auth.generateAuthUrl({ access_type: 'offline', prompt: 'consent', scope: ['https://www.googleapis.com/auth/calendar'] }));
});

app.get('/auth/google/callback', async (req, res) => {
  const { google } = await import('googleapis');
  const auth = new google.auth.OAuth2(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET, process.env.GOOGLE_REDIRECT_URI);
  try {
    const { tokens } = await auth.getToken(req.query.code as string);
    res.send(`<h2>✅ Connected!</h2><pre style="background:#f4f4f4;padding:16px;border-radius:8px">GOOGLE_REFRESH_TOKEN=${tokens.refresh_token}</pre><p>Add to .env and restart.</p>`);
  } catch (err: any) {
    res.send(`<h2>❌ Error</h2><pre>${err.message}</pre><p><a href="/auth/google">Try again</a></p>`);
  }
});

// ── Start ──────────────────────────────────────────────────────────
const PORT = parseInt(process.env.PORT || '3000');
app.listen(PORT, () => {
  console.log(`\n🚀  http://localhost:${PORT}`);
  console.log(`💬  Chat UI: http://localhost:${PORT}/`);
  console.log(`📅  Calendar setup: http://localhost:${PORT}/auth/google`);
  console.log(`🧪  Calendar test: http://localhost:${PORT}/api/calendar/test`);
  console.log(`📋  Business: ${pricing.businessName}`);
  console.log(`🛡️  Security: Rate limit ${MAX_REQUESTS_PER_MIN}/min, ${MAX_REQUESTS_PER_HOUR}/hr, max ${MAX_MSG_LENGTH} chars\n`);
});
