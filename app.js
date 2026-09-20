const SEARCH_ENGINE = {
  name: 'DuckDuckGo',
  template: 'https://duckduckgo.com/?q=%s',
};
const HOME_URL = 'about:home';
const STORAGE_KEY = 'make-browser-state-v1';
const MAX_RECENTS = 6;
const DEFAULT_SHORTCUTS = [
  { title: 'GitHub', url: 'https://github.com', note: 'Code and collaboration' },
  { title: 'MDN Web Docs', url: 'https://developer.mozilla.org', note: 'Learn the platform' },
  { title: 'Wikipedia', url: 'https://wikipedia.org', note: 'Explore an article' },
  { title: 'DuckDuckGo', url: 'https://duckduckgo.com', note: 'Private-friendly search' },
  { title: 'Example', url: 'https://example.com', note: 'A lightweight test page' },
  { title: 'OpenAI', url: 'https://openai.com', note: 'AI news and research' },
];

const tabStrip = document.getElementById('tabStrip');
const contentArea = document.getElementById('contentArea');
const addressForm = document.getElementById('addressForm');
const addressInput = document.getElementById('addressInput');
const bookmarkButton = document.getElementById('bookmarkButton');
const bookmarkItems = document.getElementById('bookmarkItems');
const backButton = document.getElementById('backButton');
const forwardButton = document.getElementById('forwardButton');
const reloadButton = document.getElementById('reloadButton');
const homeButton = document.getElementById('homeButton');
const newTabButton = document.getElementById('newTabButton');
const homeTemplate = document.getElementById('homeTemplate');

let state = loadState();
render();

addressForm.addEventListener('submit', (event) => {
  event.preventDefault();
  submitInput(addressInput.value);
});

newTabButton.addEventListener('click', () => {
  openTab();
});

backButton.addEventListener('click', () => moveHistory(-1));
forwardButton.addEventListener('click', () => moveHistory(1));
reloadButton.addEventListener('click', () => reloadCurrentTab());
homeButton.addEventListener('click', () => navigateCurrent(createHomeEntry()));
bookmarkButton.addEventListener('click', () => toggleBookmark());

document.addEventListener('keydown', (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'l') {
    event.preventDefault();
    addressInput.focus();
    addressInput.select();
  }
});

tabStrip.addEventListener('click', (event) => {
  const closeButton = event.target.closest('.tab-close');
  if (closeButton) {
    closeTab(Number(closeButton.dataset.tabId));
    return;
  }

  const tabButton = event.target.closest('.tab-activate');
  if (!tabButton) {
    return;
  }

  activateTab(Number(tabButton.dataset.tabId));
});

bookmarkItems.addEventListener('click', (event) => {
  const button = event.target.closest('[data-bookmark-url]');
  if (!button) {
    return;
  }

  navigateCurrent(createPreviewEntry(button.dataset.bookmarkUrl, button.dataset.bookmarkTitle || button.textContent.trim()));
});

contentArea.addEventListener('submit', (event) => {
  if (event.target.id === 'homeSearchForm') {
    event.preventDefault();
    const input = event.target.querySelector('input');
    submitInput(input.value);
  }
});

contentArea.addEventListener('click', (event) => {
  const action = event.target.closest('[data-action]');
  if (!action) {
    return;
  }

  const { action: type, value } = action.dataset;
  if (type === 'shortcut' || type === 'recent') {
    submitInput(value);
  }
  if (type === 'bookmark-preview') {
    toggleBookmark();
  }
  if (type === 'home-address') {
    addressInput.focus();
    addressInput.select();
  }
});

window.addEventListener('beforeunload', saveState);

function loadState() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return createInitialState();
    }

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed.tabs) || !parsed.tabs.length) {
      return createInitialState();
    }

    return {
      activeTabId: parsed.activeTabId,
      nextTabId: Number(parsed.nextTabId) || parsed.tabs.length + 1,
      tabs: parsed.tabs,
      bookmarks: Array.isArray(parsed.bookmarks) ? parsed.bookmarks : [],
      recent: Array.isArray(parsed.recent) ? parsed.recent : [],
    };
  } catch (error) {
    console.warn('Unable to load saved state, using defaults instead.', error);
    return createInitialState();
  }
}

