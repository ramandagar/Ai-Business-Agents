/**
 * Sales Agent Widget — CWS Technology Dark Theme
 * Embed: <script src="https://yourdomain.com/widget.js"
 *   data-url="https://yourdomain.com"
 *   data-name="Sales Assistant"
 *   data-position="bottom-right"></script>
 */
(function () {
  const tag = document.currentScript || document.querySelector('script[data-url]');
  const URL = tag?.getAttribute('data-url') || window.location.origin;
  const NAME = tag?.getAttribute('data-name') || 'CWS Technology';
  const POS = tag?.getAttribute('data-position') || 'bottom-right';
  const side = POS.includes('left') ? 'left:20px' : 'right:20px';

  /* CWS Brand Colors */
  const C = {
    blue: '#2C64E7',
    purple: '#5750FF',
    green: '#3CEDB7',
    dark: '#0a0c12',
    surface: '#12151e',
    surface2: '#181c28',
    surface3: '#1e2233',
  };

  const COOKIE_NAME = 'cws_widget_thread';
  const COOKIE_HOURS = 5;

  function getCookie(name) {
    const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
    return match ? match[2] : null;
  }
  function setCookie(name, value, hours) {
    const d = new Date();
    d.setTime(d.getTime() + hours * 60 * 60 * 1000);
    document.cookie = name + '=' + value + ';expires=' + d.toUTCString() + ';path=/;SameSite=Lax';
  }
  function deleteCookie(name) {
    document.cookie = name + '=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/;SameSite=Lax';
  }

  let thread = getCookie(COOKIE_NAME) || ('w_' + Math.random().toString(36).slice(2) + Date.now());
  setCookie(COOKIE_NAME, thread, COOKIE_HOURS);

  let open = false, busy = false;

  const css = `
    #_sa * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; }

    #_sa_fab {
      position: fixed; ${side}; bottom: 20px; z-index: 999999;
      width: 54px; height: 54px; border-radius: 50%;
      background: linear-gradient(135deg, ${C.blue}, ${C.purple}); border: none; cursor: pointer;
      box-shadow: 0 4px 20px rgba(44, 100, 231, 0.4);
      display: flex; align-items: center; justify-content: center;
      transition: transform 0.2s ease, box-shadow 0.2s ease;
    }
    #_sa_fab:hover { transform: scale(1.08); box-shadow: 0 6px 28px rgba(44, 100, 231, 0.5); }
    #_sa_fab:active { transform: scale(0.96); }
    #_sa_fab svg { width: 22px; height: 22px; fill: white; }

    #_sa_panel {
      position: fixed; ${side}; bottom: 86px; z-index: 999998;
      width: 380px; height: 560px; max-height: calc(100vh - 100px);
      border-radius: 16px; overflow: hidden;
      box-shadow: 0 20px 60px rgba(0,0,0,0.5);
      display: flex; flex-direction: column;
      background: ${C.dark}; border: 1px solid rgba(255,255,255,0.06);
      opacity: 0; transform: translateY(10px) scale(0.97); pointer-events: none;
      transition: opacity 0.25s ease, transform 0.25s ease;
    }
    #_sa_panel.open {
      opacity: 1; transform: translateY(0) scale(1); pointer-events: all;
    }

    #_sa_head {
      display: flex; align-items: center; gap: 10px;
      padding: 14px 16px; border-bottom: 1px solid rgba(255,255,255,0.06);
      background: linear-gradient(135deg, rgba(13,38,101,0.6), rgba(17,45,115,0.4));
      flex-shrink: 0;
    }
    #_sa_hav {
      width: 34px; height: 34px; border-radius: 8px;
      background: linear-gradient(135deg, ${C.blue}, ${C.purple});
      display: flex; align-items: center;
      justify-content: center; color: #fff; font-size: 13px;
      font-weight: 700; flex-shrink: 0;
      box-shadow: 0 2px 8px rgba(44,100,231,0.3);
    }
    #_sa_hinfo { flex: 1; min-width: 0; }
    #_sa_hname { font-size: 13px; font-weight: 600; color: #fff; }
    #_sa_hsub { font-size: 11px; color: #8b90a0; margin-top: 1px; display: flex; align-items: center; gap: 4px; }
    #_sa_hdot { width: 5px; height: 5px; border-radius: 50%; background: ${C.green}; box-shadow: 0 0 6px rgba(60,237,183,0.5); }
    #_sa_x {
      width: 28px; height: 28px; border-radius: 6px;
      background: none; border: 1px solid rgba(255,255,255,0.06);
      color: #8b90a0; cursor: pointer; display: flex;
      align-items: center; justify-content: center; font-size: 14px;
      transition: all 0.15s;
    }
    #_sa_x:hover { background: rgba(255,255,255,0.04); color: #fff; }

    #_sa_msgs {
      flex: 1; overflow-y: auto; padding: 12px;
      display: flex; flex-direction: column; gap: 4px;
      scroll-behavior: smooth; background: ${C.dark};
    }
    #_sa_msgs::-webkit-scrollbar { width: 3px; }
    #_sa_msgs::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 3px; }

    .wm { max-width: 85%; padding: 10px 14px; border-radius: 14px; font-size: 13px; line-height: 1.6; word-break: break-word; }
    .wa {
      background: ${C.surface2}; border: 1px solid rgba(255,255,255,0.06);
      color: #c8ccd8; border-top-left-radius: 4px; align-self: flex-start;
    }
    .wu {
      background: linear-gradient(135deg, ${C.blue}, #3570F5); color: #fff; border-top-right-radius: 4px; align-self: flex-end;
    }
    .wa strong { font-weight: 600; color: #fff; }
    .wa p { margin: 2px 0; }
    .wa p:first-child { margin-top: 0; }
    .wa p:last-child { margin-bottom: 0; }
    .wa ul, .wa ol { padding-left: 16px; margin: 4px 0; }
    .wa li { margin: 2px 0; }
    .wa a { color: ${C.blue}; text-decoration: underline; }
    .wa code { background: rgba(255,255,255,0.06); padding: 1px 4px; border-radius: 3px; font-size: 11px; color: ${C.green}; }

    .wslots { display: flex; flex-direction: column; gap: 5px; margin-top: 6px; }
    .wslot {
      display: flex; align-items: center; gap: 8px;
      padding: 9px 11px; border-radius: 10px;
      background: rgba(44,100,231,0.08); border: 1px solid rgba(44,100,231,0.15);
      cursor: pointer; transition: all 0.15s;
    }
    .wslot:hover { background: rgba(44,100,231,0.15); border-color: rgba(44,100,231,0.35); }
    .wslot-icon {
      width: 28px; height: 28px; border-radius: 6px;
      background: linear-gradient(135deg, ${C.blue}, ${C.purple}); display: flex; align-items: center;
      justify-content: center; color: #fff; font-size: 10px;
      font-weight: 600; flex-shrink: 0;
    }
    .wslot-body { flex: 1; min-width: 0; }
    .wslot-day { font-size: 9px; font-weight: 600; color: ${C.blue}; text-transform: uppercase; letter-spacing: 0.04em; }
    .wslot-time { font-size: 12px; color: #c8ccd8; margin-top: 1px; }
    .wslot-cta {
      font-size: 10px; font-weight: 600; color: ${C.blue};
      padding: 3px 8px; border-radius: 4px;
      background: rgba(44,100,231,0.12); flex-shrink: 0;
    }
    .wslot:hover .wslot-cta { background: ${C.blue}; color: #fff; }

    .wpcards { display: flex; flex-direction: column; gap: 6px; margin-top: 6px; max-width: 85%; }
    .wpcard {
      background: ${C.surface2}; border: 1px solid rgba(255,255,255,0.06);
      border-radius: 10px; padding: 10px; transition: all 0.15s;
    }
    .wpcard:hover { background: ${C.surface3}; border-color: rgba(44,100,231,0.2); }
    .wpcard.clickable { cursor: pointer; }
    .wpcard.clickable:hover { transform: translateY(-1px); box-shadow: 0 2px 12px rgba(44,100,231,0.2); border-color: ${C.blue}; }

    .wt {
      display: flex; align-items: center; gap: 8px;
      padding: 8px 0;
    }
    .wtav {
      width: 28px; height: 28px; border-radius: 8px;
      background: linear-gradient(135deg, ${C.blue}, ${C.purple});
      display: flex; align-items: center; justify-content: center;
      color: #fff; font-size: 10px; font-weight: 700; flex-shrink: 0;
      box-shadow: 0 2px 6px rgba(44,100,231,0.3);
    }
    .wtdots {
      padding: 10px 14px; background: ${C.surface2};
      border: 1px solid rgba(255,255,255,0.06);
      border-radius: 14px; border-top-left-radius: 4px;
      display: flex; align-items: center; gap: 4px;
    }
    .wd {
      width: 5px; height: 5px; border-radius: 50%;
      background: ${C.blue}; animation: wb 1.4s infinite ease-in-out;
    }
    .wd:nth-child(2) { animation-delay: 0.16s; }
    .wd:nth-child(3) { animation-delay: 0.32s; }
    @keyframes wb {
      0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
      30% { transform: translateY(-5px); opacity: 1; }
    }

    #_sa_in_row {
      display: flex; gap: 6px; padding: 8px 10px 10px;
      border-top: 1px solid rgba(255,255,255,0.06); flex-shrink: 0;
      background: rgba(10,12,18,0.92); backdrop-filter: blur(20px);
    }
    #_sa_in {
      flex: 1; background: ${C.surface2}; border: 1px solid rgba(255,255,255,0.06);
      border-radius: 12px; padding: 8px 10px;
      color: #fff; font-size: 13px; outline: none; resize: none;
      max-height: 80px; scrollbar-width: none; transition: border-color 0.15s;
      font-family: inherit;
    }
    #_sa_in::placeholder { color: #5a5f72; }
    #_sa_in:focus { border-color: rgba(44,100,231,0.3); }
    #_sa_send {
      width: 32px; height: 32px; border-radius: 8px;
      background: linear-gradient(135deg, ${C.blue}, ${C.purple}); border: none; cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0; transition: all 0.15s;
      box-shadow: 0 2px 8px rgba(44,100,231,0.3);
    }
    #_sa_send:hover { opacity: 0.9; }
    #_sa_send:active { transform: scale(0.93); }
    #_sa_send svg { width: 14px; height: 14px; fill: white; }

    #_sa_foot { text-align: center; font-size: 9px; color: #5a5f72; padding: 4px; }

    @media(max-width:420px) {
      #_sa_panel { width: calc(100vw - 16px); left: 8px; right: 8px; bottom: 76px; border-radius: 12px; }
    }
  `;

  const el = document.createElement('div');
  el.id = '_sa';
  el.innerHTML =
    '<style>' + css + '</style>' +
    '<button id="_sa_fab"><svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg></button>' +
    '<div id="_sa_panel">' +
    '<div id="_sa_head">' +
    '<div id="_sa_hav">A</div>' +
    '<div id="_sa_hinfo">' +
    '<div id="_sa_hname">' + NAME + '</div>' +
    '<div id="_sa_hsub"><span id="_sa_hdot"></span> Online</div>' +
    '</div>' +
    '<button id="_sa_x" aria-label="Close">&#10005;</button>' +
    '</div>' +
    '<div id="_sa_msgs"></div>' +
    '<div id="_sa_in_row">' +
    '<textarea id="_sa_in" placeholder="Describe your project..." rows="1"></textarea>' +
    '<button id="_sa_send"><svg viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg></button>' +
    '</div>' +
    '<div id="_sa_foot">CWS Technology</div>' +
    '</div>';
  document.body.appendChild(el);

  const msgs = document.getElementById('_sa_msgs');
  const inp = document.getElementById('_sa_in');
  const panel = document.getElementById('_sa_panel');
  const fab = document.getElementById('_sa_fab');

  function mdW(t) {
    let h = t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    h = h.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    h = h.replace(/`([^`]+)`/g, '<code style="background:rgba(255,255,255,0.06);padding:1px 4px;border-radius:3px;font-size:11px;color:' + C.green + '">$1</code>');
    h = h.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>');
    const lines = h.split('\n'); const out = []; let ul = false, ol = false;
    for (const l of lines) {
      const um = l.match(/^[-*]\s+(.+)/), om = l.match(/^\d+\.\s+(.+)/);
      if (um) { if (!ul) { out.push('<ul>'); ul = true; } if (ol) { out.push('</ol>'); ol = false; } out.push('<li>' + um[1] + '</li>'); }
      else if (om) { if (!ol) { out.push('<ol>'); ol = true; } if (ul) { out.push('</ul>'); ul = false; } out.push('<li>' + om[1] + '</li>'); }
      else { if (ul) { out.push('</ul>'); ul = false; } if (ol) { out.push('</ol>'); ol = false; } if (l.trim()) out.push('<p>' + l + '</p>'); }
    }
    if (ul) out.push('</ul>'); if (ol) out.push('</ol>');
    return out.join('');
  }

  function scroll() { requestAnimationFrame(() => { msgs.scrollTop = msgs.scrollHeight; }); }

  function addMsg(role, text) {
    const d = document.createElement('div');
    d.className = 'wm ' + (role === 'agent' ? 'wa' : 'wu');
    if (role === 'agent') d.innerHTML = mdW(text); else d.textContent = text;
    msgs.appendChild(d); scroll(); return d;
  }

  function renderSlotsW(slots) {
    const wrap = document.createElement('div');
    wrap.className = 'wslots';
    slots.forEach(s => {
      const item = document.createElement('div');
      item.className = 'wslot';
      const slotText = s.day + ', ' + s.date + ' at ' + s.time;
      item.innerHTML =
        '<div class="wslot-icon">C</div>' +
        '<div class="wslot-body">' +
        '<div class="wslot-day">' + s.day + '</div>' +
        '<div class="wslot-time">' + s.date + ' at ' + s.time + '</div>' +
        '</div>' +
        '<div class="wslot-cta">Book</div>';
      item.onclick = () => {
        if (busy) return;
        wrap.querySelectorAll('.wslot').forEach(b => { b.style.opacity = '0.35'; b.style.pointerEvents = 'none'; });
        item.style.opacity = '1';
        sendMsg(slotText);
      };
      wrap.appendChild(item);
    });
    msgs.appendChild(wrap);
    scroll();
  }

  function renderProjectsW(projects) {
    if (!projects || !projects.length) return;
    const wrap = document.createElement('div');
    wrap.className = 'wpcards';
    projects.forEach(function (p) {
      const card = document.createElement('div');
      const hasUrl = !!p.url;
      card.className = 'wpcard' + (hasUrl ? ' clickable' : '');
      let html = '<div style="display:flex;justify-content:space-between;margin-bottom:4px"><div style="font-size:12px;font-weight:600;color:' + C.blue + '">' + (p.name || '') + '</div>';
      if (p.cost) html += '<div style="font-size:10px;color:#8b90a0">$' + Number(p.cost).toLocaleString() + '</div>';
      html += '</div>';
      if (p.description || p.scope) html += '<div style="font-size:11px;color:#8b90a0;line-height:1.4">' + (p.description || p.scope || '') + '</div>';
      if (p.impact) html += '<div style="font-size:10px;color:' + C.green + ';margin-top:4px;font-weight:500">' + p.impact + '</div>';
      if (hasUrl) html += '<div style="font-size:10px;color:' + C.blue + ';margin-top:3px">View Project &rarr;</div>';
      card.innerHTML = html;
      if (hasUrl) card.onclick = function () { window.open(p.url, '_blank'); };
      wrap.appendChild(card);
    });
    msgs.appendChild(wrap);
    scroll();
  }

  function showTyping() {
    const d = document.createElement('div');
    d.id = '_sa_t'; d.className = 'wt';
    d.innerHTML =
      '<div class="wtav">A</div>' +
      '<div class="wtdots"><div class="wd"></div><div class="wd"></div><div class="wd"></div></div>';
    msgs.appendChild(d); scroll();
  }
  function hideTyping() { document.getElementById('_sa_t')?.remove(); }

  async function sendMsg(preset) {
    const m = (preset || inp.value || '').trim();
    if (!m || busy) return;
    if (!preset) { inp.value = ''; inp.style.height = 'auto'; }
    addMsg('user', m);
    busy = true; showTyping();
    try {
      const r = await fetch(URL + '/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ thread_id: thread, message: m }),
      });
      const d = await r.json();
      hideTyping();
      if (d.reply) addMsg('agent', d.reply);
      if (d.projects && d.projects.length > 0) renderProjectsW(d.projects);
      if (d.slots && d.slots.length > 0) renderSlotsW(d.slots);
    } catch {
      hideTyping();
      addMsg('agent', 'Something went wrong. Please try again.');
    }
    busy = false;
    if (!preset) inp.focus();
  }

  // ── Restore chat from Supabase ────────────────────────────────
  let restored = false;
  async function restoreChat() {
    const savedThread = getCookie(COOKIE_NAME);
    if (!savedThread || restored) return;
    try {
      const r = await fetch(URL + '/api/chat/' + savedThread);
      const data = await r.json();
      if (!data.messages || data.messages.length === 0) return;
      restored = true;
      for (const msg of data.messages) {
        const role = msg.role === 'user' ? 'user' : 'agent';
        const d = document.createElement('div');
        d.className = 'wm ' + (role === 'agent' ? 'wa' : 'wu');
        if (role === 'agent') d.innerHTML = mdW(msg.content); else d.textContent = msg.content;
        msgs.appendChild(d);
      }
      scroll();
    } catch (e) { }
  }

  function toggle() {
    open = !open;
    panel.classList.toggle('open', open);
    fab.innerHTML = open
      ? '<svg viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>'
      : '<svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>';
    if (open && !msgs.children.length) {
      restoreChat().then(() => {
        if (!msgs.children.length) {
          addMsg('agent', "Hi! I'm Amit from CWS Technology. Tell me what you're looking to build and I'll get you a cost estimate.");
        }
        inp.focus();
      });
    }
    if (open) setTimeout(() => { inp.focus(); scroll(); }, 200);
  }

  fab.addEventListener('click', toggle);
  document.getElementById('_sa_x').addEventListener('click', toggle);
  document.getElementById('_sa_send').addEventListener('click', () => sendMsg());
  inp.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMsg(); } });
  inp.addEventListener('input', () => { inp.style.height = 'auto'; inp.style.height = Math.min(inp.scrollHeight, 80) + 'px'; });
})();
