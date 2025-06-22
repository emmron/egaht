// Visual regression testing utilities for Eghact components
import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs-extra';

let browser = null;
let context = null;
let page = null;

const DEFAULT_OPTIONS = {
  baseUrl: 'http://localhost:3000',
  snapshotDir: '__visual_snapshots__',
  diffDir: '__visual_diffs__',
  threshold: 0.01, // 1% difference threshold
  viewports: [
    { width: 1280, height: 720, name: 'desktop' },
    { width: 768, height: 1024, name: 'tablet' },
    { width: 375, height: 667, name: 'mobile' }
  ],
  animations: 'disabled',
  waitForSelector: null,
  waitForTimeout: 0
};

let options = { ...DEFAULT_OPTIONS };

/**
 * Set up visual testing environment
 * @param {Object} customOptions - Custom options
 */
export async function setupVisualTesting(customOptions = {}) {
  options = { ...DEFAULT_OPTIONS, ...customOptions };
  
  // Ensure directories exist
  await fs.ensureDir(options.snapshotDir);
  await fs.ensureDir(options.diffDir);
  
  // Launch browser
  browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  context = await browser.newContext({
    // Disable animations for consistent snapshots
    reducedMotion: options.animations === 'disabled' ? 'reduce' : null,
    // Set default viewport
    viewport: options.viewports[0]
  });
  
  page = await context.newPage();
  
  // Add console log handler for debugging
  page.on('console', msg => {
    if (process.env.DEBUG_VISUAL_TESTS) {
      console.log(`[Browser Console] ${msg.type()}: ${msg.text()}`);
    }
  });
  
  return { browser, context, page };
}

/**
 * Take a snapshot of a component or page
 * @param {string} name - Snapshot name
 * @param {Object} snapshotOptions - Snapshot options
 */
export async function takeSnapshot(name, snapshotOptions = {}) {
  if (!page) {
    throw new Error('Visual testing not set up. Call setupVisualTesting() first.');
  }
  
  const {
    url,
    component,
    props = {},
    viewport,
    fullPage = false,
    clip,
    selector,
    waitForSelector: customWaitForSelector,
    waitForTimeout: customWaitForTimeout,
    beforeSnapshot
  } = snapshotOptions;
  
  // Navigate to URL or render component
  if (url) {
    await page.goto(`${options.baseUrl}${url}`, { waitUntil: 'networkidle' });
  } else if (component) {
    // Render component in isolation
    await renderComponentForSnapshot(component, props);
  }
  
  // Set viewport if specified
  if (viewport) {
    await page.setViewportSize(viewport);
  }
  
  // Wait for element or timeout
  const waitSelector = customWaitForSelector || options.waitForSelector;
  if (waitSelector) {
    await page.waitForSelector(waitSelector, { state: 'visible' });
  }
  
  const waitTimeout = customWaitForTimeout || options.waitForTimeout;
  if (waitTimeout) {
    await page.waitForTimeout(waitTimeout);
  }
  
  // Execute custom setup function
  if (beforeSnapshot) {
    await beforeSnapshot(page);
  }
  
  // Determine what to capture
  let screenshotOptions = {
    fullPage,
    animations: 'disabled'
  };
  
  if (clip) {
    screenshotOptions.clip = clip;
  }
  
  let element = page;
  if (selector) {
    element = await page.$(selector);
    if (!element) {
      throw new Error(`Selector "${selector}" not found`);
    }
  }
  
  // Take screenshots for all viewports if testing responsiveness
  const results = [];
  const viewports = viewport ? [viewport] : options.viewports;
  
  for (const vp of viewports) {
    if (!viewport) {
      await page.setViewportSize(vp);
      // Wait for any responsive changes to settle
      await page.waitForTimeout(100);
    }
    
    const snapshotPath = path.join(
      options.snapshotDir,
      `${name}-${vp.name || 'default'}.png`
    );
    
    // Check if baseline exists
    const baselineExists = await fs.pathExists(snapshotPath);
    
    if (baselineExists) {
      // Take new screenshot to temp location
      const tempPath = path.join(options.diffDir, `${name}-${vp.name}-new.png`);
      await element.screenshot({ ...screenshotOptions, path: tempPath });
      
      // Compare with baseline
      const result = await compareSnapshots(snapshotPath, tempPath, name, vp.name);
      results.push(result);
      
      // Update baseline if requested
      if (process.env.UPDATE_SNAPSHOTS === 'true' && !result.pass) {
        await fs.copy(tempPath, snapshotPath, { overwrite: true });
        console.log(`✅ Updated snapshot: ${name}-${vp.name}`);
      }
    } else {
      // Create baseline
      await element.screenshot({ ...screenshotOptions, path: snapshotPath });
      console.log(`📸 Created baseline snapshot: ${name}-${vp.name}`);
      results.push({ pass: true, new: true });
    }
  }
  
  return results;
}

