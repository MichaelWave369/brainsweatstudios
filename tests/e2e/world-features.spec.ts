import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { freshSave } from "../../src/systems/progress";
import { townPack } from "../../src/worlds/townZero";
import { verifyWorldReceipt } from "../../src/worlds/receipts";
import { productionOrigin } from "./productionOrigin";
test.describe.configure({ mode: "parallel" });
async function prepare(page: Page, locale: "en" | "es" = "en") {
  const save = freshSave();
  save.selectedDifficulty = true;
  save.settings.tutorials = false;
  save.settings.muted = true;
  save.settings.reducedMotion = true;
  save.settings.locale = locale;
  await page.addInitScript((v) => {
    if (!localStorage.getItem("brain-sweat-studio:v1"))
      localStorage.setItem("brain-sweat-studio:v1", JSON.stringify(v));
  }, save);
}
const saved = (page: Page) =>
  page.evaluate(() =>
    JSON.parse(localStorage.getItem("brain-sweat-studio:v1")!),
  );
const upload = (value: unknown) => ({
  name: "world-data.json",
  mimeType: "application/json",
  buffer: Buffer.from(JSON.stringify(value)),
});
async function complete(page: Page, days = "7") {
  await page
    .getByLabel("Campaign curriculum", { exact: true })
    .selectOption(days);
  await page
    .getByLabel("World controller team", { exact: true })
    .selectOption("mock");
  await page
    .getByRole("button", { name: "Run validated preview", exact: true })
    .click();
  await page
    .getByLabel("World run tick cap", { exact: true })
    .fill(days === "30" ? "720" : "168");
  await page
    .getByRole("button", { name: "Run bounded campaign", exact: true })
    .click();
  await expect
    .poll(
      async () =>
        Boolean((await saved(page)).academy.worlds.receipt?.result.success),
      { timeout: 90000 },
    )
    .toBe(true);
}

