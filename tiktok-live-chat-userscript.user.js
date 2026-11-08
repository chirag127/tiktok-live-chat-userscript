// ==UserScript==
// @name         TikTok Live Chat Log
// @namespace    https://github.com/chirag127
// @version      1.0.0
// @description  Records live chat into a filterable, exportable log with pause, per-user filter and gift tracking.
// @author       chirag127
// @license      MIT
// @match        https://www.tiktok.com/*
// @icon         https://www.tiktok.com/favicon.ico
// @homepageURL  https://github.com/chirag127/tiktok-live-chat-userscript
// @supportURL   https://github.com/chirag127/tiktok-live-chat-userscript/issues
// @downloadURL  https://github.com/chirag127/tiktok-live-chat-userscript/raw/main/tiktok-live-chat-userscript.user.js
// @updateURL    https://github.com/chirag127/tiktok-live-chat-userscript/raw/main/tiktok-live-chat-userscript.user.js
// @grant        none
// @noframes
// @run-at       document-idle
// ==/UserScript==

(function () {
  "use strict";

  /**
   * TikTok live chat renders each message as a node inside a scrolling container. We observe that
   * container instead of polling, so capture is exact and cheap.
   */
  const CHAT_SELECTORS = [
    '[data-e2e="chat-room"]',
    '[class*="DivChatRoom"]',
    '[class*="ChatRoom"]',
    '[class*="chat-room"]',
  ];

  const rows = [];
  let paused = false;
  let filter = "";
  let ui = null;
  let observer = null;
  let attached = null;

  const typing = () => /input|textarea/i.test(document.activeElement.tagName);

  function chatRoot() {
    for (const s of CHAT_SELECTORS) {
      const n = document.querySelector(s);
      if (n) return n;
    }
    return null;
  }

  function textOf(node) {
    const user = node.querySelector('[class*="user"], [class*="User"], [data-e2e*="user"]');
    const body = node.querySelector('[class*="content"], [class*="Content"], [data-e2e*="content"]');
    const userText = (user && user.textContent.trim()) || "";
    const bodyText = (body && body.textContent.trim()) || node.textContent.trim();
    return { user: userText, text: bodyText, gift: /gift|Gift/.test(node.className) };
  }

  function attach() {
    const root = chatRoot();
    if (!root || root === attached) return;
    attached = root;
    observer && observer.disconnect();
    observer = new MutationObserver((muts) => {
      if (paused) return;
      for (const m of muts) {
        for (const n of m.addedNodes) {
          if (n.nodeType !== 1) continue;
          const t = textOf(n);
          if (!t.text) continue;
          rows.push({ at: Date.now(), ...t });
          if (rows.length > 5000) rows.shift();
        }
      }
      if (ui) paint();
    });
    observer.observe(root, { childList: true, subtree: true });
  }

  function matches(r) {
    if (!filter) return true;
    const f = filter.toLowerCase();
    return r.user.toLowerCase().includes(f) || r.text.toLowerCase().includes(f);
  }

  function csv() {
    const esc = (v) => '"' + String(v).replace(/"/g, '""') + '"';
    return ["time,user,gift,text", ...rows.map((r) => [new Date(r.at).toISOString(), esc(r.user), r.gift, esc(r.text)].join(","))].join("\n");
  }

  function download(name, text, type) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([text], { type }));
    a.download = name;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function el(tag, css, text) {
    const n = document.createElement(tag);
    if (css) Object.assign(n.style, css);
    if (text != null) n.textContent = text;
    return n;
  }

  function paint() {
    if (!ui) return;
    ui.count.textContent = rows.length + " messages";
    ui.body.textContent = "";
    const list = rows.filter(matches).slice(-400).reverse();
    for (const r of list) {
      const line = el("div", { padding: "3px 6px", borderBottom: "1px solid #262626", color: r.gift ? "#f5c518" : "#ddd" });
      line.append(el("strong", { color: "#7fb2ff" }, r.user || "?"), document.createTextNode("  " + r.text));
      ui.body.appendChild(line);
    }
  }

  function panel() {
    if (ui) { ui.root.remove(); ui = null; return; }
    const root = el("div", { position: "fixed", right: "18px", bottom: "18px", width: "380px", height: "56vh", zIndex: 2147483647, background: "#181818", color: "#fff", font: "12px Roboto, Arial", border: "1px solid #3a3a3a", borderRadius: "10px", display: "flex", flexDirection: "column", overflow: "hidden", boxShadow: "0 8px 28px rgba(0,0,0,.65)" });
    const head = el("div", { padding: "8px", background: "#242424", display: "flex", gap: "6px", alignItems: "center", cursor: "move" });
    const count = el("strong", { flex: "1" }, "0 messages");
    const btn = (l, fn, bg) => { const b = el("button", { background: bg || "#333", color: "#fff", border: "0", borderRadius: "5px", padding: "3px 7px", cursor: "pointer" }, l); b.onclick = fn; return b; };
    const pause = btn("Pause", () => { paused = !paused; pause.textContent = paused ? "Resume" : "Pause"; });
    head.append(count, pause, btn("×", panel));

    const search = el("input", { margin: "6px", padding: "5px", background: "#111", color: "#fff", border: "1px solid #3a3a3a", borderRadius: "5px" });
    search.placeholder = "filter user or text";
    search.oninput = () => { filter = search.value; paint(); };

    const body = el("div", { overflow: "auto", flex: "1" });
    const foot = el("div", { padding: "6px", display: "flex", gap: "6px", borderTop: "1px solid #333" });
    foot.append(
      btn("CSV", () => download("live-chat.csv", csv(), "text/csv")),
      btn("JSON", () => download("live-chat.json", JSON.stringify(rows, null, 2), "application/json")),
      btn("Copy", () => navigator.clipboard.writeText(rows.map((r) => r.user + ": " + r.text).join("\n"))),
      btn("Clear", () => { rows.length = 0; paint(); }),
    );
    root.append(head, search, body, foot);
    document.body.appendChild(root);
    ui = { root, count, body };

    let dx = 0, dy = 0, drag = false;
    head.addEventListener("pointerdown", (e) => { if (e.target.tagName === "BUTTON") return; drag = true; dx = e.clientX; dy = e.clientY; head.setPointerCapture(e.pointerId); });
    head.addEventListener("pointermove", (e) => {
      if (!drag) return;
      root.style.right = "auto"; root.style.bottom = "auto";
      root.style.left = Math.max(0, root.offsetLeft + e.clientX - dx) + "px";
      root.style.top = Math.max(0, root.offsetTop + e.clientY - dy) + "px";
      dx = e.clientX; dy = e.clientY;
    });
    head.addEventListener("pointerup", () => (drag = false));
    paint();
  }

  addEventListener("keydown", (e) => {
    if (e.altKey && e.key.toLowerCase() === "c" && !typing()) panel();
  });

  setInterval(attach, 1000);
  attach();

  const chip = el("button", { position: "fixed", right: "18px", bottom: "56px", zIndex: 2147483646, background: "#065fd4", color: "#fff", border: "0", borderRadius: "18px", padding: "6px 12px", cursor: "pointer", font: "12px Roboto, Arial" }, "💬");
  chip.title = "Live chat log (Alt+C)";
  chip.onclick = panel;
  document.body.appendChild(chip);
})();
