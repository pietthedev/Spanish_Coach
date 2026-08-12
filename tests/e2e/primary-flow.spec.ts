import { expect, test, type Page } from "@playwright/test";

async function denyMicrophone(page: Page) {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        getUserMedia: () =>
          Promise.reject(
            new DOMException("Microphone permission denied", "NotAllowedError"),
          ),
      },
    });
  });
}

test("Day 1 completes and survives refresh", async ({ context, page }) => {
  await context.clearPermissions();
  await denyMicrophone(page);
  await page.goto("/lesson/mx71.d01");

  for (let step = 0; step < 9; step += 1) {
    const reveal = page.getByRole("button", { name: "Reveal phrase" });
    if (await reveal.isVisible().catch(() => false)) await reveal.click();

    const answer = page.getByRole("button", { name: "Hello" });
    if (await answer.isVisible().catch(() => false)) await answer.click();

    const microphone = page.getByRole("button", { name: "Tap to speak" });
    if (await microphone.isVisible().catch(() => false))
      await microphone.click();

    const continueButton = page.getByRole("button", {
      name: /Continue|Complete lesson/,
    });
    await expect(continueButton).toBeEnabled();
    await continueButton.click();
  }

  await expect(page.getByText("LESSON COMPLETE")).toBeVisible();
  await Promise.all([
    page.waitForURL((url) => url.pathname === "/"),
    page.getByRole("link", { name: "Done for today" }).click(),
  ]);
  await page.reload();
  await expect(page.getByText(/1\/7/)).toBeVisible();
});

test("denied microphone offers a technical path and never blocks", async ({
  context,
  page,
}) => {
  await context.clearPermissions();
  await denyMicrophone(page);
  await page.goto("/lesson/mx71.d01");
  await page.getByRole("button", { name: "Tap to speak" }).click();
  await expect(
    page.getByText(/permission is off|microphone is unavailable/i),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Continue" })).toBeEnabled();
});

test("Friendly Arrival mission is tap-and-talk only", async ({
  context,
  page,
}) => {
  await context.clearPermissions();
  await denyMicrophone(page);
  await page.goto("/mission/friendly-arrival");
  await expect(page.getByText("Friendly arrival")).toBeVisible();
  await page.getByRole("button", { name: "Your turn" }).click();
  await expect(page.getByRole("textbox")).toHaveCount(0);
  await page.getByRole("button", { name: "Need a phrase" }).click();
  await expect(page.getByText("Hola", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Tap to speak" }).click();
  await expect(page.getByText(/permission is off|unavailable/i)).toBeVisible();
});

test("current lesson remains usable during an offline interruption", async ({
  context,
  page,
}) => {
  await page.goto("/lesson/mx71.d01");
  await context.setOffline(true);
  await expect(page.getByText("Hola")).toBeVisible();
  await context.setOffline(false);
});