function saveState() {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function createInitialState() {
  return {
    activeTabId: 1,
    nextTabId: 2,
    tabs: [createTab(1)],
    bookmarks: [],
    recent: [],
  };
}

function createTab(id) {
  return {
    id,
    history: [createHomeEntry()],
    historyIndex: 0,
  };
}

function createHomeEntry() {
  return {
    type: 'home',
    url: HOME_URL,
    title: 'Home',
    displayUrl: HOME_URL,
    visitedAt: Date.now(),
  };
}

function createPreviewEntry(url, title) {
  const parsed = new URL(url);
  return {
    type: 'preview',
    url: parsed.toString(),
    title: title || beautifyHost(parsed.hostname),
    displayUrl: parsed.toString(),
    host: parsed.hostname,
    path: parsed.pathname + parsed.search,
    visitedAt: Date.now(),
  };
}

function createSearchEntry(query) {
  const url = SEARCH_ENGINE.template.replace('%s', encodeURIComponent(query));
  const parsed = new URL(url);
  return {
    type: 'search',
    url,
    title: `Search: ${query}`,
    displayUrl: url,
    query,
    host: parsed.hostname,
    path: parsed.pathname + parsed.search,
    visitedAt: Date.now(),
  };
}

function createBlockedEntry(rawValue, reason) {
  return {
    type: 'blocked',
    url: rawValue,
    title: 'Unsupported destination',
    displayUrl: rawValue,
    reason,
    visitedAt: Date.now(),
  };
}

function currentTab() {
  return state.tabs.find((tab) => tab.id === state.activeTabId) || state.tabs[0];
}

function currentEntry() {
  const tab = currentTab();
  return tab.history[tab.historyIndex];
}

function openTab(entry = createHomeEntry()) {
  const id = state.nextTabId++;
  state.tabs.push({ id, history: [entry], historyIndex: 0 });
  state.activeTabId = id;
  persistAndRender();
}

function closeTab(tabId) {
  if (state.tabs.length === 1) {
    state.tabs[0] = createTab(state.tabs[0].id);
    state.activeTabId = state.tabs[0].id;
    persistAndRender();
    return;
  }

  const index = state.tabs.findIndex((tab) => tab.id === tabId);
  if (index === -1) {
    return;
  }

  const wasActive = state.activeTabId === tabId;
  state.tabs.splice(index, 1);
  if (wasActive) {
    const fallback = state.tabs[Math.max(0, index - 1)] || state.tabs[0];
    state.activeTabId = fallback.id;
  }
  persistAndRender();
}

function activateTab(tabId) {
  if (!state.tabs.some((tab) => tab.id === tabId)) {
    return;
  }
  state.activeTabId = tabId;
  persistAndRender();
}

function moveHistory(delta) {
  const tab = currentTab();
  const nextIndex = tab.historyIndex + delta;
  if (nextIndex < 0 || nextIndex >= tab.history.length) {
    return;
  }
  tab.historyIndex = nextIndex;
  persistAndRender();
}

function reloadCurrentTab() {
  const tab = currentTab();
  const entry = { ...currentEntry(), visitedAt: Date.now() };
  tab.history[tab.historyIndex] = entry;
  persistAndRender();
}

function navigateCurrent(entry) {
  const tab = currentTab();
  tab.history = tab.history.slice(0, tab.historyIndex + 1);
  tab.history.push(entry);
  tab.historyIndex = tab.history.length - 1;
  updateRecent(entry);
  persistAndRender();
}

function updateRecent(entry) {
  if (entry.type === 'home') {
    return;
  }

  state.recent = [
    { title: entry.title, url: entry.displayUrl, subtitle: entry.type === 'search' ? `Search via ${SEARCH_ENGINE.name}` : entry.host || entry.reason },
    ...state.recent.filter((item) => item.url !== entry.displayUrl),
  ].slice(0, MAX_RECENTS);
}

function submitInput(rawValue) {
  const target = normalizeDestination(rawValue);
  if (!target) {
    return;
  }
  navigateCurrent(target);
}

function normalizeDestination(rawValue) {
  const value = rawValue.trim();
  if (!value) {
    return null;
  }

  if (value.toLowerCase() === HOME_URL) {
    return createHomeEntry();
  }

  if (/\s/.test(value)) {
    return createSearchEntry(value);
  }

  try {
    const parsed = new URL(value);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return createBlockedEntry(value, `The ${parsed.protocol} scheme is not supported in this static demo.`);
    }
    return createPreviewEntry(parsed.toString());
  } catch (error) {
    if (looksLikeDomain(value)) {
      const protocol = value.startsWith('localhost') || /^\d{1,3}(?:\.\d{1,3}){3}/.test(value) ? 'http://' : 'https://';
      return createPreviewEntry(`${protocol}${value}`);
    }
    return createSearchEntry(value);
  }
}

