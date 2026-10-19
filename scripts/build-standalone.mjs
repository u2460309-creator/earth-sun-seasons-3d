import { readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'vite'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const output = resolve(root, 'standalone')
const texture = `data:image/jpeg;base64,${(await readFile(resolve(root, 'public/textures/earth-day.jpg'))).toString('base64')}`
let embeddedTexture = false

await build({
  configFile: resolve(root, 'vite.config.ts'),
  root,
  base: './',
  plugins: [{
    name: 'standalone-earth-texture',
    enforce: 'pre',
    transform(code, id) {
      if (id.split('?')[0].endsWith('/src/App.tsx')) {
        return { code: code.replace(/href="\.\/"/g, 'href=""'), map: null }
      }
      if (!id.split('?')[0].endsWith('/src/components/EarthScene.tsx')) return
      const reference = '`${import.meta.env.BASE_URL}textures/earth-day.jpg`'
      if (!code.includes(reference)) throw new Error('找不到地球貼圖引用，不能建立離線版。')
      embeddedTexture = true
      return { code: code.replace(reference, JSON.stringify(texture)), map: null }
    },
  }],
  build: {
    outDir: output,
    emptyOutDir: true,
    cssCodeSplit: false,
    modulePreload: false,
    rolldownOptions: { output: { codeSplitting: false } },
    chunkSizeWarningLimit: 2500,
  },
})

if (!embeddedTexture) throw new Error('離線版缺少內嵌地球貼圖。')
let html = await readFile(resolve(output, 'index.html'), 'utf8')
const scripts = [...html.matchAll(/<script\b[^>]*\bsrc="([^"]+)"[^>]*><\/script>/g)]
if (scripts.length !== 1) throw new Error('離線版必須只有一個 JavaScript 程式檔。')
for (const [tag, path] of scripts) {
  const code = await readFile(resolve(output, path), 'utf8')
  html = html.replace(tag, () => `<script type="module">${code.replace(/<\/script/gi, '<\\/script')}</script>`)
}
for (const [tag, path] of [...html.matchAll(/<link\b[^>]*\brel="stylesheet"[^>]*\bhref="([^"]+)"[^>]*>/g)]) {
  const css = await readFile(resolve(output, path), 'utf8')
  html = html.replace(tag, () => `<style>${css.replace(/<\/style/gi, '<\\/style')}</style>`)
}
const icon = `data:image/svg+xml;base64,${(await readFile(resolve(root, 'public/favicon.svg'))).toString('base64')}`
html = html.replace(/href="\.\/favicon\.svg"/, () => `href="${icon}"`)
if (/<script\b[^>]*\bsrc=|<link\b[^>]*\brel="stylesheet"/i.test(html)) {
  throw new Error('離線版仍引用外部程式或樣式。')
}
await writeFile(resolve(output, 'index.html'), html)
const artifact = resolve(output, '地球日照與四季.html')
await writeFile(artifact, html)
console.log(`單檔網頁：${artifact} (${Buffer.byteLength(html)} bytes)`)
