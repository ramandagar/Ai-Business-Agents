/**
 * Sales Agent Widget — embed on any website with one line:
 *
 * <script src="https://yourdomain.com/widget.js"
 *   data-url="https://yourdomain.com"
 *   data-name="Sales Assistant"
 *   data-color="#6366F1"
 *   data-position="bottom-right">
 * </script>
 */
(function () {
  const tag    = document.currentScript || document.querySelector('script[data-url]');
  const URL    = tag?.getAttribute('data-url') || window.location.origin;
  const NAME   = tag?.getAttribute('data-name') || 'Sales Assistant';
  const COLOR  = tag?.getAttribute('data-color') || '#6366F1';
  const POS    = tag?.getAttribute('data-position') || 'bottom-right';
  const side   = POS.includes('left') ? 'left:20px' : 'right:20px';

  const KEY = `sa_w_${URL}`;
  let thread = localStorage.getItem(KEY) || ('w_' + Math.random().toString(36).slice(2) + Date.now());
  localStorage.setItem(KEY, thread);

  let open = false, busy = false;

  const css = `
    #_sa * { box-sizing:border-box; margin:0; padding:0; font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; }
    #_sa_btn {
      position:fixed; ${side}; bottom:20px; z-index:999999;
      width:56px; height:56px; border-radius:50%;
      background:${COLOR}; border:none; cursor:pointer;
      box-shadow:0 4px 20px rgba(0,0,0,0.3);
      display:flex; align-items:center; justify-content:center;
      transition:transform .2s, box-shadow .2s;
    }
    #_sa_btn:hover { transform:scale(1.08); box-shadow:0 6px 28px rgba(0,0,0,0.35); }
    #_sa_btn svg { width:24px; height:24px; fill:white; }

    #_sa_panel {
      position:fixed; ${side}; bottom:86px; z-index:999998;
      width:380px; height:580px; max-height:calc(100vh - 100px);
      border-radius:20px; overflow:hidden;
      box-shadow:0 16px 56px rgba(0,0,0,0.5);
      display:flex; flex-direction:column;
      background:#09090B; border:1px solid rgba(255,255,255,0.06);
      opacity:0; transform:translateY(12px) scale(0.96); pointer-events:none;
      transition:opacity .2s, transform .2s;
    }
    #_sa_panel.on { opacity:1; transform:translateY(0) scale(1); pointer-events:all; }

    #_sa_head {
      padding:14px 16px; background:${COLOR};
      display:flex; align-items:center; gap:10px; flex-shrink:0;
    }
    #_sa_av {
      width:34px; height:34px; border-radius:10px;
      background:rgba(255,255,255,0.2);
      display:flex; align-items:center; justify-content:center;
      font-size:16px; flex-shrink:0;
    }
    #_sa_hinfo { flex:1; }
    #_sa_hname { font-size:14px; font-weight:600; color:#fff; }
    #_sa_hsub  { font-size:11px; color:rgba(255,255,255,0.7); margin-top:1px; }
    #_sa_close { background:none; border:none; color:rgba(255,255,255,0.8); cursor:pointer; font-size:18px; padding:2px; line-height:1; }
    #_sa_close:hover { color:#fff; }

    #_sa_msgs {
      flex:1; overflow-y:auto; padding:14px;
      display:flex; flex-direction:column; gap:10px;
      scroll-behavior:smooth;
    }
    #_sa_msgs::-webkit-scrollbar { width:3px; }
    #_sa_msgs::-webkit-scrollbar-thumb { background:rgba(255,255,255,0.08); border-radius:3px; }

    .wm { max-width:85%; padding:10px 14px; border-radius:15px; font-size:13px; line-height:1.6; word-break:break-word; }
    .wa { background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.06); color:#D4D4D8; border-bottom-left-radius:3px; align-self:flex-start; }
    .wu { background:${COLOR}; color:#fff; border-bottom-right-radius:3px; align-self:flex-end; }
    .wa strong { font-weight:700; color:#fff; }
    .wa ul,.wa ol { padding-left:16px; margin:4px 0; }
    .wa li { margin:2px 0; }
    .wa p { margin:3px 0; }
    .wa p:first-child { margin-top:0; } .wa p:last-child { margin-bottom:0; }

    .wslots { display:flex; flex-wrap:wrap; gap:6px; margin-top:8px; }
    .wslot {
      padding:8px 12px; border-radius:10px; font-size:11px;
      background:rgba(99,102,241,0.08); border:1px solid rgba(99,102,241,0.15);
      color:#A5B4FC; cursor:pointer; transition:all .15s;
    }
    .wslot:hover { background:rgba(99,102,241,0.15); border-color:rgba(99,102,241,0.3); }

    .wt { display:flex; align-items:center; gap:4px; padding:10px 14px; background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.06); border-radius:15px; border-bottom-left-radius:3px; align-self:flex-start; }
    .wd { width:6px; height:6px; border-radius:50%; background:#71717A; animation:wb 1.4s infinite; }
    .wd:nth-child(2){animation-delay:.2s} .wd:nth-child(3){animation-delay:.4s}
    @keyframes wb { 0%,60%,100%{transform:translateY(0);background:#71717A} 30%{transform:translateY(-6px);background:${COLOR}} }

    #_sa_in_row {
      display:flex; gap:8px; padding:10px 12px;
      border-top:1px solid rgba(255,255,255,0.06); flex-shrink:0;
      background:#09090B;
    }
    #_sa_in {
      flex:1; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.08);
      border-radius:12px; padding:8px 12px;
      color:#F1F1F3; font-size:13px; outline:none; resize:none;
      max-height:80px; scrollbar-width:none; transition:border-color .15s;
      font-family:inherit;
    }
    #_sa_in::placeholder { color:#71717A; }
    #_sa_in:focus { border-color:${COLOR}66; }
    #_sa_send {
      width:34px; height:34px; border-radius:50%; background:${COLOR};
      border:none; cursor:pointer; display:flex; align-items:center;
      justify-content:center; flex-shrink:0; transition:opacity .15s;
    }
    #_sa_send:hover { opacity:.85; }
    #_sa_send svg { width:15px; height:15px; fill:white; }
    #_sa_pow { text-align:center; font-size:10px; color:#3F3F46; padding:5px; }
    @media(max-width:420px){ #_sa_panel{width:calc(100vw - 20px); left:10px; right:10px; } }
  `;

  const div = document.createElement('div');
  div.id = '_sa';
  div.innerHTML = `
    <style>${css}</style>
    <button id="_sa_btn"><svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg></button>
    <div id="_sa_panel">
      <div id="_sa_head">
        <div id="_sa_av">🤖</div>
        <div id="_sa_hinfo">
          <div id="_sa_hname">${NAME}</div>
          <div id="_sa_hsub">● Online · Ask me anything</div>
        </div>
        <button id="_sa_close">✕</button>
      </div>
      <div id="_sa_msgs"></div>
      <div id="_sa_in_row">
        <textarea id="_sa_in" placeholder="Describe what you want to build..." rows="1"></textarea>
        <button id="_sa_send"><svg viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg></button>
      </div>
      <div id="_sa_pow">Powered by CWS Technology</div>
    </div>`;
  document.body.appendChild(div);

  const msgs = document.getElementById('_sa_msgs');
  const inp  = document.getElementById('_sa_in');
  const panel = document.getElementById('_sa_panel');
  const btn   = document.getElementById('_sa_btn');

  function mdW(t) {
    let h = t.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    h = h.replace(/\*\*(.*?)\*\*/g,'<strong>$1</strong>');
    const lines = h.split('\n'); const out = []; let ul=false,ol=false;
    for (const l of lines) {
      const um=l.match(/^[-*]\s+(.+)/), om=l.match(/^\d+\.\s+(.+)/);
      if(um){if(!ul){out.push('<ul>');ul=true;}if(ol){out.push('</ol>');ol=false;}out.push(`<li>${um[1]}</li>`);}
      else if(om){if(!ol){out.push('<ol>');ol=true;}if(ul){out.push('</ul>');ul=false;}out.push(`<li>${om[1]}</li>`);}
      else{if(ul){out.push('</ul>');ul=false;}if(ol){out.push('</ol>');ol=false;}if(l.trim())out.push(`<p>${l}</p>`);}
    }
    if(ul)out.push('</ul>');if(ol)out.push('</ol>');return out.join('');
  }

  function scroll() { requestAnimationFrame(() => { msgs.scrollTop = msgs.scrollHeight; }); }

  function addMsg(role, text) {
    const d = document.createElement('div');
    d.className = `wm ${role === 'agent' ? 'wa' : 'wu'}`;
    if (role === 'agent') d.innerHTML = mdW(text); else d.textContent = text;
    msgs.appendChild(d); scroll(); return d;
  }

  function renderSlotsW(slots) {
    const wrap = document.createElement('div');
    wrap.className = 'wslots';
    slots.forEach(s => {
      const btn = document.createElement('div');
      btn.className = 'wslot';
      const slotText = `${s.day}, ${s.date} at ${s.time}`;
      btn.textContent = '📅 ' + slotText;
      btn.onclick = () => {
        if (busy) return;
        wrap.querySelectorAll('.wslot').forEach(b => { b.style.opacity = '0.4'; b.style.pointerEvents = 'none'; });
        btn.style.opacity = '1';
        sendMsg(slotText);
      };
      wrap.appendChild(btn);
    });
    msgs.appendChild(wrap);
    scroll();
  }

  function showTyping() {
    const d = document.createElement('div');
    d.id = '_sa_t'; d.className = 'wt';
    d.innerHTML = '<div class="wd"></div><div class="wd"></div><div class="wd"></div>';
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
      const r = await fetch(`${URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ thread_id: thread, message: m }),
      });
      const d = await r.json();
      hideTyping();
      if (d.reply) addMsg('agent', d.reply);
      if (d.slots && d.slots.length > 0) renderSlotsW(d.slots);
    } catch { hideTyping(); addMsg('agent', 'Something went wrong. Please try again.'); }
    busy = false;
    if (!preset) inp.focus();
  }

  function toggle() {
    open = !open;
    panel.classList.toggle('on', open);
    btn.innerHTML = open
      ? `<svg viewBox="0 0 24 24"><path fill="white" d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>`
      : `<svg viewBox="0 0 24 24"><path fill="white" d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>`;
    if (open && !msgs.children.length) {
      setTimeout(() => { addMsg('agent', `Hi! 👋 I'm ${NAME}. Tell me what you're looking to build and I'll create a cost estimate for you.`); inp.focus(); }, 150);
    }
    if (open) setTimeout(() => { inp.focus(); scroll(); }, 200);
  }

  btn.addEventListener('click', toggle);
  document.getElementById('_sa_close').addEventListener('click', toggle);
  document.getElementById('_sa_send').addEventListener('click', () => sendMsg());
  inp.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMsg(); } });
  inp.addEventListener('input', () => { inp.style.height = 'auto'; inp.style.height = Math.min(inp.scrollHeight, 80) + 'px'; });
})();
