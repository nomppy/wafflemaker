/**
 * Record a demo video of Wafflemaker flows using Playwright.
 * Usage: npx playwright test scripts/record-demo.ts --headed
 * Or: npx tsx scripts/record-demo.ts
 */

import { chromium } from "@playwright/test";
import path from "path";

const BASE = "http://localhost:8788";
const OUTPUT = path.join(process.env.HOME!, "Downloads/wafflemaker");

async function main() {
  const browser = await chromium.launch({ headless: true });

  // Record video of the full flow
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 }, // iPhone-like
    recordVideo: {
      dir: OUTPUT,
      size: { width: 390, height: 844 },
    },
    permissions: ["microphone"],
    launchOptions: {
      args: [
        "--use-fake-ui-for-media-stream",
        "--use-fake-device-for-media-stream",
      ],
    },
  });

  const page = await context.newPage();

  // 1. Landing page
  console.log("1. Landing page...");
  await page.goto(BASE);
  await page.waitForLoadState("networkidle");
  await page.screenshot({ path: path.join(OUTPUT, "01-landing.png") });
  await page.waitForTimeout(2000);

  // 2. Click "Start Waffling"
  console.log("2. Navigate to login...");
  await page.click('text=Start Waffling');
  await page.waitForLoadState("networkidle");
  await page.screenshot({ path: path.join(OUTPUT, "02-login.png") });
  await page.waitForTimeout(1500);

  // 3. Enter email and submit
  console.log("3. Enter email...");
  await page.fill('input[type="email"]', "demo@wafflemaker.app");
  await page.waitForTimeout(500);
  await page.click('button[type="submit"]');
  await page.waitForTimeout(2000);
  await page.screenshot({ path: path.join(OUTPUT, "03-check-email.png") });
  await page.waitForTimeout(1500);

  // 4. Use dev link to login
  console.log("4. Click dev login link...");
  const devLink = page.locator("text=Dev: Click to login");
  if (await devLink.isVisible()) {
    await devLink.click();
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1000);
  }
  await page.screenshot({ path: path.join(OUTPUT, "04-dashboard.png") });
  await page.waitForTimeout(2000);

  console.log("Done! Screenshots saved to", OUTPUT);
  await context.close();
  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
