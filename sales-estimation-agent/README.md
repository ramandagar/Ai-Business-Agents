# Sales Estimation Agent — Multi-Agent AI

LangGraph + TypeScript + Gemini 2.5 Pro + Google Calendar

## Quick Start

```bash
npm install
cp .env.example .env
# Add your GEMINI_API_KEY (get free at aistudio.google.com)
npm run dev
```

Open http://localhost:3001 — chat UI is ready.

## Gemini API Key

1. Go to https://aistudio.google.com
2. Click "Get API Key" → Create API Key
3. Paste into .env as `GEMINI_API_KEY=AIza...`

Model used: `gemini-2.5-pro` (latest stable, best reasoning + tool calling)

## Embed on Any Website

**Option 1: Full page embed (iframe)**
```html
<iframe src="https://yourdomain.com" width="100%" height="600px" frameborder="0"></iframe>
```

**Option 2: Floating chat widget**
```html
<script src="https://yourdomain.com/widget.js"
  data-url="https://yourdomain.com"
  data-name="Priya"
  data-color="#6366F1"
  data-position="bottom-right">
</script>
```

## Customize Your Pricing

Edit `pricing.json` — add your services, prices, and policies.
The agent ONLY quotes from this file. Zero hallucination.

## Google Calendar Setup (optional)

1. Go to console.cloud.google.com
2. New project → Enable Google Calendar API
3. Credentials → OAuth 2.0 → Web App
4. Add redirect URI: http://localhost:3001/auth/google/callback
5. Copy CLIENT_ID + CLIENT_SECRET to .env
6. Start server → visit http://localhost:3001/auth/google
7. Authorize → copy REFRESH_TOKEN shown → paste in .env → restart

Without this, the agent uses test slots (no real calendar events).

## Architecture

```
Client Message
      ↓
  Supervisor (Gemini 2.5 Pro)
  "which agent handles this?"
      ↓
  ┌───────────┬──────────────┬────────────┐
  │ Estimation │ Negotiation  │  Booking   │
  │  Agent    │   Agent      │   Agent    │
  │           │              │            │
  │ Tools:    │ No tools —   │ Tools:     │
  │ searchKB  │ pure LLM     │ getSlots   │
  │ buildEst  │ reasoning    │ createBook │
  └───────────┴──────────────┴────────────┘
```

## Deploy

```bash
npm run build
npm start
```

Deploy to Railway, Render, or Fly.io (all free tiers available).
Change `data-url` in widget to your deployed URL.
