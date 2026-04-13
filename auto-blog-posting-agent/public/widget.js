/**
 * Auto Blog Agent — Embeddable Widget
 * 
 * Usage: Add this script to any website:
 * <script src="http://your-server:3001/widget.js" data-site-id="YOUR_SITE_ID"></script>
 * <div id="auto-blog-widget"></div>
 * 
 * Or for a specific container:
 * <div id="my-blog" data-auto-blog data-site-id="YOUR_SITE_ID"></div>
 */
(function() {
  'use strict';

  // Find the script tag to get configuration
  const scriptTag = document.currentScript || document.querySelector('script[data-site-id]');
  const siteId = scriptTag ? scriptTag.getAttribute('data-site-id') : null;
  const serverUrl = scriptTag ? (scriptTag.getAttribute('data-server') || scriptTag.src.replace('/widget.js', '')) : '';
  const containerId = scriptTag ? (scriptTag.getAttribute('data-container') || 'auto-blog-widget') : 'auto-blog-widget';
  const theme = scriptTag ? (scriptTag.getAttribute('data-theme') || 'dark') : 'dark';

  if (!siteId) {
    console.error('[AutoBlog] Missing data-site-id attribute on script tag');
    return;
  }

  // Inject styles
  const style = document.createElement('style');
  style.textContent = `
    .ab-widget {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      max-width: 900px;
      margin: 0 auto;
      padding: 2rem 1rem;
    }
    .ab-widget * { box-sizing: border-box; }
    .ab-widget.dark { color: #e0e0e0; }
    .ab-widget.light { color: #1a1a2e; }

    .ab-header {
      text-align: center;
      margin-bottom: 3rem;
    }
    .ab-header h2 {
      font-size: 2rem;
      font-weight: 700;
      margin: 0 0 0.5rem;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }
    .ab-header p {
      opacity: 0.7;
      font-size: 1rem;
    }

    .ab-posts-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 1.5rem;
    }

    .ab-card {
      border-radius: 16px;
      overflow: hidden;
      transition: all 0.3s ease;
      cursor: pointer;
    }
    .ab-widget.dark .ab-card {
      background: rgba(255,255,255,0.05);
      border: 1px solid rgba(255,255,255,0.08);
    }
    .ab-widget.light .ab-card {
      background: #fff;
      border: 1px solid rgba(0,0,0,0.08);
      box-shadow: 0 2px 12px rgba(0,0,0,0.06);
    }
    .ab-card:hover {
      transform: translateY(-4px);
      box-shadow: 0 8px 30px rgba(102,126,234,0.15);
    }
    .ab-widget.dark .ab-card:hover {
      border-color: rgba(102,126,234,0.3);
    }

    .ab-card-img {
      width: 100%;
      height: 180px;
      object-fit: cover;
      display: block;
    }

    .ab-card-body {
      padding: 1.25rem;
    }

    .ab-card-category {
      display: inline-block;
      font-size: 0.7rem;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      font-weight: 600;
      padding: 0.2rem 0.65rem;
      border-radius: 999px;
      background: linear-gradient(135deg, #667eea, #764ba2);
      color: #fff;
      margin-bottom: 0.75rem;
    }

    .ab-card-title {
      font-size: 1.1rem;
      font-weight: 700;
      margin: 0 0 0.5rem;
      line-height: 1.3;
    }
    .ab-widget.dark .ab-card-title { color: #fff; }
    .ab-widget.light .ab-card-title { color: #1a1a2e; }

    .ab-card-excerpt {
      font-size: 0.88rem;
      line-height: 1.6;
      opacity: 0.7;
      margin: 0 0 1rem;
      display: -webkit-box;
      -webkit-line-clamp: 3;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }

    .ab-card-meta {
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-size: 0.75rem;
      opacity: 0.5;
    }

    .ab-card-tags {
      display: flex;
      gap: 0.4rem;
      flex-wrap: wrap;
      margin-top: 0.75rem;
    }
    .ab-tag {
      font-size: 0.7rem;
      padding: 0.15rem 0.5rem;
      border-radius: 999px;
      opacity: 0.6;
    }
    .ab-widget.dark .ab-tag { background: rgba(255,255,255,0.08); }
    .ab-widget.light .ab-tag { background: rgba(0,0,0,0.06); }

    /* Full post view */
    .ab-post-view {
      animation: abFadeIn 0.3s ease;
    }
    @keyframes abFadeIn {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .ab-back-btn {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      font-size: 0.9rem;
      cursor: pointer;
      opacity: 0.6;
      transition: opacity 0.2s;
      border: none;
      background: none;
      color: inherit;
      padding: 0.5rem 0;
      margin-bottom: 1.5rem;
    }
    .ab-back-btn:hover { opacity: 1; }

    .ab-post-hero {
      width: 100%;
      max-height: 400px;
      object-fit: cover;
      border-radius: 16px;
      margin-bottom: 2rem;
    }

    .ab-post-title {
      font-size: 2.2rem;
      font-weight: 800;
      line-height: 1.2;
      margin: 0 0 1rem;
    }
    .ab-widget.dark .ab-post-title { color: #fff; }

    .ab-post-meta-bar {
      display: flex;
      align-items: center;
      gap: 1.5rem;
      font-size: 0.85rem;
      opacity: 0.6;
      margin-bottom: 2rem;
      padding-bottom: 1.5rem;
      border-bottom: 1px solid rgba(128,128,128,0.2);
    }

    .ab-post-content {
      font-size: 1.05rem;
      line-height: 1.8;
    }
    .ab-post-content h2 {
      font-size: 1.5rem;
      font-weight: 700;
      margin: 2.5rem 0 1rem;
    }
    .ab-post-content h3 {
      font-size: 1.2rem;
      font-weight: 600;
      margin: 2rem 0 0.75rem;
    }
    .ab-post-content p { margin: 0 0 1.2rem; }
    .ab-post-content img {
      max-width: 100%;
      border-radius: 12px;
      margin: 1.5rem 0;
    }
    .ab-post-content ul, .ab-post-content ol {
      padding-left: 1.5rem;
      margin: 0 0 1.2rem;
    }
    .ab-post-content li { margin-bottom: 0.5rem; }
    .ab-post-content blockquote {
      border-left: 3px solid #667eea;
      padding: 0.75rem 1rem;
      margin: 1.5rem 0;
      opacity: 0.85;
      font-style: italic;
    }
    .ab-post-content code {
      font-family: 'Fira Code', monospace;
      font-size: 0.9em;
      padding: 0.15rem 0.4rem;
      border-radius: 4px;
    }
    .ab-widget.dark .ab-post-content code { background: rgba(255,255,255,0.08); }
    .ab-widget.light .ab-post-content code { background: rgba(0,0,0,0.06); }
    .ab-post-content pre {
      border-radius: 12px;
      padding: 1.25rem;
      overflow-x: auto;
      margin: 1.5rem 0;
      font-size: 0.85rem;
    }
    .ab-widget.dark .ab-post-content pre { background: rgba(0,0,0,0.3); }
    .ab-widget.light .ab-post-content pre { background: #f5f5f5; }

    .ab-loading {
      text-align: center;
      padding: 3rem;
      opacity: 0.5;
    }
    .ab-loading-spinner {
      width: 32px; height: 32px;
      border: 3px solid rgba(102,126,234,0.2);
      border-top-color: #667eea;
      border-radius: 50%;
      animation: abSpin 0.8s linear infinite;
      margin: 0 auto 1rem;
    }
    @keyframes abSpin { to { transform: rotate(360deg); } }

    .ab-empty {
      text-align: center;
      padding: 3rem;
      opacity: 0.4;
    }
  `;
  document.head.appendChild(style);

  // Load Inter font if not already loaded
  if (!document.querySelector('link[href*="Inter"]')) {
    const fontLink = document.createElement('link');
    fontLink.rel = 'stylesheet';
    fontLink.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap';
    document.head.appendChild(fontLink);
  }

  // State
  let posts = [];
  let currentView = 'list'; // 'list' or 'post'
  let currentPost = null;

  // Get or create container
  let container = document.getElementById(containerId);
  if (!container) {
    container = document.createElement('div');
    container.id = containerId;
    scriptTag.parentNode.insertBefore(container, scriptTag.nextSibling);
  }

  const widget = document.createElement('div');
  widget.className = `ab-widget ${theme}`;
  container.appendChild(widget);

  // Render functions
  function renderLoading() {
    widget.innerHTML = `
      <div class="ab-loading">
        <div class="ab-loading-spinner"></div>
        <p>Loading posts...</p>
      </div>
    `;
  }

  function renderEmpty() {
    widget.innerHTML = `
      <div class="ab-empty">
        <p>No blog posts published yet. Check back soon!</p>
      </div>
    `;
  }

  function formatDate(dateStr) {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric'
    });
  }

  // Resolve an image object to a usable <img> src.
  // Titan images come back as base64 strings; fallback to url.
  function imgSrc(imageObj) {
    if (!imageObj) return 'https://placehold.co/896x512/1a1a2e/667eea?text=Blog';
    if (imageObj.base64) return `data:image/png;base64,${imageObj.base64}`;
    return imageObj.url || 'https://placehold.co/896x512/1a1a2e/667eea?text=Blog';
  }

  function renderPostList() {
    currentView = 'list';
    if (posts.length === 0) return renderEmpty();

    let html = `
      <div class="ab-header">
        <h2>Latest Posts</h2>
        <p>Discover our latest articles and insights</p>
      </div>
      <div class="ab-posts-grid">
    `;

    for (const post of posts) {
      const src = imgSrc(post.featuredImage);
      html += `
        <div class="ab-card" data-slug="${post.slug}">
          <img class="ab-card-img" src="${src}" alt="${post.title}" loading="lazy">
          <div class="ab-card-body">
            <span class="ab-card-category">${post.category || 'Blog'}</span>
            <h3 class="ab-card-title">${post.title}</h3>
            <p class="ab-card-excerpt">${post.excerpt || ''}</p>
            <div class="ab-card-meta">
              <span>${formatDate(post.publishedAt)}</span>
              <span>${post.estimatedReadTime || 5} min read</span>
            </div>
            <div class="ab-card-tags">
              ${(post.tags || []).slice(0, 3).map(t => `<span class="ab-tag">${t}</span>`).join('')}
            </div>
          </div>
        </div>
      `;
    }

    html += '</div>';
    widget.innerHTML = html;

    // Add click handlers
    widget.querySelectorAll('.ab-card').forEach(card => {
      card.addEventListener('click', () => {
        const slug = card.getAttribute('data-slug');
        const post = posts.find(p => p.slug === slug);
        if (post) renderPostView(post);
      });
    });
  }

  function renderPostView(post) {
    currentView = 'post';
    currentPost = post;
    
    const heroSrc = imgSrc(post.featuredImage);
    const heroImg = `<img class="ab-post-hero" src="${heroSrc}" alt="${post.title}">`;

    widget.innerHTML = `
      <div class="ab-post-view">
        <button class="ab-back-btn" id="ab-back">← Back to posts</button>
        ${heroImg}
        <h1 class="ab-post-title">${post.title}</h1>
        <div class="ab-post-meta-bar">
          <span>${formatDate(post.publishedAt)}</span>
          <span>${post.estimatedReadTime || 5} min read</span>
          <span>${post.wordCount || 0} words</span>
          <span>${post.category || ''}</span>
        </div>
        <div class="ab-post-content">${post.content}</div>
        <div class="ab-card-tags" style="margin-top:2rem;">
          ${(post.tags || []).map(t => `<span class="ab-tag">${t}</span>`).join('')}
        </div>
      </div>
    `;

    // Add schema markup
    if (post.schemaMarkup) {
      const schemaScript = document.createElement('script');
      schemaScript.type = 'application/ld+json';
      schemaScript.textContent = post.schemaMarkup;
      document.head.appendChild(schemaScript);
    }

    document.getElementById('ab-back').addEventListener('click', renderPostList);
    window.scrollTo({ top: container.offsetTop - 20, behavior: 'smooth' });
  }

  // Fetch posts
  async function loadPosts() {
    renderLoading();
    try {
      const resp = await fetch(`${serverUrl}/api/widget/${siteId}/posts`);
      if (!resp.ok) throw new Error('Failed to fetch posts');
      const data = await resp.json();
      posts = data.posts || [];
      renderPostList();
    } catch (err) {
      console.error('[AutoBlog] Failed to load posts:', err);
      widget.innerHTML = '<div class="ab-empty"><p>Unable to load posts. Please try again later.</p></div>';
    }
  }

  // Initialize
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadPosts);
  } else {
    loadPosts();
  }

  // Expose API for programmatic use
  window.AutoBlog = {
    refresh: loadPosts,
    getPosts: () => posts,
    navigateToPost: (slug) => {
      const post = posts.find(p => p.slug === slug);
      if (post) renderPostView(post);
    },
  };
})();