/**
 * Render a component in isolation for snapshot testing
 */
async function renderComponentForSnapshot(Component, props) {
  const componentHTML = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body {
          margin: 0;
          padding: 20px;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        }
        #test-component {
          isolation: isolate;
        }
      </style>
    </head>
    <body>
      <div id="test-component"></div>
      <script type="module">
        import { runtime } from '/__eghact/runtime.js';
        
        // Component code would be injected here
        const Component = ${Component.toString()};
        const props = ${JSON.stringify(props)};
        
        const component = Component.createComponent();
        const rendered = component.render(props);
        
        const container = document.getElementById('test-component');
        if (typeof rendered === 'string') {
          container.innerHTML = rendered;
        } else {
          container.appendChild(rendered);
        }
      </script>
    </body>
    </html>
  `;
  
  await page.setContent(componentHTML, { waitUntil: 'networkidle' });
}

/**
 * Compare two snapshots
 */
async function compareSnapshots(baselinePath, newPath, name, viewport) {
  try {
    // In a real implementation, use a proper image comparison library
    // like pixelmatch or looks-same
    const { default: pixelmatch } = await import('pixelmatch');
    const { PNG } = await import('pngjs');
    
    const baseline = PNG.sync.read(await fs.readFile(baselinePath));
    const current = PNG.sync.read(await fs.readFile(newPath));
    
    const { width, height } = baseline;
    const diff = new PNG({ width, height });
    
    const numDiffPixels = pixelmatch(
      baseline.data,
      current.data,
      diff.data,
      width,
      height,
      { threshold: options.threshold }
    );
    
    const diffPercentage = (numDiffPixels / (width * height)) * 100;
    const pass = diffPercentage <= options.threshold * 100;
    
    if (!pass) {
      // Save diff image
      const diffPath = path.join(options.diffDir, `${name}-${viewport}-diff.png`);
      await fs.writeFile(diffPath, PNG.sync.write(diff));
      
      return {
        pass: false,
        diffPercentage,
        diffPath,
        message: `Visual difference of ${diffPercentage.toFixed(2)}% exceeds threshold of ${options.threshold * 100}%`
      };
    }
    
    return { pass: true, diffPercentage };
  } catch (error) {
    // If comparison fails, assume images are different
    return {
      pass: false,
      error: error.message,
      message: `Failed to compare snapshots: ${error.message}`
    };
  }
}

/**
 * Clean up visual testing resources
 */
export async function teardownVisualTesting() {
  if (page) await page.close();
  if (context) await context.close();
  if (browser) await browser.close();
  
  page = null;
  context = null;
  browser = null;
}

/**
 * Jest matcher for visual regression
 */
export function toMatchSnapshot(received, name, options) {
  // This would be used as a custom Jest matcher
  // expect(component).toMatchSnapshot('button-primary');
  
  return {
    pass: false,
    message: () => 'Visual snapshot matching not yet implemented'
  };
}

// Auto cleanup after tests if using Jest
if (typeof afterAll !== 'undefined') {
  afterAll(async () => {
    await teardownVisualTesting();
  });
}