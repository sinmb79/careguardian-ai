import puppeteer from "puppeteer";
import { readFile } from "node:fs/promises";

const baseUrl = "http://localhost:4173/";
const browser = await puppeteer.launch({ headless: true });
const page = await browser.newPage();

async function clearWorkspace() {
  await page.goto(baseUrl, { waitUntil: "networkidle2" });
  await page.evaluate(async () => {
    localStorage.removeItem("life-steward.workspace.v1");
    await new Promise((resolve, reject) => {
      const request = indexedDB.deleteDatabase("life-steward-workspace");
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
      request.onblocked = () => resolve();
    });
  });
  await page.reload({ waitUntil: "networkidle2" });
  await page.waitForSelector("#workspace-title");
}

async function fill(selector, value) {
  await page.click(selector, { clickCount: 3 });
  await page.type(selector, value);
}

async function clickButton(label) {
  const clicked = await page.evaluate((text) => {
    const button = [...document.querySelectorAll("button")].find((candidate) => candidate.textContent?.trim() === text);
    button?.click();
    return Boolean(button);
  }, label);
  if (!clicked) throw new Error(`Could not find button: ${label}`);
}

async function scrollToTop() {
  await page.evaluate(() => window.scrollTo(0, 0));
  await new Promise((resolve) => setTimeout(resolve, 200));
}

async function scrollIntoView(selector) {
  await page.$eval(selector, (element) => element.scrollIntoView({ block: "start" }));
  await new Promise((resolve) => setTimeout(resolve, 200));
}

async function addSyntheticWorkspace() {
  await fill("#workspace-title", "가상 생활 계획");
  await fill("#extension-title", "외출 준비");
  await clickButton("기능 추가");
  await clickButton("이 브라우저에 저장");
  await page.waitForFunction(() => document.body.textContent?.includes("저장했습니다."));
}

async function capturePhone() {
  // Play screenshots must not exceed a 2:1 long-side ratio.  360×640 CSS at
  // 3× produces an opaque 1080×1920 9:16 PNG without downscaling the render.
  await page.setViewport({ width: 360, height: 640, deviceScaleFactor: 3 });
  await clearWorkspace();
  await scrollToTop();
  await page.screenshot({ path: "docs/screenshots/phone-screenshot-1.png", type: "png" });

  await fill("#workspace-title", "가상 생활 계획");
  await fill("#extension-title", "외출 준비");
  await clickButton("기능 추가");
  await scrollIntoView("#extension-builder-title");
  await page.screenshot({ path: "docs/screenshots/phone-screenshot-2.png", type: "png" });

  await clickButton("이 브라우저에 저장");
  await page.waitForFunction(() => document.body.textContent?.includes("저장했습니다."));
  await scrollToTop();
  await page.screenshot({ path: "docs/screenshots/phone-screenshot-3.png", type: "png" });

  await scrollIntoView(".workspace-clear-button");
  await clickButton("이 브라우저의 작업공간 삭제");
  await page.waitForSelector(".workspace-confirmation");
  await page.screenshot({ path: "docs/screenshots/phone-screenshot-4.png", type: "png" });
}

async function captureTablet7() {
  await page.setViewport({ width: 600, height: 1024, deviceScaleFactor: 1.5 });
  await clearWorkspace();
  await addSyntheticWorkspace();
  await scrollToTop();
  await page.screenshot({ path: "docs/screenshots/tablet7-screenshot-1.png", type: "png" });

  await clickButton("이 브라우저의 작업공간 삭제");
  await page.waitForSelector(".workspace-confirmation");
  await page.screenshot({ path: "docs/screenshots/tablet7-screenshot-2.png", type: "png" });
}

async function captureTablet10() {
  await page.setViewport({ width: 800, height: 1280, deviceScaleFactor: 2 });
  await clearWorkspace();
  await scrollToTop();
  await page.screenshot({ path: "docs/screenshots/tablet10-screenshot-1.png", type: "png" });

  await addSyntheticWorkspace();
  await scrollToTop();
  await page.screenshot({ path: "docs/screenshots/tablet10-screenshot-2.png", type: "png" });
}

async function assertPlayPng(path) {
  const bytes = await readFile(path);
  const signature = "89504e470d0a1a0a";
  if (bytes.subarray(0, 8).toString("hex") !== signature) throw new Error(`${path}: not a PNG`);
  const width = bytes.readUInt32BE(16);
  const height = bytes.readUInt32BE(20);
  const bitDepth = bytes[24];
  const colorType = bytes[25];
  const ratio = Math.max(width, height) / Math.min(width, height);
  if (ratio > 2 || bytes.byteLength > 8 * 1024 * 1024 || bitDepth !== 8 || colorType !== 2) {
    throw new Error(`${path}: requires 8-bit opaque RGB PNG, <=8MB, and ratio <=2:1; got ${width}x${height}, ${bytes.byteLength} bytes, bit depth ${bitDepth}, color type ${colorType}`);
  }
  console.log(`${path}: ${width}x${height}, RGB, ${bytes.byteLength} bytes`);
}

try {
  await capturePhone();
  await captureTablet7();
  await captureTablet10();
  await Promise.all([
    ...[1, 2, 3, 4].map((index) => assertPlayPng(`docs/screenshots/phone-screenshot-${index}.png`)),
    ...[1, 2].map((index) => assertPlayPng(`docs/screenshots/tablet7-screenshot-${index}.png`)),
    ...[1, 2].map((index) => assertPlayPng(`docs/screenshots/tablet10-screenshot-${index}.png`))
  ]);
  console.log("Captured 4 phone, 2 tablet-7, and 2 tablet-10 screenshots from the rendered web PWA.");
} finally {
  await browser.close();
}