function looksLikeDomain(value) {
  return value.includes('.') || value.startsWith('localhost') || /^\d{1,3}(?:\.\d{1,3}){3}(?::\d+)?(?:\/.*)?$/.test(value);
}

function toggleBookmark() {
  const entry = currentEntry();
  const index = state.bookmarks.findIndex((bookmark) => bookmark.url === entry.displayUrl);
  if (index >= 0) {
    state.bookmarks.splice(index, 1);
  } else {
    state.bookmarks.push({
      title: entry.title,
      url: entry.displayUrl,
    });
  }
  persistAndRender();
}

function persistAndRender() {
  saveState();
  render();
}

function render() {
  renderTabs();
  renderControls();
  renderBookmarks();
  renderContent();
}

function renderTabs() {
  const activeId = state.activeTabId;
  tabStrip.innerHTML = state.tabs
    .map((tab) => {
      const entry = tab.history[tab.historyIndex];
      const title = escapeHtml(shortTitle(entry));
      const selected = tab.id === activeId;
      return `
        <div class="tab" role="presentation">
          <button class="tab-activate" type="button" role="tab" aria-selected="${selected}" aria-controls="contentArea" data-tab-id="${tab.id}" title="${escapeHtml(entry.title)}">
            <span aria-hidden="true">${entry.type === 'home' ? '⌂' : '◉'}</span>
            <span class="tab-title">${title}</span>
          </button>
          <button class="tab-close" type="button" data-tab-id="${tab.id}" aria-label="Close tab" title="Close tab">×</button>
        </div>
      `;
    })
    .join('');
}

function renderControls() {
  const tab = currentTab();
  const entry = currentEntry();
  addressInput.value = entry.displayUrl;
  backButton.disabled = tab.historyIndex === 0;
  forwardButton.disabled = tab.historyIndex === tab.history.length - 1;
  const bookmarked = state.bookmarks.some((bookmark) => bookmark.url === entry.displayUrl);
  bookmarkButton.classList.toggle('active', bookmarked);
  bookmarkButton.textContent = bookmarked ? '★' : '☆';
  bookmarkButton.title = bookmarked ? 'Remove bookmark' : 'Bookmark this page';
}

function renderBookmarks() {
  if (!state.bookmarks.length) {
    bookmarkItems.innerHTML = '<div class="bookmark-empty">Star a page to pin it here.</div>';
    return;
  }

  bookmarkItems.innerHTML = state.bookmarks
    .map(
      (bookmark) => `
        <button
          class="bookmark-chip"
          type="button"
          data-bookmark-url="${escapeAttribute(bookmark.url)}"
          data-bookmark-title="${escapeAttribute(bookmark.title)}"
          title="Open ${escapeAttribute(bookmark.title)}"
        >
          ${escapeHtml(shortTitle(bookmark))}
        </button>
      `,
    )
    .join('');
}

function renderContent() {
  const entry = currentEntry();
  if (entry.type === 'home') {
    renderHome();
    return;
  }

  contentArea.innerHTML = buildPreviewMarkup(entry);
}

