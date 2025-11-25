const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

class SPAPDFCrawler {
  constructor(options = {}) {
    this.baseUrl = options.baseUrl || 'https://thorn.io/t/docplanner#/posts/';
    this.outputDir = options.outputDir || './docplanner_pdfs';
    this.maxDepth = options.maxDepth || 10;
    this.delay = options.delay || 2000;
    this.visited = new Set();
    this.browser = null;
    this.page = null;
    this.pdfCounter = 1;
    this.folderCounters = new Map();

    // Create output directory
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
  }

  async init() {
    try {
      console.log('🚀 Launching browser...');
      this.browser = await puppeteer.launch({
        headless: false,
        defaultViewport: { width: 1200, height: 800 }
      });
      this.page = await this.browser.newPage();

      // Set cookie for authentication
      await this.page.setCookie({
        name: 'thorn_session',
        value: 'REPLACE_WITH_YOUR_COOKIE',
        domain: 'thorn.io',
        path: '/',
        httpOnly: true,
        secure: true
      });

      console.log('🍪 Cookie set for authentication');

      // Enable console logging from the page
      this.page.on('console', msg => {
        if (msg.text().startsWith('PAGE LOG:')) {
          console.log(msg.text());
        }
      });

      return true;
    } catch (error) {
      console.log('❌ Failed to initialize browser:', error.message);
      return false;
    }
  }

  async getLastBreadcrumb(url) {
    try {
      await this.page.goto(url, {
        waitUntil: 'networkidle0',
        timeout: 30000
      });

      await new Promise(resolve => setTimeout(resolve, 3000));

      const lastBreadcrumb = await this.page.evaluate(() => {
        console.log('PAGE LOG: Getting last breadcrumb...');

        const breadcrumbContainer = document.querySelector('.content-nav.break-work-break-all');
        if (!breadcrumbContainer) {
          console.log('PAGE LOG: No breadcrumb container found');
          return null;
        }

        const allLinks = breadcrumbContainer.querySelectorAll('a[href*="#/folders/"], a[href*="#/category/"]');
        console.log(`PAGE LOG: Found ${allLinks.length} breadcrumb links`);

        if (allLinks.length > 0) {
          const lastLink = allLinks[allLinks.length - 1];
          const span = lastLink.querySelector('span');
          if (span && span.textContent.trim()) {
            const text = span.textContent.trim();
            console.log(`PAGE LOG: Last breadcrumb: "${text}"`);

            // Clean up the text
            let cleanText = text.replace(/^[^\w\s]+\s*/, ''); // Remove leading emoji/symbols
            cleanText = cleanText.replace(/[^\w\s-]/g, ''); // Keep only letters, numbers, spaces, hyphens
            cleanText = cleanText.trim();
            return cleanText;
          }
        }

        return null;
      });

      if (lastBreadcrumb) {
        const cleanName = lastBreadcrumb
            .replace(/[^\w\s-]/g, '')
            .replace(/\s+/g, '_')
            .toLowerCase();

        console.log(`📍 Last breadcrumb: "${lastBreadcrumb}" -> ${cleanName}`);
        return cleanName;
      }

      return null;
    } catch (error) {
      console.log('❌ Error getting last breadcrumb:', error.message);
      return null;
    }
  }

  async getLinksFromPostTable(url) {
    try {
      await this.page.goto(url, {
        waitUntil: 'networkidle0',
        timeout: 30000
      });

      await new Promise(resolve => setTimeout(resolve, 3000));

      const links = await this.page.evaluate(() => {
        console.log('PAGE LOG: Looking for post table...');

        const postTable = document.querySelector('.post-table');
        if (!postTable) {
          console.log('PAGE LOG: No .post-table found');
          return [];
        }

        console.log('PAGE LOG: Found .post-table, looking for tbody links...');
        const tbody = postTable.querySelector('tbody');
        if (!tbody) {
          console.log('PAGE LOG: No tbody found in post-table');
          return [];
        }

        const allLinks = tbody.querySelectorAll('a[href]');
        console.log(`PAGE LOG: Found ${allLinks.length} links in tbody`);

        const extractedLinks = [];
        allLinks.forEach((link, index) => {
          const href = link.getAttribute('href');
          const text = link.textContent.trim();

          if (href && (href.includes('#/folders/') || href.includes('#/posts/'))) {
            const fullUrl = href.startsWith('#') ? window.location.origin + window.location.pathname + href : href;
            const type = href.includes('#/posts/') ? 'post' : 'folder';

            extractedLinks.push({
              url: fullUrl,
              text: text,
              type: type
            });

            console.log(`PAGE LOG: Link ${index + 1}: ${type} - ${text} - ${fullUrl}`);
          }
        });

        return extractedLinks;
      });

      console.log(`🔗 Found ${links.length} links in post table`);
      return links;

    } catch (error) {
      console.log('❌ Error getting links from post table:', error.message);
      return [];
    }
  }

