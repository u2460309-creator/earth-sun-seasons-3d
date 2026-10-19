# 發布可直接開啟的網站

此專案可使用 GitHub Pages 發布為直接在瀏覽器開啟的網站，無需下載 ZIP，也不依賴工作區的檔案預覽器。`.github/workflows/deploy-pages.yml` 是部署設定；新增此檔案不代表已經發布。必須完成推送、首次 Pages 設定、GitHub Actions 執行及公開網址驗證，才能確認上線。

## 第一次發布

1. 由擁有儲存庫管理權限的人，在 GitHub 開啟 `u2460309-creator/earth-sun-seasons-3d`。
2. 進入 **Settings → Pages → Build and deployment → Source**，選擇 **GitHub Actions**。如果尚未將專案推送至 GitHub，可在推送完成後設定；若初次工作流程因此失敗，設定後重新執行即可。
3. 在確認可公開發布網站後，將專案及部署設定推送到儲存庫的 `main` 分支。工作流程會自動開始；亦可在 **Actions → Deploy website to GitHub Pages → Run workflow** 選擇 `main` 手動執行。
4. 確認 `build` 與 `deploy` 都成功。在該次執行的部署資訊，或儲存庫的 **Settings → Pages**，點選 GitHub 實際提供的網站網址。
5. 在一般瀏覽器分頁開啟網站，確認繁中介面與地球均可見，切換夏至／冬至並操作旋轉、縮放及緯度分析。首次發布與後續更新都以這個公開網址作為交付入口。

使用標準專案網址且未設定自訂網域時，預期網址是 `https://u2460309-creator.github.io/earth-sun-seasons-3d/`。這是依命名規則推算的地址，**不是已驗證上線的連結**；以部署完成後 GitHub 顯示的實際網址為準。

GitHub Pages 的可用性取決於儲存庫可見性及 GitHub 方案。若 Settings 沒有 Pages，請由儲存庫管理者確認該儲存庫是否可使用此功能。網站一旦發布，一般情況下任何知道網址的人都能瀏覽；推送程式碼與發布網站應取得儲存庫擁有者同意。

## 工作流程實際執行內容

- `main` 的推送會觸發建置及部署；手動執行也可建置，但只有 `main` 可部署。
- 使用 Ubuntu 與 Node.js 24，以 `npm ci` 依 `package-lock.json` 安裝依賴，不更新鎖檔。
- 執行 `npm test` 驗證天文數值及幾何，再執行 `npm run build` 做 TypeScript 檢查及 Vite 正式建置。任何一步失敗都不會進行後續部署。
- 只上傳 `dist/` 網站成品，透過 GitHub 官方 Pages Actions 部署；不把整個儲存庫當網站內容上傳。Actions 使用完整提交 SHA 固定版本。
- 建置工作只有讀取程式碼的權限；部署工作取得 Pages 寫入及 OIDC 權限。發布使用 GitHub Actions 自動提供的 `GITHUB_TOKEN`，不需要新增 PAT、API 金鑰或 repository secret。
- 工作流程未安裝瀏覽器或執行 Playwright；瀏覽器驗證需另外執行 `npm run test:e2e`，發布完成後仍須實際開啟網址確認。

`actions/configure-pages` 的 `enablement` 預設為 `false`，本設定保留這項行為。官方文件明示，自動首次啟用 Pages 需要 `GITHUB_TOKEN` 以外、具有額外管理權限的 token，因此首次啟用交由 Settings 的正常管理介面處理，不以新增密鑰繞過這一步。

## 網站資源路徑

`vite.config.ts` 使用 `base: "./"`，程式中的地球貼圖路徑使用 `import.meta.env.BASE_URL`。建置檔案可在 GitHub Pages 的 `/earth-sun-seasons-3d/` 子路徑載入，不需為發布修改應用程式。地球貼圖與所有執行資源隨 `dist/` 發布，網站不需要後端或外部資料服務。

部署後請開啟網站網址，不要以工作區的 HTML 或 ZIP 檔案連結取代。工作區檔案檢視器是否提供下載功能，與 GitHub Pages 的網站服務是兩件事。3D 畫面仍需要瀏覽器支援 WebGL 2。

## 常見失敗與處理

- **`Read existing GitHub Pages configuration` 失敗**：先確認 Settings → Pages 的 Source 已選 GitHub Actions，再重新執行工作流程。若設定完成後仍失敗，檢查該步驟的實際權限及錯誤訊息，不據此假設需要 PAT。
- **`build` 失敗**：查看 `npm ci`、`npm test` 或 `npm run build` 的失敗步驟。先修復安裝、科學測試或型別／建置錯誤，再發布。
- **`deploy` 等待審核**：依儲存庫的 `github-pages` environment 保護規則，由有權限的人在 GitHub 審核。
- **網站顯示 404**：先確認這次 `deploy` 已成功，且開啟的是 GitHub 實際顯示的部署網址；不要將工作區預覽網址或推算地址視為已上線。
- **網頁出現但地球不可見**：檢查 WebGL 2、硬體加速及瀏覽器控制台；地球素材應從同一網站的 `textures/earth-day.jpg` 載入。

## 官方參考

- [使用 GitHub Actions 發布 GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)
- [設定 GitHub Pages 發布來源](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)
- [`configure-pages` v6 的輸入與首次啟用權限](https://github.com/actions/configure-pages/blob/45bfe0192ca1faeb007ade9deae92b16b8254a0d/action.yml)
