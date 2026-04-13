# AI Business Agents

Two AI-powered agents built for billingbee.co using Google Gemini, LangChain, and LangGraph.

## Projects

### [Auto Blog Posting Agent](./auto-blog-posting-agent)

Autonomous blog generation pipeline with RAG, SEO optimization, and image generation.

- LangGraph DAG pipeline (6 nodes, conditional edges)
- RAG with vector embeddings for content context
- Two-mode topic discovery: "Deepen" existing topics or find "White Space"
- AI image generation for hero images
- Cron-based auto-posting schedule
- Site crawler that auto-extracts brand info from any URL

```
cd auto-blog-posting-agent
cp .env.example .env   # add your GEMINI_API_KEY
npm install && npm run build && npm start
```

Runs on `http://localhost:3001`

### [Sales Estimation Agent](./sales-estimation-agent)

Interactive project scoping and estimation assistant.

```
cd sales-estimation-agent
npm install && npm run dev:sales
```

Runs on `http://localhost:3000`

## Tech Stack

- **AI**: Google Gemini (gemini-2.5-flash, text-embedding-001)
- **Framework**: LangChain + LangGraph
- **Runtime**: Node.js + TypeScript + Express
- **Storage**: File-based JSON (no external DB needed)

## Running Both

Open two terminals:

```bash
# Terminal 1
cd sales-estimation-agent && npm run dev:sales

# Terminal 2
cd auto-blog-posting-agent && npm run build && npm start
```
