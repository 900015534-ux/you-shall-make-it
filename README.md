# Make Browser

Make Browser is a polished, self-contained browser-style web app built with plain HTML, CSS, and JavaScript. It runs entirely as a static site with no backend and no build step.

## Run it

### Option 1: Open directly
- Open `/home/runner/work/you-shall-make-it/you-shall-make-it/index.html` in a modern browser.

### Option 2: Serve locally
If you prefer a local server, run one of the following commands from `/home/runner/work/you-shall-make-it/you-shall-make-it`:

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000`.

## Features

- Desktop-style browser window UI with tabs, new tab, and close controls
- Back, forward, reload, and home navigation
- Address/search bar with URL normalization
- Plain-text searches powered by **DuckDuckGo** using the configurable template in `app.js`
- Bookmark star toggle plus a bookmarks bar
- Home/new-tab page with search, shortcut cards, and recently visited items
- Keyboard support including `Enter` to submit and `Ctrl/Cmd + L` to focus the address bar
- Responsive layout for desktop and narrower screens

## How navigation works

- Type a full `http://` or `https://` URL to open a destination preview.
- Type a bare domain like `example.com` and Make Browser will normalize it to `https://example.com`.
- Type regular text and it will become a DuckDuckGo search URL.
- Use shortcut cards, bookmarks, or recent items to reopen destinations quickly.

## Static-site limitations

Make Browser is intentionally a **safe static demo**, not a full browser engine.

- It does **not** bypass browser security restrictions.
- Many external sites block cross-origin embedding in iframes, especially when loaded from a static file.
- To avoid blank or broken content, external destinations render as an in-app preview/status card with an option to open the site in a real browser tab.
- Unsupported schemes such as `javascript:` are blocked and shown as unsupported destinations.

## Project structure

- `index.html` — app markup and home-page template
- `styles.css` — responsive browser-like styling
- `app.js` — tab, history, bookmarks, address parsing, and preview logic
