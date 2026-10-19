import { test as base, expect, type Page } from '@playwright/test'

// Every test also fails on unhandled browser exceptions, including render errors.
const test = base.extend<{ browserErrors: string[] }>({
  browserErrors: [async ({ page }, use) => {
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.stack ?? error.message))
    await use(errors)
    expect(errors, 'Unexpected JavaScript errors in the browser').toEqual([])
  }, { auto: true }],
})

async function openLab(page: Page) {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: /地球的傾斜，\s*寫下四季。/ })).toBeVisible()
  await expect(page.getByText('正在準備地球…')).toBeHidden()
  await expect(page.getByTestId('globe').locator('canvas')).toBeVisible()
}

async function chooseSeason(page: Page, name: string) {
  const button = page.getByRole('button', { name: new RegExp(name) }).first()
  await button.click()
  await expect(button).toHaveAttribute('aria-pressed', 'true')
}

test('真正繪製 WebGL 地球，可拖曳、縮放並取得桌面預覽', async ({ page }, testInfo) => {
  await openLab(page)
  const canvas = page.getByTestId('globe').locator('canvas')
  const context = await canvas.evaluate((element) => {
    const canvas = element as HTMLCanvasElement
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl')
    return { supported: !!gl, width: canvas.width, height: canvas.height }
  })
  expect(context.supported).toBe(true)
  expect(context.width).toBeGreaterThan(250)
  expect(context.height).toBeGreaterThan(250)
  // Inspect the browser-composited WebGL image. A blank canvas or only stars
  // cannot supply this many bright pixels over a substantial part of the image.
  const image = await canvas.screenshot()
  const pixels = await page.evaluate(async (dataUrl) => {
    const image = new Image()
    image.src = dataUrl
    await image.decode()
    const sample = document.createElement('canvas')
    sample.width = image.width
    sample.height = image.height
    const context = sample.getContext('2d')!
    context.drawImage(image, 0, 0)
    const { data } = context.getImageData(0, 0, image.width, image.height)
    let bright = 0
    const colors = new Set<number>()
    for (let index = 0; index < data.length; index += 4) {
      if (Math.max(data[index], data[index + 1], data[index + 2]) > 80) bright++
      colors.add((data[index] >> 4) * 256 + (data[index + 1] >> 4) * 16 + (data[index + 2] >> 4))
    }
    return { brightFraction: bright / (image.width * image.height), colors: colors.size }
  }, `data:image/png;base64,${image.toString('base64')}`)
  expect(pixels.brightFraction).toBeGreaterThan(0.02)
  expect(pixels.colors).toBeGreaterThan(80)
  const bounds = await canvas.boundingBox()
  expect(bounds).not.toBeNull()
  if (bounds) {
    await page.mouse.move(bounds.x + bounds.width * 0.5, bounds.y + bounds.height * 0.5)
    await page.mouse.down()
    await page.mouse.move(bounds.x + bounds.width * 0.7, bounds.y + bounds.height * 0.45, { steps: 12 })
    await page.mouse.up()
    await page.mouse.wheel(0, -150)
  }
  await expect(page.getByTestId('day-length')).toHaveText('13 小時 33 分')
  await page.screenshot({ path: testInfo.outputPath('desktop.png'), fullPage: true })
})

test('四季赤緯、臺灣晝長與分點解釋符合獨立數值', async ({ page }) => {
  await openLab(page)
  await expect(page.getByTestId('declination')).toHaveText('+23.44°')
  await expect(page.getByTestId('day-length')).toHaveText('13 小時 33 分')
  await expect(page.getByTestId('noon-altitude')).toHaveText('88.44°')
  await chooseSeason(page, '冬至')
  await expect(page.getByTestId('declination')).toHaveText('−23.44°')
  await expect(page.getByTestId('day-length')).toHaveText('10 小時 27 分')
  await expect(page.getByTestId('noon-altitude')).toHaveText('41.56°')
  for (const name of ['春分', '秋分']) {
    await chooseSeason(page, name)
    await expect(page.getByTestId('declination')).toHaveText('0.00°')
    await expect(page.getByTestId('day-length')).toHaveText('12 小時 00 分')
    await expect(page.getByTestId('season-insight')).toContainText('晝夜各 12 小時')
  }
})

