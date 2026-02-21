import { test, expect, BrowserContext, Page } from "@playwright/test";

test.describe("Wednesday Waffles E2E", () => {
  test("landing page loads with informative content", async ({ page }) => {
    await page.goto("/");

    await expect(page.locator("h1")).toContainText("Wednesday Waffles");
    await expect(page.getByText("A voice message to a friend")).toBeVisible();
    await expect(page.getByRole("link", { name: "Get Started" })).toBeVisible();

    await expect(page.getByText("What's a Wednesday Waffle?")).toBeVisible();
    await expect(page.getByText("Pair up")).toBeVisible();
    await expect(page.getByText("Record your waffle")).toBeVisible();
    await expect(page.getByText("Listen on your own time")).toBeVisible();
    await expect(page.getByText("Keep the streak going")).toBeVisible();
    await expect(page.getByText("Why Wednesday?")).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Start Waffling" })
    ).toBeVisible();
  });

  test("login page renders", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByText("Sign in to Wednesday Waffles")).toBeVisible();
    await expect(page.getByPlaceholder("your@email.com")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Send magic link" })
    ).toBeVisible();
  });

  test("login page shows error for invalid token", async ({ page }) => {
    await page.goto("/login?error=invalid_token");
    await expect(page.getByText("expired")).toBeVisible();
  });

  test("dashboard redirects to login when not authenticated", async ({
    page,
  }) => {
    await page.goto("/dashboard");
    await page.waitForURL("**/login**");
  });

  test("full auth flow: signup via magic link", async ({ page }) => {
    await page.goto("/login");

    await page.getByPlaceholder("your@email.com").fill("alice@test.com");
    await page.getByRole("button", { name: "Send magic link" }).click();

    await expect(page.getByText("Check your email")).toBeVisible();
    await expect(page.getByText("alice@test.com")).toBeVisible();

    const devLink = page.getByRole("link", { name: "Dev: Click to login" });
    await expect(devLink).toBeVisible();
    await devLink.click();

    await page.waitForURL("**/dashboard**");
    await expect(page.getByText("Your Waffles")).toBeVisible();
    await expect(page.getByText("Hey, alice")).toBeVisible();
  });

  test("dashboard shows welcome content for new user", async ({ page }) => {
    await loginAs(page, "newuser@test.com");

    await expect(page.getByText("Welcome to Wednesday Waffles!")).toBeVisible();
    await expect(page.getByText("How it works:")).toBeVisible();
    await expect(
      page.getByText("Invite a friend with a shareable link")
    ).toBeVisible();
  });

  test("invite flow: create invite and get link", async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await loginAs(page, "inviter@test.com");

    await page.getByRole("button", { name: "Invite a friend" }).click();

    await expect(
      page.getByText("Share this link with your friend")
    ).toBeVisible();
    const input = page.locator("input[readonly]");
    await expect(input).toBeVisible();
    const inviteUrl = await input.inputValue();
    expect(inviteUrl).toContain("/invite/");

    await page.getByRole("button", { name: "Copy" }).click();
    await expect(page.getByRole("button", { name: "Copied!" })).toBeVisible();
  });

  test("full pairing flow: Alice invites Bob", async ({ browser }) => {
    // Use separate browser contexts so they don't share cookies
    const aliceContext = await browser.newContext({
      permissions: ["microphone"],
    });
    const bobContext = await browser.newContext({
      permissions: ["microphone"],
    });
    const alicePage = await aliceContext.newPage();
    const bobPage = await bobContext.newPage();

    try {
      // Alice logs in and creates invite
      await loginAs(alicePage, "alice-pair@test.com");
      await alicePage
        .getByRole("button", { name: "Invite a friend" })
        .click();
      await expect(alicePage.getByText("Share this link")).toBeVisible();
      const inviteUrl = await alicePage
        .locator("input[readonly]")
        .inputValue();

      // Bob opens the invite link - should redirect to login
      await bobPage.goto(inviteUrl);
      await bobPage.waitForURL(/login/, { timeout: 10000 });

      // Bob logs in
      await bobPage
        .getByPlaceholder("your@email.com")
        .fill("bob-pair@test.com");
      await bobPage
        .getByRole("button", { name: "Send magic link" })
        .click();
      await expect(bobPage.getByText("Check your email")).toBeVisible();
      const bobDevLink = bobPage.getByRole("link", {
        name: "Dev: Click to login",
      });
      await expect(bobDevLink).toBeVisible();

      // The magic link should include the redirect to the invite
      const href = await bobDevLink.getAttribute("href");
      expect(href).toContain("redirect=");

      await bobDevLink.click();
      // Bob should land on dashboard after accepting the invite
      await bobPage.waitForURL("**/dashboard**");

      // Bob should see Alice as a pair
      await expect(bobPage.getByText("alice-pair").first()).toBeVisible();

      // Refresh Alice's page - she should see Bob
      await alicePage.reload();
      await expect(alicePage.getByText("bob-pair").first()).toBeVisible();
    } finally {
      await aliceContext.close();
      await bobContext.close();
    }
  });

  test("pair conversation page loads with prompts", async ({ browser }) => {
    const { alicePage, bobPage, pairUrl, cleanup } = await createPair(
      browser,
      "conv-alice@test.com",
      "conv-bob@test.com"
    );

    try {
      await alicePage.goto(pairUrl);
      await alicePage.waitForLoadState("networkidle");

      await expect(alicePage.getByText("conv-bob")).toBeVisible({ timeout: 10000 });
      await expect(alicePage.getByText("Back")).toBeVisible();
      await expect(alicePage.getByText("Time to break the ice!")).toBeVisible();
      await expect(alicePage.getByText("Not sure what to say?")).toBeVisible();
      await expect(
        alicePage.getByRole("button", { name: "Start recording" })
      ).toBeVisible();

      // Prompt shuffle should work without error
      await alicePage.getByText("Another prompt").click();
      await expect(alicePage.getByText("Another prompt")).toBeVisible();
    } finally {
      await cleanup();
    }
  });

  test("audio recording and playback flow", async ({ browser }) => {
    const { alicePage, bobPage, pairUrl, cleanup } = await createPair(
      browser,
      "rec-alice@test.com",
      "rec-bob@test.com"
    );

    try {
      await alicePage.goto(pairUrl);

      // Handle alert dialog if getUserMedia fails
      alicePage.on("dialog", (dialog) => dialog.dismiss());

      // Click record
      await alicePage
        .getByRole("button", { name: "Start recording" })
        .click();

      // Should show recording state (if mic is available)
      await expect(alicePage.getByText("Tap to stop & send")).toBeVisible({ timeout: 5000 });
      await expect(
        alicePage.getByRole("button", { name: "Stop recording" })
      ).toBeVisible();

      // Wait for some recording time
      await alicePage.waitForTimeout(2500);

      // Stop recording
      await alicePage
        .getByRole("button", { name: "Stop recording" })
        .click();

      // Wait for upload to complete and waffle to appear
      await expect(alicePage.getByText("rec-alice").first()).toBeVisible({
        timeout: 10000,
      });

      // Play button should exist
      const playButton = alicePage.locator("button").filter({ hasText: "▶" }).first();
      await expect(playButton).toBeVisible();

      // Click play - audio data is from fake mic, so it may error but UI should not crash
      await playButton.click();
      await alicePage.waitForTimeout(500);
      await expect(alicePage.getByText("rec-alice").first()).toBeVisible();

      // Bob should also see the waffle
      await bobPage.goto(pairUrl);
      await expect(bobPage.getByText("rec-alice").first()).toBeVisible({
        timeout: 5000,
      });
    } finally {
      await cleanup();
    }
  });

  test("logout flow", async ({ page }) => {
    await loginAs(page, "logout-test@test.com");
    await expect(page.getByText("Your Waffles")).toBeVisible();

    await page.getByText("Sign out").click();
    await page.waitForURL("/");
  });

  test("no console errors (hydration, nesting) on key pages", async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("console", (msg) => {
      const text = msg.text();
      if (
        msg.type() === "error" &&
        (text.includes("hydration") ||
          text.includes("cannot be a descendant") ||
          text.includes("cannot contain"))
      ) {
        errors.push(text);
      }
    });

    await page.goto("/");
    await page.waitForTimeout(1000);

    await page.goto("/login");
    await page.waitForTimeout(1000);

    await loginAs(page, "hydration-check@test.com");
    await page.waitForTimeout(1000);

    expect(errors).toHaveLength(0);
  });

  test("no console errors on pair page with waffles", async ({ browser }) => {
    const { alicePage, bobPage, pairUrl, cleanup } = await createPair(
      browser,
      "err-alice@test.com",
      "err-bob@test.com"
    );

    try {
      // Record a waffle from Alice
      await alicePage.goto(pairUrl);
      alicePage.on("dialog", (dialog) => dialog.dismiss());
      await alicePage
        .getByRole("button", { name: "Start recording" })
        .click();
      await expect(
        alicePage.getByRole("button", { name: "Stop recording" })
      ).toBeVisible({ timeout: 5000 });
      await alicePage.waitForTimeout(1500);
      await alicePage
        .getByRole("button", { name: "Stop recording" })
        .click();
      await expect(alicePage.getByText("err-alice").first()).toBeVisible({
        timeout: 10000,
      });

      // Check Bob's view for console errors
      const errors: string[] = [];
      bobPage.on("console", (msg) => {
        const text = msg.text();
        if (
          msg.type() === "error" &&
          (text.includes("hydration") ||
            text.includes("cannot be a descendant") ||
            text.includes("cannot contain"))
        ) {
          errors.push(text);
        }
      });

      await bobPage.goto(pairUrl);
      await expect(bobPage.getByText("err-alice").first()).toBeVisible({
        timeout: 5000,
      });
      await bobPage.waitForTimeout(2000);

      expect(errors).toHaveLength(0);
    } finally {
      await cleanup();
    }
  });
});