function renderHome() {
  contentArea.innerHTML = '';
  const fragment = homeTemplate.content.cloneNode(true);

  const shortcutGrid = fragment.querySelector('#shortcutGrid');
  shortcutGrid.innerHTML = DEFAULT_SHORTCUTS.map(
    (shortcut) => `
      <button class="shortcut-card" type="button" data-action="shortcut" data-value="${escapeAttribute(shortcut.url)}" title="Open ${escapeAttribute(shortcut.url)}">
        <span class="shortcut-title">${escapeHtml(shortcut.title)}</span>
        <span class="shortcut-url">${escapeHtml(shortcut.note)}</span>
      </button>
    `,
  ).join('');

  const recentList = fragment.querySelector('#recentList');
  recentList.innerHTML = state.recent.length
    ? state.recent
        .map(
          (recent) => `
            <button class="recent-card" type="button" data-action="recent" data-value="${escapeAttribute(recent.url)}" title="Open ${escapeAttribute(recent.url)}">
              <span class="recent-title">${escapeHtml(recent.title)}</span>
              <span class="recent-subtitle">${escapeHtml(recent.subtitle || recent.url)}</span>
            </button>
          `,
        )
        .join('')
    : '<div class="recent-subtitle">Visited pages and searches will appear here.</div>';

  const homeSearchInput = fragment.querySelector('#homeSearchInput');
  homeSearchInput.value = '';
  contentArea.appendChild(fragment);
}

function buildPreviewMarkup(entry) {
  const isBookmarked = state.bookmarks.some((bookmark) => bookmark.url === entry.displayUrl);
  const host = entry.host || 'N/A';
  const destinationLabel = entry.type === 'search' ? 'Search preview' : entry.type === 'blocked' ? 'Unsupported destination' : 'External preview';
  const title = entry.type === 'search' ? `Searching ${SEARCH_ENGINE.name}` : entry.title;
  const copy =
    entry.type === 'search'
      ? `This static app converts plain text into a ${SEARCH_ENGINE.name} search URL and shows a safe preview instead of embedding cross-origin results.`
      : entry.type === 'blocked'
        ? entry.reason
        : 'This destination was normalized successfully. Since Make Browser is a static demo, external pages are represented by a safe preview card instead of a potentially blocked iframe.';

  return `
    <section class="preview-page">
      <article class="panel preview-card">
        <div class="preview-header">
          <div>
            <span class="preview-badge">${escapeHtml(destinationLabel)}</span>
            <h1 class="preview-title">${escapeHtml(title)}</h1>
            <p class="preview-copy">${escapeHtml(copy)}</p>
          </div>
        </div>

        <div class="preview-address">${escapeHtml(entry.displayUrl)}</div>

        <div class="preview-actions">
          ${entry.type === 'blocked' ? '' : `<a class="preview-action" href="${escapeAttribute(entry.url)}" target="_blank" rel="noreferrer noopener">Open externally</a>`}
          <button class="preview-action" type="button" data-action="bookmark-preview">${isBookmarked ? 'Remove bookmark' : 'Save bookmark'}</button>
          <button class="preview-action" type="button" data-action="home-address">Focus address bar</button>
        </div>

        <div class="preview-grid">
          <div class="preview-fact">
            <span class="preview-fact-label">Host</span>
            <strong>${escapeHtml(host)}</strong>
          </div>
          <div class="preview-fact">
            <span class="preview-fact-label">Path</span>
            <strong>${escapeHtml(entry.path || '—')}</strong>
          </div>
          <div class="preview-fact">
            <span class="preview-fact-label">Mode</span>
            <strong>${entry.type === 'search' ? `${escapeHtml(SEARCH_ENGINE.name)} search` : entry.type === 'blocked' ? 'Blocked scheme' : 'Static preview'}</strong>
          </div>
          <div class="preview-fact">
            <span class="preview-fact-label">Bookmarked</span>
            <strong>${isBookmarked ? 'Yes' : 'No'}</strong>
          </div>
        </div>
      </article>
    </section>
  `;
}

function shortTitle(entry) {
  if (entry.title) {
    return entry.title;
  }
  if (entry.host) {
    return beautifyHost(entry.host);
  }
  return 'New tab';
}

function beautifyHost(host) {
  return host.replace(/^www\./, '') || 'Page';
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function escapeAttribute(value) {
  return escapeHtml(value);
}
