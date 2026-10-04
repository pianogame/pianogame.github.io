/** Regression: external news replaces fallback cards but preserves pagination. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require(process.env.DOM_TEST_MODULE || 'jsdom');
const root = path.resolve(__dirname, '../site');
const dom = new JSDOM(fs.readFileSync(path.join(root, 'index.html'), 'utf8'), {
  url: 'https://news-test.example/', runScripts: 'outside-only', pretendToBeVisual: true,
});
const { window } = dom;
Object.defineProperty(window.HTMLElement.prototype, 'innerText', {
  get() { return this.textContent; },
});
const home = window.document.getElementById('hp-home-screen');
const list = home.querySelector('[data-home-notices]');
const pager = list.querySelector('[data-home-notice-pager]');
const overlay = home.querySelector('.hp-home-dialog-overlay');
const oldFeed = {version: 1, items: [{id: 'old', title: '古いキャッシュ'}]};
window.localStorage.setItem('hp-news-cache-v1', JSON.stringify(oldFeed));
let requests = [], offline = false;
window.fetch = () => new Promise((resolve, reject) => requests.push({resolve, reject}));
window.eval(fs.readFileSync(path.join(root, 'home-news.js'), 'utf8'));
const source = fs.readFileSync(path.join(root, 'home.js'), 'utf8');
window.eval('(() => { const home = document.getElementById("hp-home-screen");' +
  source.slice(source.indexOf('  const noticePageSize ='), source.indexOf('  const dialogOverlay =')) + '})();');
const tick = () => new Promise(resolve => setTimeout(resolve, 0));
async function respond(feed) {
  await tick();
  assert.ok(requests.length, 'refresh requested');
  const request = requests.shift();
  if (offline) request.reject(new Error('offline'));
  else request.resolve({ok: true, json: async () => feed});
  await tick(); await tick();
}
async function refresh(feed) {
  window.dispatchEvent(new window.Event('pageshow'));
  await respond(feed);
}
function visibleCards() {
  return [...list.querySelectorAll('article')].filter(card => window.getComputedStyle(card).display !== 'none');
}
(async () => {
  const feed = JSON.parse(fs.readFileSync(process.env.NEWS_TEST_FEED, 'utf8'));
  assert.equal(feed.items[0].id, 'maintenance-20261004');
  assert.match(feed.items[0].body, /バイオリン/);
  await respond(feed);
  assert.equal(list.querySelector('h3').textContent, feed.items[0].title, 'actual feed replaces stale cache');
  assert.equal(list.querySelector('p').textContent, feed.items[0].body, 'full maintenance body is preserved');
  assert.equal(visibleCards().length, 4, 'all four current notices visible');
  assert.equal(list.querySelector('[data-home-notice-pager]'), pager, 'original pager and listeners survive');
  overlay.hidden = false; list.hidden = false; await tick();
  assert.equal(home.querySelector('.hp-home-notice-badge').hidden, true);
  const many = {version: 1, items: [...feed.items, ...[5, 6, 7].map(n => ({id: 'test-' + n, title: 'テスト' + n}))]};
  await refresh(many);
  assert.equal(visibleCards().length, 5);
  assert.equal(pager.hidden, false);
  pager.querySelector('[data-notice-page="next"]').click();
  assert.equal(visibleCards().length, 2);
  assert.equal(pager.querySelector('[data-notice-page-status]').textContent, '2 / 2');
  await refresh(feed);
  assert.equal(visibleCards().length, 4, 'refresh resets an old page to the first page');
  assert.equal(pager.hidden, true);
  offline = true; await refresh(feed);
  assert.equal(visibleCards().length, 4, 'offline keeps the last valid feed');
  offline = false; await refresh({version: 1, items: [{id: 'invalid', title: 17}]});
  assert.equal(visibleCards().length, 4, 'invalid feed keeps the last valid feed');
  await refresh({version: 1, items: []});
  assert.match(list.textContent, /現在、新しいお知らせはありません/);
  assert.equal(list.querySelector('[data-home-notice-pager]'), pager);
  await refresh(many);
  assert.equal(visibleCards().length, 5, 'news can return after an empty feed');
  pager.querySelector('[data-notice-page="next"]').click();
  assert.equal(visibleCards().length, 2);
  console.log('PASS actual maintenance feed, stale cache, full body, visible cards, pager preservation, async pagination, offline, invalid and empty feeds');
})().finally(() => window.close()).catch(error => { console.error(error); process.exitCode = 1; });
