# 🤖 Auto Blog Agent

An autonomous AI Blogging System that researches, writes, and auto-posts high-quality, SEO-optimized content. Designed to be embedded into any website via a single script tag.

## 🚀 Features

- **Autonomous Posting**: Set a schedule (e.g., daily at 9 AM) and let the agent handle everything.
- **RAG-Powered Writing**: Remembers past blogs to avoid repetition and maintain brand voice consistency.
- **SEO Optimization**: Automatic generation of meta titles, descriptions, and clean slugs. Includes internal linking to previous posts.
- **AI Images**: Generates contextually relevant images for every post using Gemini Imagen.
- **Multi-Site Dashboard**: Manage multiple websites from a single premium glassmorphism interface.
- **Easy Embedding**: Embed your blog onto any site using a simple `<script>` tag.

## 🛠️ Setup

1. **API Key**: Add your Gemini API Key to `.env`:
   ```env
   GEMINI_API_KEY=your_key_here
   ```

2. **Install Dependencies**:
   ```bash
   npm install
   ```

3. **Start the Server**:
   ```bash
   npm run dev:blog
   ```

4. **Seed Demo Data (Optional)**:
   ```bash
   npm run seed:blog
   ```

5. **Access Dashboard**:
   Go to `http://localhost:3001`

## 🔗 How to Embed

Simply add this code to your target website:

```html
<div id="auto-blog-widget"></div>
<script 
  src="http://localhost:3001/widget.js" 
  data-site-id="YOUR_SITE_ID"
  data-theme="dark">
</script>
```

## 🏗️ Technical Architecture

- **Backend**: Node.js, Express, TypeScript
- **AI**: Gemini 2.0 Flash (for speed & high-quality writing)
- **RAG**: In-memory Vector Store (cosine similarity)
- **Persistence**: File-based JSON storage (per-site data separation)
- **Frontend**: Vanilla JS, CSS (Clean glassmorphism design)
