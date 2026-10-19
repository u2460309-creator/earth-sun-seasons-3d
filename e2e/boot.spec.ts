import { test, expect } from "@playwright/test";

test("入口程式載入失敗仍有說明與原生重載連結", async ({ page }) => {
  // Cover Vite development and production entry paths without starting WebGL.
  await page.route(
    /\/(?:src\/main\.tsx|assets\/index-[^/]+\.js)(?:\?.*)?$/,
    (route) => route.abort("failed"),
  );
  await page.goto("/");

  const shell = page.getByTestId("boot-screen");
  await expect(
    shell.getByRole("heading", { name: "地球日照與四季", exact: true }),
  ).toBeVisible();
  await expect(shell).toContainText("網站程式尚未成功載入");
  const reload = shell.getByRole("link", { name: "重新載入網頁", exact: true });
  await expect(reload).toHaveAttribute("href", "");
  await reload.click();
  await expect(shell).toBeVisible();
  await expect(page.locator("canvas")).toHaveCount(0);
});

test("停用 JavaScript 時仍可讀取操作說明", async ({ browser, baseURL }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  try {
    const page = await context.newPage();
    await page.goto(baseURL ?? "http://127.0.0.1:5173/");
    await expect(
      page.getByRole("heading", { name: "地球日照與四季", exact: true }),
    ).toBeVisible();
    await expect(page.getByTestId("boot-screen")).toContainText(
      "網站程式尚未成功載入",
    );
    await expect(
      page.getByRole("link", { name: "重新載入網頁", exact: true }),
    ).toBeVisible();
    await expect(page.locator("canvas")).toHaveCount(0);
  } finally {
    await context.close();
  }
});

test("成功掛載後由互動介面取代載入說明", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /地球的傾斜，\s*寫下四季。/ }),
  ).toBeVisible();
  await expect(page.getByTestId("boot-screen")).toHaveCount(0);
});

test("3D 模組下載失敗仍可操作四季與緯度分析", async ({ page }) => {
  let blockedScene = false;
  await page.route(
    /\/(?:src\/components\/EarthScene\.tsx|assets\/EarthScene-[^/]+\.js)(?:\?.*)?$/,
    (route) => {
      blockedScene = true;
      return route.abort("failed");
    },
  );
  await page.goto("/");

  await expect(
    page.getByRole("heading", { name: /地球的傾斜，\s*寫下四季。/ }),
  ).toBeVisible();
  await expect(page.getByTestId("day-length")).toHaveText("13 小時 33 分");
  const fallback = page.locator(".scene-fallback");
  await expect(fallback).toContainText("無法載入 3D 模組");
  await expect(
    fallback.getByRole("link", { name: "重新載入頁面", exact: true }),
  ).toHaveAttribute("href", "");
  expect(blockedScene).toBe(true);
  await expect(page.locator("canvas")).toHaveCount(0);
  await expect(page.getByTestId("boot-screen")).toHaveCount(0);

  await page.getByRole("button", { name: /冬至/ }).first().click();
  await expect(page.getByTestId("day-length")).toHaveText("10 小時 27 分");
  await page.getByRole("spinbutton", { name: "緯度數值" }).fill("0");
  await expect(page.getByTestId("day-length")).toHaveText("12 小時 00 分");
});

test("不具同源與全螢幕權限的沙盒預覽可載入及關閉放大畫面", async ({
  page,
  baseURL,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.setContent(
    '<iframe title="沙盒預覽" sandbox="allow-scripts" width="1280" height="1000"></iframe>',
  );
  await page.getByTitle("沙盒預覽", { exact: true }).evaluate(
    (frame, url) => {
      frame.setAttribute("src", url);
    },
    `${baseURL ?? "http://127.0.0.1:5173"}/`,
  );

  const lab = page.frameLocator("iframe");
  await expect(
    lab.getByRole("heading", { name: /地球的傾斜，\s*寫下四季。/ }),
  ).toBeVisible();
  await expect(lab.getByTestId("day-length")).toHaveText("13 小時 33 分");
  await expect(
    lab
      .locator('[data-testid="globe"] canvas:visible, .webgl-fallback:visible')
      .first(),
  ).toBeVisible();
  await expect(lab.getByTestId("boot-screen")).toHaveCount(0);

  const body = lab.locator("body");
  const initialOverflow = await body.evaluate(
    (element) => element.style.overflow,
  );
  const expand = lab.getByRole("button", { name: "放大地球畫面", exact: true });
  await expand.click();
  const close = lab.getByRole("button", { name: "關閉放大畫面", exact: true });
  await expect(close).toBeVisible();
  await expect(lab.locator(".scene-panel.is-fullscreen")).toBeVisible();
  await expect
    .poll(() => body.evaluate((element) => element.style.overflow))
    .toBe("hidden");
  expect(
    await body.evaluate((element) => element.ownerDocument.fullscreenElement),
  ).toBeNull();
  await close.click();
  await expect(lab.locator(".is-fullscreen")).toHaveCount(0);
  await expect
    .poll(() => body.evaluate((element) => element.style.overflow))
    .toBe(initialOverflow);

  await expand.click();
  await expect(close).toBeVisible();
  await close.press("Escape");
  await expect(lab.locator(".is-fullscreen")).toHaveCount(0);
  await expect
    .poll(() => body.evaluate((element) => element.style.overflow))
    .toBe(initialOverflow);
  expect(
    await body.evaluate((element) => element.ownerDocument.fullscreenElement),
  ).toBeNull();
  expect(errors, "沙盒預覽內不應有未處理的 JavaScript 錯誤").toEqual([]);
});
