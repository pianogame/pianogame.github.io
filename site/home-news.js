(() => {
  'use strict';
  const home = document.getElementById('hp-home-screen');
  const list = home?.querySelector('[data-home-notices]');
  const badge = home?.querySelector('.hp-home-notice-badge');
  const overlay = home?.querySelector('.hp-home-dialog-overlay');
  if (!list || !badge || !overlay) return;
  const pager = list.querySelector('[data-home-notice-pager]');

  // This data-only branch has automatic deployments disabled. Updating it never
  // changes the app build, staging branch, or production branch.
  const endpoint = '/live-news.json';
  const cacheKey = 'hp-news-cache-v1', seenKey = 'hp-news-seen-v1';
  const read = key => { try { return JSON.parse(localStorage.getItem(key)); } catch (_) { return null; } };
  const save = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch (_) {} };
  function validate(data) {
    if (data?.version !== 1 || !Array.isArray(data.items) || data.items.length > 100) throw new Error('Invalid news');
    const ids = new Set();
    return data.items.map(item => {
      if (!item || typeof item.id !== 'string' || !item.id || item.id.length > 100 || ids.has(item.id)
        || typeof item.title !== 'string' || !item.title.trim() || item.title.length > 200
        || (item.body != null && (typeof item.body !== 'string' || item.body.length > 2000))
        || (item.tag != null && (typeof item.tag !== 'string' || item.tag.length > 40))) throw new Error('Invalid news item');
      ids.add(item.id);
      return { id:item.id, title:item.title, body:item.body || '', tag:item.tag || 'お知らせ' };
    });
  }
  let items = [...list.querySelectorAll('article')].map((card, index) => ({
    id:card.dataset.noticeId || 'builtin-notice-' + index,
    title:card.querySelector('h3').innerText,
    body:[...card.querySelectorAll('p')].map(p => p.innerText).join(String.fromCharCode(10)),
    tag:card.querySelector('.hp-home-notice-tag').textContent,
  }));
  let seen = read(seenKey);
  if (!Array.isArray(seen)) seen = [];
  const fingerprint = item => JSON.stringify([item.id,item.title,item.body,item.tag]);
  const isOpen = () => !overlay.hidden && !list.hidden;
  function updateBadge() {
    badge.hidden = !items.some(item => !seen.includes(fingerprint(item)));
  }
  function markSeen() {
    if (!isOpen()) return;
    seen = items.map(fingerprint);
    save(seenKey, seen);
    updateBadge();
  }
  function render(next) {
    items = next;
    const cards = items.map((item, index) => {
      const card = document.createElement('article'); card.className = 'hp-home-notice-card';
      const number = document.createElement('span'); number.className = 'hp-home-notice-number';
      number.setAttribute('aria-hidden','true'); number.textContent = String(index + 1).padStart(2,'0');
      const content = document.createElement('div');
      const tag = document.createElement('span'); tag.className = 'hp-home-notice-tag'; tag.textContent = item.tag;
      const title = document.createElement('h3'); title.textContent = item.title;
      content.append(tag,title);
      if (item.body) { const body = document.createElement('p'); body.textContent = item.body; content.append(body); }
      card.append(number,content); return card;
    });
    if (!cards.length) {
      const empty = document.createElement('p'); empty.textContent = '現在、新しいお知らせはありません。'; cards.push(empty);
    }
    list.replaceChildren(...cards, ...(pager ? [pager] : []));
    updateBadge(); markSeen();
  }
  try { const cached = read(cacheKey); if (cached) render(validate(cached)); } catch (_) {}
  updateBadge();

  let pending = null;
  let returnRefreshQueued = false;
  function refresh() {
    if (pending) return pending;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);
    pending = fetch(endpoint + '?t=' + Date.now(), { cache:'no-store', signal:controller.signal, credentials:'omit' })
      .then(response => { if (!response.ok) throw new Error('News unavailable'); return response.json(); })
      .then(data => {
        const next = validate(data);
        save(cacheKey, {version:1,items:next});
        render(next);
      })
      // Retain the last valid news offline or if the feed is temporarily invalid.
      .catch(() => {})
      .finally(() => { clearTimeout(timeout); pending = null; });
    return pending;
  }
  function refreshOnHomeEnter() {
    if (pending) {
      if (returnRefreshQueued) return;
      returnRefreshQueued = true;
      pending.finally(() => {
        returnRefreshQueued = false;
        if (!home.hidden) void refresh();
      });
      return;
    }
    void refresh();
  }
  new MutationObserver(() => {
    if (!home.hidden) void refresh();
  }).observe(home, {attributes:true,attributeFilter:['hidden']});
  new MutationObserver(markSeen).observe(overlay, {attributes:true,attributeFilter:['hidden']});
  new MutationObserver(markSeen).observe(list, {attributes:true,attributeFilter:['hidden']});
  home.querySelector('[data-home-action="notice"]').addEventListener('click', () => { void refresh(); });
  window.addEventListener('hp-home-enter', refreshOnHomeEnter);
  window.addEventListener('pageshow', () => { if (!home.hidden) void refresh(); });
  document.addEventListener('visibilitychange', () => { if (!document.hidden && !home.hidden) void refresh(); });
  void refresh();
})();
