# 地球日照與四季

以高中地球科學為對象的繁體中文 3D 互動教學網站。使用 Vite、React、TypeScript、Three.js 與 React Three Fiber，讓地球幾何日照、晨昏線、季節與緯度分析共用同一套天文計算。

**正式網站：[地球日照與四季](https://u2460309-creator.github.io/earth-sun-seasons-3d/)**

網站的 GitHub Pages 發布流程與首次設定見 [部署說明](docs/DEPLOYMENT.md)。

## 啟動與預覽

需要 **Node.js 22.12.0 以上**；本環境使用 Node.js **24.19.0**。3D 畫面需要支援 **WebGL 2** 且啟用硬體加速的現代瀏覽器。專案不需要 API 金鑰、資料庫或外部服務；地球貼圖隨專案提供。

```bash
npm ci
npm run dev
```

開發伺服器使用連接埠 **5173**、綁定 `0.0.0.0`；本機可在瀏覽器開啟 Vite 輸出的位址。雲端開發預覽需視環境支援情況轉送此連接埠；一般使用者可直接開啟頁首正式網站。

建立並預覽正式版：

```bash
npm run build
npm run preview
```

正式預覽使用連接埠 **4173**；雲端需轉送此連接埠。`dist/` 是可部署至一般靜態網站空間的建置成品。

如果受限環境的預設 npm 快取無法寫入，可明確使用工作區中、儲存庫外的快取：

```bash
npm ci --cache /workspace/.cache/npm
```

## 操作方式

- **季節**：切換春分、夏至、秋分、冬至，觀察太陽直射緯度與晝夜變化。
- **四種視角**：自由視角、太陽視角、北極俯視、南極俯視；拖曳可旋轉觀察方向，滾輪或雙指可縮放。
- **地球自轉**：播放／暫停、拖動自轉角度，並選擇 `0.25×`、`1×` 或 `4×` 速度。速度用於教學示意，不是即時地球時鐘。
- **觀測緯度**：以滑桿或數值輸入設定 −90° 至 +90°，或選擇赤道、臺北附近、北回歸線、北極圈。數值正負分別表示北緯、南緯。
- **緯度分析**：讀取理論晝長、夜長、當下太陽高度角及正午太陽高度角。觀測點固定於東經 120°；顯示的地方太陽時不是臺灣民用鐘錶時間。
- **圖層**：獨立切換經緯參考線、晨昏線、觀測緯圈、地軸與極點；可重設場景、在頁面內放大地球，並閱讀內建科學說明。放大畫面可點擊「關閉放大畫面」、點擊遮罩或按 Esc 返回，不使用受內嵌權限限制的原生全螢幕。

四種視角都是同一套三維幾何的觀察位置。季節切換使用四個代表赤緯，畫面沒有繪製完整地球公轉軌道。

## 科學模型與驗證範圍

模型使用固定地軸傾角 **23.44°**、球形地球、平行太陽光、點狀太陽與幾何地平線。太陽赤緯依 `sin δ = sin ε · sin λ☉` 計算，晨昏線為球面法線與朝日向量點積等於零的大圓。未計入大氣折射、太陽視半徑、地形與軌道離心率；日期為無指定年份的近似節氣日期。

例如北緯 25° 的夏至／冬至理論晝長分別約 **13.55523／10.44477 小時**，正午太陽高度分別為 **88.44°／41.56°**。至日極圈是晨昏線與緯圈的相切邊界。兩極在分點時，太陽整日位於地平線，介面顯示「晝長未定」；核心的 12 小時回傳值只是明示的對稱慣例。

完整的座標、公式、幾何約定、測試與模型限制見 [科學模型文件](docs/SCIENCE.md)。

目前對話中未提供《地球日照與四季 v1.0｜Codex 開發規格》附件原文。因此本版依使用者訊息列出的功能實作，**尚無法逐項核對附件中的要求及指定測試案例**。

## 測試與建置

```bash
npm test                 # Vitest 科學核心測試
npm run test:watch       # 開發時持續執行單元測試
npm run build            # TypeScript 檢查與 Vite 正式建置
npx playwright install chromium
npm run test:e2e         # Playwright 瀏覽器互動測試
```

已驗證：**35 個科學核心測試全部通過**，且 **TypeScript 檢查與正式建置通過**。核心測試包括赤緯、赤道及南北半球晝長、回歸線天頂、極晝／極夜、極點分點慣例、晨昏線閉合與垂直性，以及三維照明與高度角的一致性。另已在實際 Chromium 中通過 **12／12 項 Playwright 操作測試**，包含 WebGL context 與畫布像素檢查、拖曳縮放、四季數值、緯度與兩極特例、四視角與四圖層、自轉／暫停／速度／地方太陽時、說明對話框、重設與 375px 手機版面。互動與沙盒測試均無未處理的 JavaScript 錯誤；故障測試會刻意中斷模組請求，另驗證載入說明與介面仍可用。新增的 5 案涵蓋入口下載失敗、停用 JavaScript、正常掛載、3D 模組失敗與受限 iframe 的載入及放大關閉。可用 `npm run test:e2e` 重跑；報告與截圖產生於 `playwright-report/`、`test-results/`（已排除 Git 追蹤）。

本雲端環境已使用系統 `/usr/bin/chromium` 完成瀏覽器驗證，不需額外下載。測試優先採用 `PLAYWRIGHT_CHROMIUM_EXECUTABLE` 指定的執行檔，再使用已存在的系統 Chromium，否則使用 Playwright 管理的瀏覽器。其他環境首次安裝 Chromium 需要下載瀏覽器。Linux 主機若缺少瀏覽器系統函式庫，需由具有相應權限的環境管理流程安裝 Playwright 所需依賴。若瀏覽器或圖形驅動無法提供 WebGL 2，頁面會顯示說明；這種狀況不能視為 3D 畫面已驗證。

## 專案結構

```text
earth-sun-seasons-3d/
├── public/
│   ├── favicon.svg
│   └── textures/earth-day.jpg    # 本地地球日間貼圖
├── src/
│   ├── components/EarthScene.tsx # R3F 地球、光照、晨昏線與相機
│   ├── lib/
│   │   ├── astronomy.ts          # 純 TypeScript 天文與幾何計算
│   │   └── astronomy.test.ts     # 35 個核心測試
│   ├── App.tsx                  # 繁中介面、互動狀態與分析
│   ├── main.tsx                 # React 入口
│   └── styles.css               # 響應式樣式
├── docs/SCIENCE.md               # 科學模型與驗證說明
├── e2e/                          # Playwright 瀏覽器互動測試
├── index.html
├── package.json
├── package-lock.json
├── playwright.config.ts
├── tsconfig.json
└── vite.config.ts
```

## 素材來源

`public/textures/earth-day.jpg` 取自 [Three.js 範例的 earth_atmos_2048.jpg](https://github.com/mrdoob/three.js/blob/dev/examples/textures/planets/earth_atmos_2048.jpg)，地球底圖來源署名為 **NASA Blue Marble**。Three.js 程式碼採 [MIT 授權](https://github.com/mrdoob/three.js/blob/dev/LICENSE)；圖像使用另請參照 [NASA 圖像與媒體使用準則](https://www.nasa.gov/nasa-brand-center/images-and-media/)，不以程式碼授權概括第三方素材的使用條件。

## 預覽載入與黑屏排查

正式版使用相對資源路徑，開發與正式預覽都支援 `sandbox="allow-scripts"` 這類沒有同源權限的內嵌視窗（其請求的 Origin 是 `null`）。Vite 的 CORS 設定僅接受此來源與既有 localhost 來源，沒有開放所有來源。若自行部署，網站伺服器也須依實際內嵌環境提供相應資源回應；這份 Vite 設定不會自動改變第三方靜態主機。

網頁入口包含不依賴 JavaScript 的載入說明及原生重載連結。3D 以獨立模組延後載入；即使模組下載失敗，操作介面與天文分析仍會顯示。地球停止自轉且沒有視角操作時，繪圖器按需更新，以降低預覽視窗負擔。

如果連載入說明與網站標題都看不到，表示預覽可能沒有載入這個網站文件；需確認實際預覽網址、服務連接埠及平台外框。網站程式無法關閉外層平台的預覽面板，也不會呼叫 `window.close()` 假裝成功。

## 可下載的單檔版

執行 `npm run build:standalone` 可產生 `standalone/地球日照與四季.html`（約 1.94 MB）。此檔內含程式、樣式、圖示及地球貼圖；下載到自己的電腦後，可用支援 WebGL 2 的 Chrome 或 Edge 開啟，無需啟動伺服器。產出目錄已排除 Git 追蹤。

已在來源隔離的內嵌視窗中封鎖所有 HTTP/HTTPS 請求，確認完整地球、四季數值、放大關閉、Escape 與重設仍正常，外部請求為 0，沒有未處理的 JavaScript 錯誤。此雲端 Chromium 的管理政策禁止 file://，因此未在本機實測雙擊檔案；未更動政策。工作區亦曾產生內含單一 HTML 的 ZIP，但聊天平台的檔案預覽器未提供可用下載；請直接使用頁首正式網站，或在自己的開發環境執行上述指令產生單檔版。
