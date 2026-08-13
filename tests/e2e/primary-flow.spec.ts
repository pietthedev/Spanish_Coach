import { expect, test, type Page } from "@playwright/test";

/** Introduction steps narrate before revealing, so sessions are not instant. */
const LONG_SESSION = 180_000;

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

interface SeedRow {
  phraseId: string;
  dueAt: string;
  intervalStep?: number;
  independentSuccesses?: number;
  assistedSuccesses?: number;
}

/** Write mastery straight into IndexedDB so due-review behaviour is testable. */
async function seedMastery(page: Page, rows: SeedRow[]) {
  await page.evaluate(async (records) => {
    const request = indexedDB.open("rumbo-2026-1");
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction("phraseMastery", "readwrite");
      const store = tx.objectStore("phraseMastery");
      for (const row of records)
        store.put({
          id: `demo-profile:${row.phraseId}`,
          profileId: "demo-profile",
          phraseId: row.phraseId,
          intervalStep: row.intervalStep ?? 1,
          dueAt: row.dueAt,
          consecutiveSuccesses: 1,
          independentSuccesses: row.independentSuccesses ?? 1,
          assistedSuccesses: row.assistedSuccesses ?? 0,
          encounters: 3,
          independentDays: ["2026-08-10"],
        });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  }, rows);
}

const startSession = async (page: Page) => {
  await page.getByRole("button", { name: "Start session" }).click();
};

const continueButton = (page: Page) =>
  page.getByRole("button", { name: /^(Continue|Finish)$/ });

/**
 * Advance one step the lazy way: reveal on recall steps, and on listening
 * steps try each option until the right one unlocks Continue.
 */
async function advanceStep(page: Page) {
  const reveal = page.getByRole("button", { name: "Show the answer" });
  if (await reveal.isVisible().catch(() => false)) await reveal.click();

  const options = page.locator("button[aria-pressed]");
  for (let i = 0; i < (await options.count()); i += 1) {
    if (await continueButton(page).isEnabled()) break;
    await options.nth(i).click();
  }

  const next = continueButton(page);
  await expect(next).toBeEnabled({ timeout: 30_000 });
  await next.click();
}

test("a productive recall step never shows the Spanish answer", async ({
  page,
}) => {
  await denyMicrophone(page);
  await page.goto("/lesson/mx71.d02");
  await expect(page.getByRole("button", { name: "Start session" })).toBeVisible();
  await seedMastery(page, [
    { phraseId: "mx.greeting.hola", dueAt: "2020-01-01T00:00:00.000Z" },
  ]);
  await page.reload();
  await startSession(page);

  // Due material runs before anything new is introduced.
  await expect(page.getByText("SAY IT FROM MEMORY")).toBeVisible();
  await expect(page.locator("[data-spanish-answer]")).toHaveCount(0);
  await expect(continueButton(page)).toBeDisabled();

  // The hint ladder discloses progressively and never the whole phrase.
  await page.getByRole("button", { name: "Give me a hint" }).click();
  const hint = page.locator("[data-hint-text]");
  await expect(hint).toBeVisible();
  const first = await hint.innerText();
  await page.getByRole("button", { name: "More of the phrase" }).click();
  await expect(hint).not.toHaveText(first);
  const second = await hint.innerText();
  expect(second.length).toBeGreaterThan(first.length);
  expect("Hola".startsWith(second.replace("…", ""))).toBe(true);
  await expect(page.locator("[data-spanish-answer]")).toHaveCount(0);

  // Only an explicit reveal puts the answer on screen.
  await page.getByRole("button", { name: "Show the answer" }).click();
  await expect(page.locator("[data-spanish-answer]")).toContainText("Hola");
  await expect(continueButton(page)).toBeEnabled();
});

test("due reviews come before new material", async ({ page }) => {
  await denyMicrophone(page);
  await page.goto("/lesson/mx71.d02");
  await expect(page.getByRole("button", { name: "Start session" })).toBeVisible();
  await seedMastery(page, [
    { phraseId: "mx.greeting.hola", dueAt: "2020-01-01T00:00:00.000Z" },
    { phraseId: "mx.polite.gracias", dueAt: "2020-01-01T00:00:00.000Z" },
  ]);
  await page.reload();
  await expect(page.getByText("Due to remember")).toBeVisible();
  await startSession(page);
  await expect(page.getByText("SAY IT FROM MEMORY")).toBeVisible();
  await expect(page.getByText("NEW PHRASE")).toHaveCount(0);
});