// Helper: login as a user via dev magic link
async function loginAs(page: Page, email: string) {
  await page.goto("/login");
  await page.getByPlaceholder("your@email.com").fill(email);
  await page.getByRole("button", { name: "Send magic link" }).click();
  await page.getByRole("link", { name: "Dev: Click to login" }).click();
  await page.waitForURL("**/dashboard**");
}

// Helper: create two users in separate contexts and pair them
async function createPair(
  browser: import("@playwright/test").Browser,
  aliceEmail: string,
  bobEmail: string
) {
  const aliceContext = await browser.newContext({
    permissions: ["microphone"],
  });
  const bobContext = await browser.newContext({
    permissions: ["microphone"],
  });
  const alicePage = await aliceContext.newPage();
  const bobPage = await bobContext.newPage();

  // Alice logs in and creates invite
  await loginAs(alicePage, aliceEmail);
  await alicePage.getByRole("button", { name: "Invite a friend" }).click();
  await alicePage.waitForSelector("input[readonly]");
  const inviteUrl = await alicePage.locator("input[readonly]").inputValue();

  // Bob goes to invite URL - should redirect to login since he's not authenticated
  await bobPage.goto(inviteUrl);
  await bobPage.waitForURL(/login/, { timeout: 10000 });

  // Bob logs in (magic link should redirect back to invite after auth)
  await bobPage.getByPlaceholder("your@email.com").fill(bobEmail);
  await bobPage.getByRole("button", { name: "Send magic link" }).click();
  await bobPage.getByRole("link", { name: "Dev: Click to login" }).click();
  // Should end up on dashboard after invite acceptance
  await bobPage.waitForURL("**/dashboard**");

  // Get the pair URL from Bob's dashboard
  const pairLink = bobPage.locator('a[href^="/pair/"]');
  await expect(pairLink).toBeVisible();
  const pairHref = (await pairLink.getAttribute("href"))!;
  const pairUrl = `http://localhost:3000${pairHref}`;

  const cleanup = async () => {
    await aliceContext.close();
    await bobContext.close();
  };

  return { alicePage, bobPage, pairUrl, cleanup };
}
