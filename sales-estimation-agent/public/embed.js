/**
 * Sales Agent — Full-page embed
 * Embed: <script src="https://yourdomain.com/embed.js"></script>
 *
 * Loads the chat UI into a positioned panel on the page.
 * Supports data attributes:
 *   data-url="https://yourdomain.com"
 *   data-target="#my-container"  — CSS selector for mount point (default: body)
 *   data-width="480px"
 *   data-height="100vh"
 */
(function () {
  if (window._SA_EMBED_LOADED) return;
  window._SA_EMBED_LOADED = true;

  const tag = document.currentScript || document.querySelector('script[data-url]');
  const URL = tag?.getAttribute('data-url') || window.location.origin;
  const target = tag?.getAttribute('data-target') || 'body';
  const width = tag?.getAttribute('data-width') || '480px';
  const height = tag?.getAttribute('data-height') || '100vh';

  const style = document.createElement('style');
  style.textContent = `
    #_sa_embed {
      width: ${width};
      height: ${height};
      border: none;
      border-left: 1px solid rgba(0,0,0,0.08);
      border-right: 1px solid rgba(0,0,0,0.08);
      display: block;
      background: #ffffff;
    }
  `;
  document.head.appendChild(style);

  const iframe = document.createElement('iframe');
  iframe.id = '_sa_embed';
  iframe.src = URL + '?embedded=true';
  iframe.setAttribute('allow', 'clipboard-write');
  iframe.setAttribute('loading', 'lazy');

  const mount = document.querySelector(target) || document.body;
  mount.appendChild(iframe);
})();
