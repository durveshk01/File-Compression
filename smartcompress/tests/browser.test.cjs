const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const readline = require('node:readline');
const path = require('node:path');
const fs = require('node:fs');
const { chromium } = require(process.env.SMARTCOMPRESS_PLAYWRIGHT_MODULE || 'playwright');

let browser, bridge, page, nextId = 0;
const pending = new Map();
const errors = [];

before(async () => {
  fs.mkdirSync('.audit', { recursive: true });
  bridge = spawn(process.env.SMARTCOMPRESS_TEST_PYTHON || 'python', ['tests/browser_bridge.py', '.audit'], { cwd: path.resolve(__dirname, '..') });
  readline.createInterface({ input: bridge.stdout }).on('line', line => {
    const result = JSON.parse(line);
    const waiter = pending.get(result.id);
    pending.delete(result.id);
    if (result.error) waiter.reject(new Error(result.error)); else waiter.resolve(result);
  });
  bridge.stderr.on('data', chunk => process.stderr.write(chunk));
  bridge.on('exit', code => {
    for (const waiter of pending.values()) waiter.reject(new Error(`ASGI bridge exited (${code})`));
    pending.clear();
  });
  browser = await chromium.launch({ headless: true, ...(process.env.SMARTCOMPRESS_CHROMIUM_PATH ? { executablePath: process.env.SMARTCOMPRESS_CHROMIUM_PATH } : {}) });
  page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.route('http://smartcompress.test/**', async route => {
    const request = route.request(), id = ++nextId;
    const response = await new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject });
      bridge.stdin.write(JSON.stringify({ id, method: request.method(), url: new URL(request.url()).pathname, headers: request.headers(), body: (request.postDataBuffer() || Buffer.alloc(0)).toString('base64') }) + '\n');
    });
    // Chromium calculates transfer length for fulfilled bodies itself.
    delete response.headers['content-length'];
    await route.fulfill({ status: response.status, headers: response.headers, body: Buffer.from(response.body, 'base64') });
  });
});

after(async () => {
  if (browser) await browser.close();
  if (bridge) bridge.stdin.end();
});

// A generated PNG: the real Pillow adapter validates and compresses it.
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAFElEQVR4nGPUCKhgwAaYsIoOWgkAwFgBALQ78QgAAAAASUVORK5CYII=', 'base64');
const file = name => ({ name, mimeType: 'image/png', buffer: png });

test('settings survive removing another file with the same name', async () => {
  await page.goto('http://smartcompress.test/');
  await page.locator('#file-input').setInputFiles([file('same.png'), file('same.png')]);
  const second = page.locator('.file-card').nth(1);
  await second.locator('.target-kind').selectOption('custom');
  await second.locator('.target-value').fill('12');
  await second.locator('.mode-select').selectOption('lossless');
  await page.locator('.remove-file').first().click();
  assert.equal(await page.locator('.target-value').inputValue(), '12');
  assert.equal(await page.locator('.mode-select').inputValue(), 'lossless');
});

test('cancelled uploads never start jobs after removal', async () => {
  await page.goto('http://smartcompress.test/');
  await page.locator('#file-input').setInputFiles(file('remove.png'));
  await page.locator('.target-kind').selectOption('custom');
  await page.locator('.target-value').fill('1');
  await page.evaluate(() => {
    window.__jobCreates = 0;
    const original = window.fetch;
    window.fetch = (...args) => {
      if (args[0] === '/api/v1/compression-jobs') window.__jobCreates++;
      return original(...args);
    };
    uploadWithProgress = async () => {
      await new Promise(resolve => setTimeout(resolve, 150));
      return { upload_id: 'a'.repeat(32), upload_token: 'b'.repeat(43), supported: true };
    };
  });
  await page.locator('.single-run').click();
  await page.locator('.remove-file').click();
  await page.waitForTimeout(250);
  assert.equal(await page.evaluate(() => window.__jobCreates), 0);
});

test('automatic compression, previews, downloads and shared batch settings', async () => {
  await page.goto('http://smartcompress.test/');
  await page.locator('#file-input').setInputFiles([file('one.png'), file('two.png')]);
  await page.locator('#batch-target').selectOption('auto');
  await page.locator('#batch-mode').selectOption('lossless');
  await page.locator('#apply-settings').click();
  assert.equal(await page.locator('.target-kind').first().inputValue(), 'auto');
  await page.locator('#compress-all').click();
  await page.waitForFunction(() => document.querySelectorAll('.file-status.done, .file-status.error').length === 2);
  assert.equal(await page.locator('.file-status.done').count(), 2, await page.locator('.file-status').allTextContents());
  assert.match(await page.locator('#batch-summary').innerText(), /2.*completed/);
  assert.equal(await page.locator('.single-run').first().innerText(), 'Download â†“');
  const csvDownload = page.waitForEvent('download');
  await page.locator('#export-results').click();
  const csv = await csvDownload;
  const csvText = fs.readFileSync(await csv.path(), 'utf8');
  assert.match(csvText, /original_bytes/);
  assert.ok(!csvText.includes('job_token'));
  const zipped = page.waitForEvent('download');
  await page.locator('#batch-download').click();
  assert.equal((await zipped).suggestedFilename(), 'smartcompress-results.zip');
  await page.locator('.preview-result').first().click();
  await page.waitForFunction(() => document.querySelector('#preview-dialog').open);
  assert.equal(await page.locator('#preview-dialog').evaluate(el => el.open), true);
  await page.waitForFunction(() => [...document.querySelectorAll('#preview-content img')].every(img => img.complete && img.naturalWidth));
  await page.locator('#close-preview').click();
  await page.locator('#theme-toggle').click();
  assert.equal(await page.locator('html').getAttribute('data-theme'), 'dark');
  assert.deepEqual(errors, []);
  await page.screenshot({ path: '.audit/browser-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 360, height: 800 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
  await page.screenshot({ path: '.audit/browser-mobile.png', fullPage: true });
});

test('a completed single-file action downloads exactly once', async () => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('http://smartcompress.test/');
  await page.locator('#file-input').setInputFiles(file('single.png'));
  await page.locator('.single-run').click();
  await page.waitForFunction(() => document.querySelector('.file-status.done'));
  let count = 0;
  const listener = () => count++;
  page.on('download', listener);
  const download = page.waitForEvent('download');
  await page.locator('.single-run').click();
  assert.equal((await download).suggestedFilename(), 'single.png');
  await page.waitForTimeout(100);
  assert.equal(count, 1);
  page.off('download', listener);
  assert.deepEqual(errors, []);
});

test('retry reuses the validated upload after a job creation failure', async () => {
  await page.goto('http://smartcompress.test/');
  let uploads = 0;
  const observe = request => { if (new URL(request.url()).pathname === '/api/v1/files') uploads++; };
  page.on('request', observe);
  const fail = route => route.fulfill({ status: 503, contentType: 'application/json', body: '{"detail":"Temporarily busy"}' });
  await page.route('**/api/v1/compression-jobs', fail);
  await page.locator('#file-input').setInputFiles(file('retry.png'));
  await page.locator('.single-run').click();
  await page.waitForFunction(() => document.querySelector('.file-status.error'));
  assert.match(await page.locator('.file-status').innerText(), /Temporarily busy/);
  await page.unroute('**/api/v1/compression-jobs', fail);
  await page.locator('.single-run').click();
  await page.waitForFunction(() => document.querySelector('.file-status.done'));
  assert.equal(uploads, 1);
  page.off('request', observe);
  assert.ok(errors.every(message => message.includes('503')));
});