  async generatePDF(url, filename = null, targetDirectory = null) {
    try {
      console.log(`📄 Generating PDF for: ${url}`);

      await this.page.goto(url, {
        waitUntil: 'networkidle0',
        timeout: 30000
      });

      await new Promise(resolve => setTimeout(resolve, 1000));

      // Remove unwanted elements before generating PDF
      await this.page.evaluate(() => {
        // Remove the navigation/header element
        const navElement = document.querySelector('.d-flex.justify-content-end.justify-content-between.align-items-center.flex-row');
        if (navElement) {
          navElement.remove();
          console.log('PAGE LOG: Removed navigation element');
        }

        // Remove any other unwanted elements (add more selectors as needed)
        const unwantedSelectors = [
          '.navbar',
          '.header',
          '.footer',
          '.sidebar'
        ];

        unwantedSelectors.forEach(selector => {
          const elements = document.querySelectorAll(selector);
          elements.forEach(el => el.remove());
        });
      });

      const title = await this.page.title();

      // Generate filename if not provided
      if (!filename) {
        const folderKey = targetDirectory || 'default';
        if (!this.folderCounters.has(folderKey)) {
          this.folderCounters.set(folderKey, 1);
        }
        const counter = this.folderCounters.get(folderKey);
        this.folderCounters.set(folderKey, counter + 1);

        let cleanTitle = title
            .replace(/[^\w\s-]/g, '')
            .replace(/\s+/g, '_')
            .substring(0, 50);

        filename = `${String(counter).padStart(3, '0')}_${cleanTitle}.pdf`;
      }

      const outputPath = targetDirectory
          ? path.join(targetDirectory, filename)
          : path.join(this.outputDir, filename);

      const pdf = await this.page.pdf({
        path: outputPath,
        format: 'A4',
        printBackground: true,
        margin: {
          top: '20px',
          right: '20px',
          bottom: '20px',
          left: '20px'
        }
      });

      console.log(`✅ PDF saved: ${outputPath}`);
      return { success: true, path: outputPath, title };

    } catch (error) {
      console.log(`❌ Failed to generate PDF for ${url}:`, error.message);
      return { success: false, path: null, title: url };
    }
  }

  buildDirectoryPath(folderArray) {
    if (!folderArray || folderArray.length === 0) {
      return this.outputDir;
    }

    const fullPath = path.join(this.outputDir, ...folderArray);

    // Create directory if it doesn't exist
    if (!fs.existsSync(fullPath)) {
      fs.mkdirSync(fullPath, { recursive: true });
      console.log(`📁 Created directory: ${fullPath}`);
    }

    return fullPath;
  }

  async crawlRecursively(url, folderArray = [], depth = 0) {
    if (depth > this.maxDepth || this.visited.has(url)) {
      return;
    }

    this.visited.add(url);
    console.log(`🔍 Crawling (depth ${depth}): ${url}`);
    console.log(`📂 Folder context: [${folderArray.join(' > ')}]`);

    // Get last breadcrumb for current page
    const lastBreadcrumb = await this.getLastBreadcrumb(url);

    // Build current folder array
    let currentFolderArray = [...folderArray];
    if (lastBreadcrumb) {
      currentFolderArray.push(lastBreadcrumb);
      console.log(`📁 Extended folder array: [${currentFolderArray.join(' > ')}]`);
    }

    // Build directory path for current context
    const currentDirectoryPath = this.buildDirectoryPath(currentFolderArray);

    // Check if this page has a post table
    const links = await this.getLinksFromPostTable(url);

    // Process all links found in the post table
    for (const link of links) {
      if (!this.visited.has(link.url)) {
        console.log(`🔗 Processing: ${link.type} - ${link.text}`);

        if (link.type === 'folder') {
          // Recursively process folder with extended folder array
          await this.crawlRecursively(link.url, currentFolderArray, depth + 1);

        } else if (link.type === 'post') {
          // For posts: get their actual breadcrumb to determine correct folder
          console.log(`📄 Processing post: ${link.text}`);

          const postBreadcrumb = await this.getLastBreadcrumb(link.url);
          let postFolderArray = [...currentFolderArray];

          if (postBreadcrumb) {
            // Check if post's breadcrumb matches current context
            const currentLastFolder = currentFolderArray[currentFolderArray.length - 1];

            if (currentLastFolder !== postBreadcrumb) {
              // Post belongs to a different folder - extend the folder array
              postFolderArray.push(postBreadcrumb);
              console.log(`📄 Post belongs to different folder: [${postFolderArray.join(' > ')}]`);
            } else {
              console.log(`📄 Post belongs to current folder: [${postFolderArray.join(' > ')}]`);
            }
          }

          // Build directory path for the post
          const postDirectoryPath = this.buildDirectoryPath(postFolderArray);
          console.log(`📄 Generating PDF in: ${postDirectoryPath}`);
          await this.generatePDF(link.url, null, postDirectoryPath);
        }
      } else {
        console.log(`⏭️ Skipping already visited: ${link.url}`);
      }
    }
  }

  async crawl(startUrl) {
    try {
      console.log(`🏁 Starting crawl from: ${startUrl}`);

      if (!await this.init()) {
        throw new Error('Failed to initialize browser');
      }

      await this.crawlRecursively(startUrl);

      console.log('✅ Crawling completed successfully!');
      console.log(`📊 Total pages visited: ${this.visited.size}`);

    } catch (error) {
      console.log('❌ Crawling failed:', error.message);
    } finally {
      if (this.browser) {
        await this.browser.close();
        console.log('🔒 Browser closed');
      }
    }
  }

  printSummary() {
    console.log('\n📋 CRAWL SUMMARY:');
    console.log(`Total URLs visited: ${this.visited.size}`);
    console.log(`Output directory: ${this.outputDir}`);

    // Count PDFs per folder
    for (const [folder, count] of this.folderCounters.entries()) {
      console.log(`${folder}: ${count - 1} PDFs`);
    }
  }
}

// Usage example
async function main() {
  const crawler = new SPAPDFCrawler({
    outputDir: './docplanner_pdfs',
    maxDepth: 5
  });

  // const startUrl = 'https://thorn.io/t/docplanner#/folders/97ea6ee7-12b1-447d-bba3-f1d33c57711c/global-product-docplanner-english';
  const startUrl = 'https://thorn.io/t/docplanner#/folders/94415ab6-db1d-49a7-9e2f-b145d08effa8/clinics-facilities';

  await crawler.crawl(startUrl);
  crawler.printSummary();
}

// Uncomment to run
main().catch(console.error);

module.exports = SPAPDFCrawler;
