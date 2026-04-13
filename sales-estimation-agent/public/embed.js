/**
 * CWS Technology - Embeddable Chat Widget
 * Embed on any website with: <script src="http://localhost:3001/embed.js"></script>
 */
(function () {
  if (window.CWS_WIDGET_LOADED) return;
  window.CWS_WIDGET_LOADED = true;

  const config = {
    serverUrl: 'http://localhost:3001', // Update to production domain
    color: '#6366F1'
  };

  const style = document.createElement('style');
  style.innerHTML = `
    #cws-widget-btn {
      position: fixed; bottom: 24px; right: 24px; z-index: 9999999;
      width: 60px; height: 60px; border-radius: 50%;
      background: ${config.color}; border: none; cursor: pointer;
      box-shadow: 0 8px 24px rgba(0,0,0,0.3);
      display: flex; align-items: center; justify-content: center;
      transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.2s;
    }
    #cws-widget-btn:hover { transform: translateY(-3px) scale(1.05); box-shadow: 0 12px 32px rgba(99, 102, 241, 0.4); }
    #cws-widget-btn svg { width: 30px; height: 30px; fill: white; }

    #cws-widget-container {
      position: fixed; bottom: 100px; right: 24px; z-index: 9999998;
      width: 400px; height: 75vh; max-height: 700px;
      background: transparent; border-radius: 24px;
      box-shadow: 0 16px 64px rgba(0,0,0,0.4); overflow: hidden;
      opacity: 0; transform: translateY(20px) scale(0.95); pointer-events: none;
      transition: opacity 0.3s ease, transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
    }
    #cws-widget-container.cws-open {
      opacity: 1; transform: translateY(0) scale(1); pointer-events: all;
    }

    #cws-widget-iframe {
      width: 100%; height: 100%; border: none; background: #0A0A0A;
    }

    @media (max-width: 480px) {
      #cws-widget-container {
        bottom: 0; right: 0; width: 100vw; height: 100vh;
        max-width: 100%; max-height: 100%; border-radius: 0;
      }
    }
  `;
  document.head.appendChild(style);

  // Widget Container
  const container = document.createElement('div');
  container.id = 'cws-widget-container';
  
  // Replace the background in iframe dynamically or just load index.html which is already styled
  const iframe = document.createElement('iframe');
  iframe.src = config.serverUrl + '?embedded=true'; // Passes embedded flag
  iframe.id = 'cws-widget-iframe';
  container.appendChild(iframe);
  document.body.appendChild(container);

  // Toggle Button
  const btn = document.createElement('button');
  btn.id = 'cws-widget-btn';
  btn.innerHTML = `<svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>`;
  document.body.appendChild(btn);

  let open = false;
  btn.onclick = () => {
    open = !open;
    container.classList.toggle('cws-open', open);
    btn.innerHTML = open
      ? `<svg viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>`
      : `<svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>`;
  };
})();
