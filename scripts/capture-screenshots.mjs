import puppeteer from 'puppeteer';

const browser = await puppeteer.launch({ headless: true });
const page = await browser.newPage();

await page.setViewport({ width: 412, height: 915, deviceScaleFactor: 2.625 });
await page.goto('http://localhost:4173/', { waitUntil: 'networkidle2' });
await new Promise(r => setTimeout(r, 2000));

// Screenshot 1: Caregiver mode empty
await page.screenshot({ path: 'docs/screenshots/phone-screenshot-1.png', type: 'png' });
console.log('Screenshot 1 done');

// Fill in demo data using evaluate
await page.evaluate(() => {
  const inputs = document.querySelectorAll('input:not([type="file"])');
  const values = ['\uC218\uD638', '\uC544\uCE68 \uC2DD\uC0AC', '\uC774\uBAA8 010-1234-5678', '\uBE68\uAC04 \uC54C\uC57D', '08:30', '\uC870\uC6A9\uD55C \uBAA9\uC18C\uB9AC', '\uAC70\uC2E4 \uC18C\uD30C', '\uC774\uBAA8', '010-1234-5678'];
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  inputs.forEach((input, i) => {
    if (i < values.length) {
      setter.call(input, values[i]);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }
  });
});
await new Promise(r => setTimeout(r, 500));
await page.evaluate(() => window.scrollTo(0, 0));
await new Promise(r => setTimeout(r, 300));

// Screenshot 2: Caregiver mode with data
await page.screenshot({ path: 'docs/screenshots/phone-screenshot-2.png', type: 'png' });
console.log('Screenshot 2 done');

// Click save button
await page.evaluate(() => {
  const buttons = document.querySelectorAll('button');
  for (const btn of buttons) {
    if (btn.textContent.includes('\uC800\uC7A5\uD558\uACE0 \uB3D9\uBC18\uC790')) {
      btn.click();
      break;
    }
  }
});
await new Promise(r => setTimeout(r, 1500));
await page.evaluate(() => window.scrollTo(0, 0));
await new Promise(r => setTimeout(r, 300));

// Screenshot 3: Companion mode top
await page.screenshot({ path: 'docs/screenshots/phone-screenshot-3.png', type: 'png' });
console.log('Screenshot 3 done');

// Scroll down
await page.evaluate(() => window.scrollBy(0, 700));
await new Promise(r => setTimeout(r, 500));

// Screenshot 4: Companion mode scrolled
await page.screenshot({ path: 'docs/screenshots/phone-screenshot-4.png', type: 'png' });
console.log('Screenshot 4 done');

// --- 7-inch tablet (600x1024 CSS, 1.5x) ---
await page.setViewport({ width: 600, height: 1024, deviceScaleFactor: 1.5 });
await page.goto('http://localhost:4173/', { waitUntil: 'networkidle2' });
await new Promise(r => setTimeout(r, 2000));

// Fill data
await page.evaluate(() => {
  const inputs = document.querySelectorAll('input:not([type="file"])');
  const values = ['\uC218\uD638', '\uC544\uCE68 \uC2DD\uC0AC', '\uC774\uBAA8 010-1234-5678', '\uBE68\uAC04 \uC54C\uC57D', '08:30', '\uC870\uC6A9\uD55C \uBAA9\uC18C\uB9AC', '\uAC70\uC2E4 \uC18C\uD30C', '\uC774\uBAA8', '010-1234-5678'];
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  inputs.forEach((input, i) => { if (i < values.length) { setter.call(input, values[i]); input.dispatchEvent(new Event('input', { bubbles: true })); } });
});
await new Promise(r => setTimeout(r, 500));
await page.evaluate(() => window.scrollTo(0, 0));
await page.screenshot({ path: 'docs/screenshots/tablet7-screenshot-1.png', type: 'png' });
console.log('Tablet 7" screenshot 1 done');

await page.evaluate(() => {
  const buttons = document.querySelectorAll('button');
  for (const btn of buttons) { if (btn.textContent.includes('\uC800\uC7A5\uD558\uACE0 \uB3D9\uBC18\uC790')) { btn.click(); break; } }
});
await new Promise(r => setTimeout(r, 1500));
await page.evaluate(() => window.scrollTo(0, 0));
await page.screenshot({ path: 'docs/screenshots/tablet7-screenshot-2.png', type: 'png' });
console.log('Tablet 7" screenshot 2 done');

// --- 10-inch tablet (800x1280 CSS, 2x) ---
await page.setViewport({ width: 800, height: 1280, deviceScaleFactor: 2 });
await page.goto('http://localhost:4173/', { waitUntil: 'networkidle2' });
await new Promise(r => setTimeout(r, 2000));

await page.evaluate(() => {
  const inputs = document.querySelectorAll('input:not([type="file"])');
  const values = ['\uC218\uD638', '\uC544\uCE68 \uC2DD\uC0AC', '\uC774\uBAA8 010-1234-5678', '\uBE68\uAC04 \uC54C\uC57D', '08:30', '\uC870\uC6A9\uD55C \uBAA9\uC18C\uB9AC', '\uAC70\uC2E4 \uC18C\uD30C', '\uC774\uBAA8', '010-1234-5678'];
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  inputs.forEach((input, i) => { if (i < values.length) { setter.call(input, values[i]); input.dispatchEvent(new Event('input', { bubbles: true })); } });
});
await new Promise(r => setTimeout(r, 500));
await page.evaluate(() => window.scrollTo(0, 0));
await page.screenshot({ path: 'docs/screenshots/tablet10-screenshot-1.png', type: 'png' });
console.log('Tablet 10" screenshot 1 done');

await page.evaluate(() => {
  const buttons = document.querySelectorAll('button');
  for (const btn of buttons) { if (btn.textContent.includes('\uC800\uC7A5\uD558\uACE0 \uB3D9\uBC18\uC790')) { btn.click(); break; } }
});
await new Promise(r => setTimeout(r, 1500));
await page.evaluate(() => window.scrollTo(0, 0));
await page.screenshot({ path: 'docs/screenshots/tablet10-screenshot-1-companion.png', type: 'png' });
console.log('Tablet 10" screenshot 2 done');

await browser.close();
console.log('All done!');
