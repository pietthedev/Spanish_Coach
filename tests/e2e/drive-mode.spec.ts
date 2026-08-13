import { expect, test, type Page } from "@playwright/test";

const DRIVE_TIMEOUT = 120_000;

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

/**
 * Dexie opens lazily, and opening the database ourselves before it does would
 * create an empty one with no object stores. Let the app open it instead:
 * Practice only renders its due count after a successful read.
 */
async function openedByApp(page: Page) {
  await page.goto("/practice");
  await expect(page.getByText(/Nothing due yet|Nothing due right now|due now/)).toBeVisible({
    timeout: 20_000,
  });
}

async function clearOutbox(page: Page) {
  await page.evaluate(async () => {
    const request = indexedDB.open("rumbo-2026-1");
    const db = await new Promise<IDBDatabase>((resolve) => {
      request.onsuccess = () => resolve(request.result);
    });
    await new Promise<void>((resolve) => {
      const tx = db.transaction("outbox", "readwrite");
      tx.objectStore("outbox").clear();
      tx.oncomplete = () => resolve();
    });
    db.close();
  });
}

async function seedMastery(page: Page, phraseIds: string[]) {
  await page.evaluate(async (ids) => {
    const request = indexedDB.open("rumbo-2026-1");
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction("phraseMastery", "readwrite");
      const store = tx.objectStore("phraseMastery");
      for (const phraseId of ids)
        store.put({
          id: `demo-profile:${phraseId}`,
          profileId: "demo-profile",
          phraseId,
          intervalStep: 2,
          dueAt: "2020-01-01T00:00:00.000Z",
          consecutiveSuccesses: 1,
          independentSuccesses: 1,
          assistedSuccesses: 0,
          encounters: 3,
          independentDays: ["2026-08-18"],
        });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  }, phraseIds);
}

const SPANISH = ["Hola", "Buenos días", "Gracias", "Mucho gusto"];

test("Drive Mode is reachable and offers three commute lengths", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: /Drive Mode/ }).click();
  await expect(page).toHaveURL(/\/drive$/);

  await expect(page.getByRole("button", { name: /10 min/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /15 min/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /20 min/ })).toBeVisible();
  // The daily commute is the default so the driver can just press start.
  await expect(page.getByRole("button", { name: /15 min/ })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.getByText(/Start your lesson before you begin driving/)).toBeVisible();
});

test("the active drive screen needs no reading and no small controls", async ({
  page,
}) => {
  test.setTimeout(DRIVE_TIMEOUT);
  await denyMicrophone(page);
  await openedByApp(page);
  await seedMastery(page, ["mx.greeting.hola", "mx.polite.gracias"]);
  await page.goto("/drive");

  await page.getByRole("button", { name: /10 min/ }).click();
  await page.getByRole("button", { name: "Start Drive Lesson" }).click();

  await expect(page.getByText("Eyes on the road")).toBeVisible();
  await expect(page.getByText(/remaining/)).toBeVisible();

  // Nothing the learner must produce is ever printed on screen.
  for (const spanish of SPANISH)
    await expect(page.getByText(spanish, { exact: true })).toHaveCount(0);

  // Stationary controls are large enough to hit without looking.
  for (const name of ["Pause", "End"]) {
    const control = page.getByRole("button", { name });
    await expect(control).toBeVisible();
    const box = await control.boundingBox();
    // Deliberately larger than the standard 48px target: these are pressed
    // while stationary, sometimes without looking directly at the phone.
    expect(box!.height).toBeGreaterThanOrEqual(96);
    expect(box!.width).toBeGreaterThanOrEqual(120);
  }
});

test("a drive can be paused and resumed while stationary", async ({ page }) => {
  test.setTimeout(DRIVE_TIMEOUT);
  await denyMicrophone(page);
  await page.goto("/drive");
  await page.getByRole("button", { name: "Start Drive Lesson" }).click();
  await expect(page.getByText("Eyes on the road")).toBeVisible();

  await page.getByRole("button", { name: "Pause" }).click();
  await expect(page.getByRole("button", { name: "Resume" })).toBeVisible();
  await page.getByRole("button", { name: "Resume" }).click();
  await expect(page.getByRole("button", { name: "Pause" })).toBeVisible();
});

test("a drive keeps running when the microphone is unavailable", async ({
  page,
}) => {
  test.setTimeout(DRIVE_TIMEOUT);
  await denyMicrophone(page);
  await openedByApp(page);
  await seedMastery(page, ["mx.greeting.hola", "mx.polite.gracias"]);
  await page.goto("/drive");
  await page.getByRole("button", { name: "Start Drive Lesson" }).click();

  // The session advances past activities it could not hear.
  await expect(page.locator("[data-drive-debug]")).toContainText("step 2/", {
    timeout: 60_000,
  });

  await page.getByRole("button", { name: "End" }).click();
  await expect(page.getByText("Drive complete")).toBeVisible({ timeout: 30_000 });
  await expect(
    page.getByText(/did not affect your progress/),
  ).toBeVisible();

  // Nothing that failed technically may touch the learner's mastery.
  const mastery = await page.evaluate(async () => {
    const request = indexedDB.open("rumbo-2026-1");
    const db = await new Promise<IDBDatabase>((resolve) => {
      request.onsuccess = () => resolve(request.result);
    });
    const row = await new Promise<{ dueAt: string; encounters: number }>((resolve) => {
      const get = db
        .transaction("phraseMastery", "readonly")
        .objectStore("phraseMastery")
        .get("demo-profile:mx.greeting.hola");
      get.onsuccess = () => resolve(get.result);
    });
    db.close();
    return row;
  });
  expect(mastery.dueAt).toBe("2020-01-01T00:00:00.000Z");
  expect(mastery.encounters).toBe(3);
});

test("a finished drive records one session event and a visual summary", async ({
  page,
}) => {
  test.setTimeout(DRIVE_TIMEOUT);
  await denyMicrophone(page);
  await openedByApp(page);
  await seedMastery(page, ["mx.greeting.hola"]);
  await clearOutbox(page);
  await page.goto("/drive");

  await page.getByRole("button", { name: "Start Drive Lesson" }).click();
  await expect(page.getByText("Eyes on the road")).toBeVisible();
  await page.getByRole("button", { name: "End" }).click();

  await expect(page.getByText("Drive complete")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("Phrases practised")).toBeVisible();
  await expect(page.getByText("Unaided recalls")).toBeVisible();

  const events = await page.evaluate(async () => {
    const request = indexedDB.open("rumbo-2026-1");
    const db = await new Promise<IDBDatabase>((resolve) => {
      request.onsuccess = () => resolve(request.result);
    });
    const rows = await new Promise<{ type: string }[]>((resolve) => {
      const get = db.transaction("outbox", "readonly").objectStore("outbox").getAll();
      get.onsuccess = () => resolve(get.result);
    });
    db.close();
    return rows.map((row) => row.type);
  });
  expect(events).toContain("drive_session_completed");
  expect(events.filter((type) => type === "drive_session_completed")).toHaveLength(1);
});