test("worlds: 7 and 30 day mock campaigns replay and restore stopped without game rewards", async ({
  page,
}) => {
  test.setTimeout(180000);
  await prepare(page);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/#/academy?tab=worlds");
  await complete(page, "7");
  expect(
    verifyWorldReceipt((await saved(page)).academy.worlds.receipt).result.tick,
  ).toBe(168);
  await complete(page, "30");
  const r = (await saved(page)).academy.worlds.receipt;
  expect(verifyWorldReceipt(r).result.tick).toBe(720);
  expect(r.checkpoints.length).toBe(8);
  await page
    .getByRole("button", { name: "Verify long world replay", exact: true })
    .click();
  await expect(
    page.getByText(
      "Long world replay and checkpoints verified. No inference was requested.",
      { exact: true },
    ),
  ).toBeVisible();
  await page.getByLabel("World replay frame", { exact: true }).fill("96");
  await page.getByRole("button", { name: "Next event", exact: true }).click();
  const download = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Export world receipt", exact: true })
    .click();
  expect((await download).suggestedFilename()).toBe(
    "brain-sweat-world-receipt.json",
  );
  await page.reload();
  await expect(page.locator(".world-status")).toHaveText("STOPPED");
  expect((await saved(page)).xp).toBe(0);
  expect(errors).toEqual([]);
});
test("worlds: human actions, delayed operations, plans, notebooks and handoffs keep one authority", async ({
  page,
}) => {
  await prepare(page);
  await page.goto("/#/academy?tab=worlds");
  await page
    .getByLabel("Reference world", { exact: true })
    .selectOption("reserve-lesson");
  await page
    .getByLabel("World controller team", { exact: true })
    .selectOption("human");
  await page
    .getByRole("button", { name: "Run validated preview", exact: true })
    .click();
  const actions = page.getByRole("group", {
    name: "Human world actions",
    exact: true,
  });
  await actions
    .getByRole("button", { name: "Inspect store", exact: true })
    .click();
  await expect
    .poll(async () => (await saved(page)).academy.worlds.receipt.result.tick)
    .toBe(1);
  await actions
    .getByRole("button", { name: "Refill tokens", exact: true })
    .click();
  await expect
    .poll(async () => (await saved(page)).academy.worlds.receipt.result.tick)
    .toBe(2);
  await actions.getByRole("button", { name: "Wait", exact: true }).click();
  await expect
    .poll(async () => (await saved(page)).academy.worlds.receipt.result.tick)
    .toBe(3);
  await page.getByText("Declared plan and execution", { exact: true }).click();
  await page
    .getByLabel("World plan goal", { exact: true })
    .fill("Keep the reserve");
  await page
    .getByLabel("World plan steps", { exact: true })
    .fill("Inspect\nRefill\nPreserve tokens");
  await page
    .getByRole("button", { name: "Record public plan", exact: true })
    .click();
  await page
    .getByText("Role observation and public memory", { exact: true })
    .click();
  await page
    .getByRole("button", { name: "Inspect role notebook", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Apply public notebook", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Hand world role to mock", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Run bounded campaign", exact: true })
    .click();
  await expect
    .poll(async () => (await saved(page)).academy.worlds.receipt.result.success)
    .toBe(true);
  const r = verifyWorldReceipt((await saved(page)).academy.worlds.receipt);
  expect(r.handoffs[0].to.family).toBe("model");
  expect(r.artifacts.map((a) => a.kind)).toEqual(["plan", "memory"]);
  await page.reload();
  await expect(page.locator(".world-status")).toHaveText("STOPPED");
});
test("worlds: forms compile live and invalid pack and receipt imports preserve saved data", async ({
  page,
}) => {
  await prepare(page);
  await page.goto("/#/academy?tab=worlds");
  await page.getByText("Basics and simulation clock", { exact: true }).click();
  await page.getByLabel("Maximum simulation ticks", { exact: true }).fill("0");
  await expect(
    page.getByRole("button", { name: "Run validated preview", exact: true }),
  ).toBeDisabled();
  await page
    .getByLabel("Maximum simulation ticks", { exact: true })
    .fill("168");
  await page
    .getByRole("button", { name: "Run validated preview", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Step world controller", exact: true })
    .click();
  const before = (await saved(page)).academy.worlds;
  const bad = { ...townPack(), scripts: ["alert(1)"] };
  await page
    .getByLabel("Import world pack", { exact: true })
    .setInputFiles(upload(bad));
  await expect(
    page.getByText(/Expected exactly the documented fields/),
  ).toBeVisible();
  expect((await saved(page)).academy.worlds).toEqual(before);
  await page
    .getByLabel("Import world receipt", { exact: true })
    .setInputFiles(upload({ ...before.receipt, finalHash: "0".repeat(64) }));
  await expect(
    page.getByText("World receipt integrity differs.", { exact: true }),
  ).toBeVisible();
  expect((await saved(page)).academy.worlds).toEqual(before);
});
test("worlds: worker comparisons keep partitions frozen and rerun imported manifests", async ({
  page,
}) => {
  test.setTimeout(120000);
  await prepare(page);
  await page.goto("/#/academy?tab=worlds");
  await page
    .getByRole("button", {
      name: "Compare frozen world controllers",
      exact: true,
    })
    .click();
  await expect
    .poll(async () => Boolean((await saved(page)).academy.worlds.comparison), {
      timeout: 60000,
    })
    .toBe(true);
  const savedWorlds = (await saved(page)).academy.worlds;
  expect(savedWorlds.comparison.trials).toHaveLength(16);
  expect(savedWorlds.comparison.groups[0].repeatedRejections.count).toBe(2);
  expect(savedWorlds.comparison.groups[0].delayedOutages.count).toBe(2);
  expect(savedWorlds.comparison.groups[0].actionCosts.budget.count).toBe(2);
  expect(
    new Set(savedWorlds.manifest.instances.map((i: { id: string }) => i.id))
      .size,
  ).toBe(8);
  await page
    .getByLabel("Import world experiment", { exact: true })
    .setInputFiles(upload(savedWorlds.manifest));
  await expect(
    page.getByText(
      "Frozen comparison completed. No controller was tuned against holdout.",
      { exact: true },
    ),
  ).toBeVisible();
  await expect
    .poll(async () => (await saved(page)).academy.worlds.comparison.digest, {
      timeout: 60000,
    })
    .toBe(savedWorlds.comparison.digest);
  await page.getByText("Recorded behavior profile", { exact: true }).click();
  await expect(
    page.getByRole("region", {
      name: "Recorded behavior distributions",
      exact: true,
    }),
  ).toBeVisible();
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await page.getByText("Individual frozen trials", { exact: true }).click();
  await page
    .getByRole("button", { name: "Inspect frozen trial", exact: true })
    .first()
    .click();
  await expect
    .poll(async () => (await saved(page)).academy.worlds.receipt?.digest, {
      timeout: 60000,
    })
    .toBe(savedWorlds.comparison.trials[0].receiptHash);
  await expect(page.locator(".world-status")).toHaveText("STOPPED");
  expect((await saved(page)).xp).toBe(0);
});
test("worlds: Spanish, keyboard tabs, 320/390 layouts and operations remain accessible", async ({
  page,
}) => {
  await prepare(page, "es");
  await page.goto("/#/academy?tab=worlds");
  await expect(
    page.getByRole("heading", {
      name: "Laboratorio de creación de mundos",
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByRole("button", {
      name: "Ejecutar vista previa validada",
      exact: true,
    })
    .click();
  await page
    .getByRole("button", {
      name: "Avanzar el controlador del mundo",
      exact: true,
    })
    .click();
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 844 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  }
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await page
    .getByRole("tab", {
      name: "Laboratorio de creación de mundos",
      exact: true,
    })
    .focus();
  await page.keyboard.press("Home");
  await expect(
    page.getByRole("tab", {
      name: "Laboratorio de controladores",
      exact: true,
    }),
  ).toBeFocused();
  await page.keyboard.press("End");
  await expect(
    page.getByRole("tab", { name: "Garaje de agentes", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("ArrowLeft");
  await expect(
    page.getByRole("tab", {
      name: "Laboratorio de creación de mundos",
      exact: true,
    }),
  ).toBeFocused();
  await page.getByLabel("Idioma", { exact: true }).selectOption("en");
  await expect(
    page.getByRole("heading", { name: "World authoring lab", exact: true }),
  ).toBeVisible();
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
});
test("worlds: hidden and paused sessions stop advancing; origin outage replay and worker execution use no provider", async ({
  page,
  context,
  browserName,
}) => {
  test.skip(
    process.env.TEST_PRODUCTION !== "1",
    "Hard offline shell requires the production service worker.",
  );
  test.setTimeout(120000);
  const origin = await productionOrigin();
  try {
    await prepare(page);
    await page.goto(origin.url + "#/academy?tab=worlds");
    await page
      .getByRole("button", { name: "Run validated preview", exact: true })
      .click();
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.waitForFunction(() =>
      Boolean(navigator.serviceWorker.controller),
    );
    await page
      .getByRole("button", { name: "Run bounded campaign", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Pause world", exact: true })
      .click();
    await expect(page.locator(".world-status")).toHaveText("PAUSED");
    const tick = (await saved(page)).academy.worlds.receipt.result.tick;
    expect(
      await page.locator(".world-summary").getByText(/^Tick \d+$/).textContent(),
    ).toBe(`Tick ${tick}`);
    await page.waitForTimeout(200);
    expect((await saved(page)).academy.worlds.receipt.result.tick).toBe(tick);
    await page
      .getByRole("button", { name: "Run bounded campaign", exact: true })
      .click();
    await page.evaluate(() => {
      Object.defineProperty(document, "hidden", {
        value: true,
        configurable: true,
      });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await expect(page.locator(".world-status")).toHaveText("PAUSED");
    const hiddenTick = (await saved(page)).academy.worlds.receipt.result.tick;
    expect(
      await page.locator(".world-summary").getByText(/^Tick \d+$/).textContent(),
    ).toBe(`Tick ${hiddenTick}`);
    await page.waitForTimeout(200);
    expect((await saved(page)).academy.worlds.receipt.result.tick).toBe(
      hiddenTick,
    );
    await page.evaluate(() => {
      Object.defineProperty(document, "hidden", {
        value: false,
        configurable: true,
      });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    const calls: string[] = [];
    page.on("request", (r) => {
      if (r.method() === "POST" || /11435|11434/.test(r.url()))
        calls.push(r.url());
    });
    await origin.close();
    await expect(fetch(origin.url)).rejects.toThrow();
    // Playwright #42775 applies WebKit's offline flag before service workers.
    // A stopped origin exercises its real cache fallback without that emulation
    // defect. Chromium/Firefox additionally use the offline flag.
    if (browserName !== "webkit") await context.setOffline(true);
    const response = await page.reload();
    expect(response?.status()).toBe(200);
    expect(response?.fromServiceWorker()).toBe(true);
    await expect(page.locator(".world-status")).toHaveText("STOPPED");
    await page
      .getByRole("button", { name: "Verify long world replay", exact: true })
      .click();
    await page
      .getByRole("button", {
        name: "Compare frozen world controllers",
        exact: true,
      })
      .click();
    await expect
      .poll(
        async () => Boolean((await saved(page)).academy.worlds.comparison),
        {
          timeout: 60000,
        },
      )
      .toBe(true);
    expect(calls).toEqual([]);
  } finally {
    await origin.close();
  }
});
