# Thorn Markdown Crawler

Generate clean Markdown exports from Thorn posts/folders using Puppeteer and Turndown.

## ✅ What it does
- Crawls Thorn folders recursively and discovers posts via the post table.
- Extracts content, normalizes links/images to absolute URLs, and converts HTML → Markdown.
- Saves `.md` files into a mirrored directory structure under `./docplanner_markdown`.
- No YAML/frontmatter headers are added to generated files.

## 🧰 Prerequisites
- Node.js 18+ and npm
- macOS/Linux/WSL recommended (Windows works with recent Node versions)
- An authenticated Thorn session cookie (`thorn_session`)

## 🚀 Quick start

```bash
cd thorn-crawler
npm install
node crawler_markdown.js
```

By default the script starts from the `startUrl` configured in `crawler_markdown.js` and writes output under `./docplanner_markdown`.

## 🔐 Authentication
The crawler needs your `thorn_session` cookie to access protected content.

Open `thorn-crawler/crawler_markdown.js` and find the cookie block inside `init()`:

```js
await this.page.setCookie({
  name: 'thorn_session',
  value: 'REPLACE_WITH_YOUR_COOKIE',
  domain: 'thorn.io',
  path: '/',
  httpOnly: true,
  secure: true
});
```

- Replace `value` with a valid session cookie taken from your browser’s DevTools (Application → Cookies).
- Keep the browser headless setting as you prefer. Current default: `headless: false` for easier debugging.

> TODO: Externalize the session cookie into an environment variable or secret manager instead of committing a literal value in code.

## ⚙️ Configuration
Open `thorn-crawler/crawler_markdown.js` and adjust:

- start URL
  ```js
  const startUrl = 'https://thorn.io/t/docplanner#/folders/9ab834f0-6df9-41ce-8313-234d3fa4ab0a/calendar-for-non-doctors';
  ```

- output directory (defaults to `./docplanner_markdown`)
  ```js
  new SPAMarkdownCrawler({ outputDir: './docplanner_markdown', maxDepth: 5 })
  ```

- depth and delay
  ```js
  this.maxDepth = options.maxDepth || 10;
  this.delay = options.delay || 2000; // ms between page loads
  ```

- headless mode
  ```js
  this.browser = await puppeteer.launch({ headless: false, defaultViewport: { width: 1200, height: 800 } });
  ```

## 📝 Output
- Files are saved under `./docplanner_markdown` mirroring folder breadcrumbs discovered during the crawl.
- Filenames are auto-numbered per directory: `001_Title_Snippet.md`, `002_...md`, etc.
- No YAML frontmatter is included. Files contain pure Markdown only.

## 🧪 Run a focused crawl
If you want to crawl a single folder tree, set the `startUrl` to that folder and reduce `maxDepth` to keep the crawl tight.

```js
const crawler = new SPAMarkdownCrawler({ outputDir: './docplanner_markdown', maxDepth: 3 });
const startUrl = 'https://thorn.io/t/docplanner#/folders/<folder-id>/<slug>';
await crawler.crawl(startUrl);
```

## 🧯 Troubleshooting
- Empty output folder
  - Verify your `thorn_session` cookie is valid and matches the `thorn.io` domain.
  - Confirm the `startUrl` is reachable and shows a post table in the UI.

- “Navigation timeout” or “networkidle0” timeouts
  - Increase `timeout` in `page.goto` or increase `this.delay` between navigations.

- Content looks truncated or wrong
  - Update the `candidateSelectors` list in `generateMarkdown` to target the exact content root used by Thorn in your workspace.

- Broken image links in Markdown
  - The crawler converts relative paths to absolute URLs. If images require auth tokens or signed URLs, ensure they are accessible from your target consumer.

## 🧱 Project Scripts
Common scripts you may add to `package.json` for convenience:

```json
{
  "scripts": {
    "crawl": "node crawler_markdown.js"
  }
}
```

Then run:
```bash
npm run crawl
```

## 🔒 Legal/Rate limits
- Respect internal usage policies and avoid overloading Thorn. Adjust `this.delay` as needed.
- Only crawl content you are authorized to access.

---

## Changelog
- 2025-11-24: Initial README with setup, auth, configuration, and troubleshooting. Frontmatter disabled in generated Markdown.


