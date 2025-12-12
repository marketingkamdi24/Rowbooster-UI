import { spawn } from 'child_process';
import { promisify } from 'util';

export interface DirectScrapedContent {
  url: string;
  title: string;
  content: string;
  method: 'direct-js';
  success: boolean;
  contentLength: number;
  loadTime?: number;
  contentSample?: string;
  debugInfo?: any;
}

export class DirectScraper {
  private async jsRenderScrape(url: string, articleNumber?: string): Promise<DirectScrapedContent> {
    const startTime = Date.now();

    return new Promise((resolve) => {
      const jsScript = `
        const puppeteer = require('puppeteer');
        
        (async () => {
          let browser;
          try {
            browser = await puppeteer.launch({
              headless: true,
              executablePath: '/nix/store/zi4f80l169xlmivz8vja8wlphq74qqk0-chromium-125.0.6422.141/bin/chromium',
              args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu',
                '--disable-software-rasterizer',
                '--disable-background-timer-throttling',
                '--disable-backgrounding-occluded-windows',
                '--disable-renderer-backgrounding',
                '--disable-extensions',
                '--disable-plugins',
                '--disable-images',
                '--no-first-run',
                '--single-process'
              ],
              timeout: 25000
            });
            
            const page = await browser.newPage();
            await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
            
            await page.goto('${url}', { 
              waitUntil: 'networkidle0', 
              timeout: 25000 
            });
            
            // Wait for dynamic content
            await page.waitForTimeout(3000);
            
            const result = await page.evaluate(() => {
              // Remove non-content elements
              const elementsToRemove = document.querySelectorAll('script, style, noscript, iframe, nav, header, footer, .cookie, .popup, .modal');
              elementsToRemove.forEach(el => el.remove());
              
              // Extract title
              const title = document.title || document.querySelector('h1')?.textContent || '';
              
              let content = '';
              
              // Extract structured data
              const jsonLdScripts = document.querySelectorAll('script[type="application/ld+json"]');
              jsonLdScripts.forEach(script => {
                try {
                  const data = JSON.parse(script.textContent || '');
                  content += '[STRUCTURED DATA]\\n' + JSON.stringify(data, null, 2) + '\\n\\n';
                } catch (e) {
                  // Ignore invalid JSON
                }
              });
              
              // Extract product information from rendered DOM
              const productSelectors = [
                'table', 'dl', 'ul', 'ol',
                '[class*="spec"]', '[id*="spec"]',
                '[class*="technical"]', '[id*="technical"]',
                '[class*="detail"]', '[id*="detail"]',
                '[class*="product"]', '[id*="product"]',
                '.specifications', '.specs', '.details'
              ];
              
              productSelectors.forEach(selector => {
                const elements = document.querySelectorAll(selector);
                elements.forEach(el => {
                  const text = el.textContent?.trim();
                  if (text && text.length > 50 && text.length < 5000) {
                    content += '[' + selector.toUpperCase() + ']\\n' + text + '\\n\\n';
                  }
                });
              });
              
              // Extract main content areas
              const contentSelectors = ['main', '.main-content', '.content', '.product-info', 'article'];
              contentSelectors.forEach(selector => {
                const elements = document.querySelectorAll(selector);
                elements.forEach(el => {
                  const text = el.textContent?.trim();
                  if (text && text.length > 100) {
                    content += '[' + selector.toUpperCase() + ']\\n' + text.substring(0, 2000) + '\\n\\n';
                  }
                });
              });
              
              // Fallback to body content
              if (content.length < 500) {
                const bodyText = document.body.textContent?.trim();
                if (bodyText && bodyText.length > 100) {
                  content += '[BODY CONTENT]\\n' + bodyText.substring(0, 3000) + '\\n\\n';
                }
              }
              
              return {
                title: title.trim(),
                content: content,
                contentLength: content.length
              };
            });
            
            await browser.close();
            
            console.log(JSON.stringify({
              success: true,
              title: result.title,
              content: result.content,
              contentLength: result.contentLength
            }));
            
          } catch (error) {
            if (browser) {
              await browser.close().catch(() => {});
            }
            console.log(JSON.stringify({
              success: false,
              error: error.message
            }));
          }
        })();
      `;

      const nodeProcess = spawn('node', ['-e', jsScript], {
        timeout: 30000,
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let stdout = '';
      let stderr = '';

      nodeProcess.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      nodeProcess.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      nodeProcess.on('close', (code) => {
        const loadTime = Date.now() - startTime;

        try {
          // Try to parse the JSON output from the script
          const lines = stdout.trim().split('\n');
          const lastLine = lines[lines.length - 1];
          const result = JSON.parse(lastLine);

          if (result.success) {
            resolve({
              url,
              title: result.title || url,
              content: result.content || '',
              method: 'direct-js',
              success: true,
              contentLength: result.contentLength || 0,
              loadTime,
              contentSample: (result.content || '').substring(0, 500),
              debugInfo: {
                loadTime,
                processExitCode: code,
                stderr: stderr.length > 0 ? stderr.substring(0, 500) : undefined
              }
            });
          } else {
            resolve({
              url,
              title: url,
              content: '',
              method: 'direct-js',
              success: false,
              contentLength: 0,
              loadTime,
              debugInfo: {
                error: result.error || 'Unknown error',
                loadTime,
                processExitCode: code,
                stderr: stderr.length > 0 ? stderr.substring(0, 500) : undefined,
                stdout: stdout.length > 0 ? stdout.substring(0, 500) : undefined
              }
            });
          }
        } catch (parseError) {
          resolve({
            url,
            title: url,
            content: '',
            method: 'direct-js',
            success: false,
            contentLength: 0,
            loadTime,
            debugInfo: {
              error: 'Failed to parse script output',
              parseError: parseError instanceof Error ? parseError.message : String(parseError),
              loadTime,
              processExitCode: code,
              stderr: stderr.length > 0 ? stderr.substring(0, 500) : undefined,
              stdout: stdout.length > 0 ? stdout.substring(0, 500) : undefined
            }
          });
        }
      });

      nodeProcess.on('error', (error) => {
        const loadTime = Date.now() - startTime;
        resolve({
          url,
          title: url,
          content: '',
          method: 'direct-js',
          success: false,
          contentLength: 0,
          loadTime,
          debugInfo: {
            error: 'Process spawn error',
            spawnError: error.message,
            loadTime
          }
        });
      });

      // Set a timeout for the entire operation
      setTimeout(() => {
        nodeProcess.kill('SIGTERM');
        const loadTime = Date.now() - startTime;
        resolve({
          url,
          title: url,
          content: '',
          method: 'direct-js',
          success: false,
          contentLength: 0,
          loadTime,
          debugInfo: {
            error: 'Operation timeout',
            loadTime
          }
        });
      }, 30000);
    });
  }

  async scrapeUrl(url: string, articleNumber?: string): Promise<DirectScrapedContent> {
    try {
      return await this.jsRenderScrape(url, articleNumber);
    } catch (error) {
      return {
        url,
        title: url,
        content: '',
        method: 'direct-js',
        success: false,
        contentLength: 0,
        debugInfo: {
          error: error instanceof Error ? error.message : String(error)
        }
      };
    }
  }
}

export const directScraper = new DirectScraper();