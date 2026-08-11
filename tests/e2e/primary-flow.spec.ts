import { expect, test } from "@playwright/test";

test("Day 1 completes and survives refresh", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: /Start today’s lesson/i }).click();
  for (let guard = 0; guard < 20; guard += 1) {
    if (
      await page
        .getByText("LESSON COMPLETE")
        .isVisible()
        .catch(() => false)
    )
      break;
    const reveal = page.getByRole("button", { name: "Reveal phrase" });
    if (await reveal.isVisible().catch(() => false)) await reveal.click();
    const answer = page.getByRole("button", { name: "Hello" });
    if (await answer.isVisible().catch(() => false)) await answer.click();
    const continueButton = page.getByRole("button", {
      name: /Continue|Complete lesson/,
    });
    if (await continueButton.isEnabled().catch(() => false))
      await continueButton.click();
  }
  await expect(page.getByText("LESSON COMPLETE")).toBeVisible();
  await page.getByRole("link", { name: "Done for today" }).click();
  await page.reload();
  await expect(page.getByText(/1\/7/)).toBeVisible();
});

test("denied microphone offers a technical path and never blocks", async ({
  context,
  page,
}) => {
  await context.clearPermissions();
  await page.goto("/lesson/mx71.d01");
  for (let i = 0; i < 7; i += 1) {
    const reveal = page.getByRole("button", { name: "Reveal phrase" });
    if (await reveal.isVisible().catch(() => false)) await reveal.click();
    const answer = page.getByRole("button", { name: "Hello" });
    if (await answer.isVisible().catch(() => false)) await answer.click();
    const next = page.getByRole("button", { name: "Continue" });
    if (await next.isEnabled().catch(() => false)) await next.click();
    if (
      await page
        .getByRole("button", { name: "Tap to speak" })
        .isVisible()
        .catch(() => false)
    )
      break;
  }
  await page.getByRole("button", { name: "Tap to speak" }).click();
  await expect(
    page.getByText(/permission is off|microphone is unavailable/i),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Continue" })).toBeEnabled();
});

test("Friendly Arrival mission follows authored turns", async ({ page }) => {
  await page.goto("/mission/friendly-arrival");
  await expect(page.getByText("Friendly arrival")).toBeVisible();
  await page.getByRole("button", { name: "Respond" }).click();
  await page.getByRole("button", { name: "Need a phrase" }).click();
  await page.getByRole("button", { name: "Check" }).click();
  await expect(page.getByText(/Understood|Also correct/)).toBeVisible();
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