test('緯度分析、極晝極夜及兩極分點退化情況', async ({ page }) => {
  await openLab(page)
  const latitude = page.getByRole('spinbutton', { name: '緯度數值' })
  await page.getByRole('button', { name: '赤道', exact: true }).click()
  await expect(latitude).toHaveValue('0')
  await expect(page.getByTestId('day-length')).toHaveText('12 小時 00 分')
  await page.getByRole('button', { name: '北回歸線', exact: true }).click()
  await expect(latitude).toHaveValue('23.44')
  await expect(page.getByTestId('noon-altitude')).toHaveText('90.00°')
  await page.getByRole('button', { name: '北極圈', exact: true }).click()
  await expect(latitude).toHaveValue('66.56')
  await expect(page.getByTestId('day-length')).toHaveText('24 小時 00 分')
  await latitude.fill('-70')
  await expect(page.getByTestId('day-length')).toHaveText('0 小時 00 分')
  await chooseSeason(page, '冬至')
  await expect(page.getByTestId('day-length')).toHaveText('24 小時 00 分')
  await latitude.fill('90')
  await expect(page.getByTestId('day-length')).toHaveText('0 小時 00 分')
  await chooseSeason(page, '春分')
  await expect(page.getByTestId('day-length')).toHaveText('晝長未定')
  await expect(page.getByTestId('season-insight')).toContainText('太陽整日位於地平線')
  await latitude.fill('-90')
  await chooseSeason(page, '秋分')
  await expect(page.getByTestId('day-length')).toHaveText('晝長未定')
  await page.getByRole('button', { name: '臺北附近', exact: true }).click()
  await expect(latitude).toHaveValue('25')
  await expect(page.getByTestId('day-length')).toHaveText('12 小時 00 分')
})

test('四種視角、圖層及重設可操作', async ({ page }) => {
  await openLab(page)
  for (const name of ['太陽視角', '北極俯視', '南極俯視', '自由視角']) {
    const button = page.getByRole('button', { name, exact: true })
    await button.click()
    await expect(button).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByTestId('globe').locator('canvas')).toBeVisible()
  }
  for (const name of ['經緯網格', '晨昏線', '觀測緯圈', '地軸與極點']) {
    const toggle = page.getByRole('checkbox', { name, exact: true })
    await expect(toggle).toBeChecked()
    await toggle.uncheck()
    await expect(toggle).not.toBeChecked()
  }
  await chooseSeason(page, '冬至')
  await page.getByRole('spinbutton', { name: '緯度數值' }).fill('-45')
  await page.getByRole('button', { name: '重設實驗', exact: true }).click()
  await expect(page.getByTestId('declination')).toHaveText('+23.44°')
  await expect(page.getByRole('spinbutton', { name: '緯度數值' })).toHaveValue('25')
  await expect(page.getByRole('button', { name: '自由視角', exact: true })).toHaveAttribute('aria-pressed', 'true')
  for (const toggle of await page.getByRole('checkbox').all()) await expect(toggle).toBeChecked()
  await expect(page.getByTestId('solar-time')).toHaveText('12:00')
})

test('自轉播放、暫停、速度及角度對應地方太陽時', async ({ page }) => {
  await openLab(page)
  const angle = page.getByRole('slider', { name: '自轉角度', exact: true })
  await expect(page.getByTestId('solar-time')).toHaveText('12:00')
  await angle.focus()
  await angle.press('Home')
  await expect(page.getByTestId('solar-time')).toHaveText('20:00')
  await angle.press('End')
  await expect(page.getByTestId('solar-time')).toHaveText('20:00')
  await angle.press('ArrowLeft')
  await expect(page.getByTestId('solar-time')).toHaveText('19:59')
  await page.getByRole('combobox', { name: '自轉速度' }).selectOption('4')
  const before = await angle.inputValue()
  await page.getByRole('button', { name: '開始自轉', exact: true }).click()
  await expect.poll(() => angle.inputValue()).not.toBe(before)
  await page.getByRole('button', { name: '暫停自轉', exact: true }).click()
  const paused = await angle.inputValue()
  await page.waitForTimeout(250)
  await expect(angle).toHaveValue(paused)
})

test('科學說明顯示模型假設，Escape 可關閉', async ({ page }) => {
  await openLab(page)
  await page.getByRole('button', { name: '科學原理', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  await expect(dialog).toContainText('不計大氣折射')
  await expect(dialog).toContainText('23.44°')
  await expect(dialog).toContainText('晨昏線')
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
})

test('375px 手機畫面無水平溢出，地球與控制功能可使用', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await openLab(page)
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375)
  await chooseSeason(page, '冬至')
  await expect(page.getByTestId('day-length')).toHaveText('10 小時 27 分')
  await page.getByRole('button', { name: '南極俯視', exact: true }).click()
  await expect(page.getByRole('button', { name: '南極俯視', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('button', { name: '重設實驗', exact: true }).click()
  await expect(page.getByTestId('day-length')).toHaveText('13 小時 33 分')
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375)
  await page.screenshot({ path: testInfo.outputPath('mobile.png'), fullPage: true })
})