test("a new phrase is heard before it is seen", async ({ page }) => {
  test.setTimeout(LONG_SESSION);
  await denyMicrophone(page);
  await page.goto("/lesson/mx71.d01");
  await startSession(page);
  await expect(page.getByText("NEW PHRASE")).toBeVisible();
  await expect(
    page.getByText("Listen — how might this sound in Spanish?"),
  ).toBeVisible();
  await expect(continueButton(page)).toBeDisabled();
  // Audio plays automatically; the text appears only once it has been heard.
  await expect(page.getByText("Hola", { exact: true })).toBeVisible({
    timeout: 30_000,
  });
  await expect(continueButton(page)).toBeEnabled();
});

test("a denied microphone never blocks or penalises the learner", async ({
  page,
}) => {
  test.setTimeout(LONG_SESSION);
  await denyMicrophone(page);
  await page.goto("/lesson/mx71.d02");
  await expect(page.getByRole("button", { name: "Start session" })).toBeVisible();
  await seedMastery(page, [
    { phraseId: "mx.greeting.hola", dueAt: "2020-01-01T00:00:00.000Z" },
  ]);
  await page.reload();
  await startSession(page);

  await page.getByRole("button", { name: "Tap to speak" }).click();
  const feedback = page.getByRole("status");
  await expect(feedback).toBeVisible();
  await expect(
    page.getByText(/does not count against your progress/i),
  ).toBeVisible();
  await expect(continueButton(page)).toBeEnabled();

  const mastery = await page.evaluate(async () => {
    const request = indexedDB.open("rumbo-2026-1");
    const db = await new Promise<IDBDatabase>((resolve) => {
      request.onsuccess = () => resolve(request.result);
    });
    const row = await new Promise<{ dueAt: string; intervalStep: number }>(
      (resolve) => {
        const get = db
          .transaction("phraseMastery", "readonly")
          .objectStore("phraseMastery")
          .get("demo-profile:mx.greeting.hola");
        get.onsuccess = () => resolve(get.result);
      },
    );
    db.close();
    return row;
  });
  expect(mastery.dueAt).toBe("2020-01-01T00:00:00.000Z");
  expect(mastery.intervalStep).toBe(1);
});

test("a scenario asks for language without listing it", async ({ page }) => {
  test.setTimeout(LONG_SESSION);
  await denyMicrophone(page);
  await page.goto("/lesson/mx71.d01");
  await startSession(page);

  for (let guard = 0; guard < 30; guard += 1) {
    if (await page.getByText("IN THE MOMENT").isVisible().catch(() => false))
      break;
    await advanceStep(page);
  }

  await expect(page.getByText("IN THE MOMENT")).toBeVisible();
  // The situation is shown; the phrases to produce are not.
  await expect(page.locator("[data-spanish-answer]")).toHaveCount(0);
  await expect(page.getByText("Hola", { exact: true })).toHaveCount(0);
});

test("completion reports memory strength, not just points", async ({ page }) => {
  test.setTimeout(LONG_SESSION);
  await denyMicrophone(page);
  await page.goto("/lesson/mx71.d01");
  await startSession(page);

  for (let guard = 0; guard < 40; guard += 1) {
    if (await page.getByText("SESSION COMPLETE").isVisible().catch(() => false))
      break;
    await advanceStep(page);
  }

  await expect(page.getByText("SESSION COMPLETE")).toBeVisible();
  await expect(page.getByText("Today’s memory progress")).toBeVisible();
  await expect(page.getByText("needs another attempt").first()).toBeVisible();
  await expect(page.getByText("+10 Travel Points")).toBeVisible();
});

test("Practice offers real work drawn from stored mastery", async ({ page }) => {
  await page.goto("/practice");
  await expect(page.getByText("Nothing due yet")).toBeVisible();
  await seedMastery(page, [
    { phraseId: "mx.greeting.hola", dueAt: "2020-01-01T00:00:00.000Z" },
    { phraseId: "mx.polite.gracias", dueAt: "2020-01-01T00:00:00.000Z" },
  ]);
  await page.reload();
  await expect(page.getByText("2 due now")).toBeVisible();
  await page.getByRole("button", { name: /Quick practice/ }).click();
  await expect(page.getByText("SAY IT FROM MEMORY")).toBeVisible();
  await expect(page.locator("[data-spanish-answer]")).toHaveCount(0);
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

test("a session keeps running through an offline interruption", async ({
  context,
  page,
}) => {
  await page.goto("/lesson/mx71.d01");
  await startSession(page);
  await context.setOffline(true);
  await expect(page.getByText("NEW PHRASE")).toBeVisible();
  await expect(continueButton(page)).toBeVisible();
  await context.setOffline(false);
});
