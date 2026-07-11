# 100 個小目標

一個溫暖、個人化的「年度目標日誌」網頁應用程式。為新的一年立下 **100 個小目標**，一格一格地完成、並為每個值得留念的時刻留下日期、心得與截圖紀錄。比 Notion 清單更好看、更有溫度。

## 功能

- **首頁**：未登入時顯示介紹與「使用 Google 登入」；登入後顯示你的所有清單（草稿／進行中）與「建立新的目標清單」。
- **建立模式（草稿）**：用預設或自訂分類整理目標，快速輸入（Enter 連續新增），湊滿 100 個即可發佈。發佈後內容永久鎖定。
- **進行中模式（擁有者）**：大型進度顯示、依分類條列目標、勾選即完成並自動開啟紀錄視窗、每個目標可有多筆紀錄（日期＋心得＋多張截圖）、一鍵複製分享連結。
- **分享頁（唯讀）**：任何人透過分享連結即可檢視進度與紀錄，無需登入、無法編輯。

## 技術

- 純靜態網站：`index.html` + CSS + 原生 JS 模組，無建置步驟、無打包工具。
- 資料庫與驗證：Supabase（PostgREST + RLS + RPC + Storage），`supabase-js v2` 由 jsDelivr CDN 以 ESM 載入。
- 雜湊路由（Hash routing），可直接部署到 GitHub Pages。

## 檔案結構

```
index.html
css/styles.css
js/
  config.js         # Supabase URL / anon key、預設分類、常數與 client
  auth.js           # Google 登入、OAuth 回跳網址清理
  api.js            # 所有資料庫／RPC／Storage 呼叫（安全邊界集中處）
  image.js          # 上傳前的用戶端圖片壓縮
  ui.js             # DOM 產生器、toast、modal、confirm、confetti
  record-modal.js   # 紀錄視窗（擁有者可編輯／分享唯讀共用）
  router.js         # 雜湊路由
  main.js           # 進入點
  views/
    home.js         # 首頁
    list.js         # 依狀態分派到 draft/live
    list-draft.js   # 建立模式
    list-live.js    # 進行中模式
    share.js        # 分享唯讀頁
```

## 本機執行

只要任何一個靜態檔案伺服器即可（不需要 npm／打包工具），從**專案根目錄**啟動：

```bash
# 若有 Python 3：
python -m http.server 4173
# 或 Node：
npx serve -l 4173
```

開啟瀏覽器前往 <http://localhost:4173/> 。

> 本機沒有可用的 Python／Node 時，也可用內附的純 PowerShell 伺服器：
> `powershell -NoProfile -ExecutionPolicy Bypass -File .claude/serve.ps1`（服務於 4173）。

> 注意：Google 登入需要在 Supabase Dashboard 將本機或部署網址加入 OAuth redirect 白名單，才能成功回跳。

## 部署到 GitHub Pages

（由協調者與使用者一起完成，此處為步驟預留位置）

1. 建立一個 GitHub repo，將本資料夾內容推上去。
2. Settings → Pages → 選擇部署來源（分支 `main`、根目錄 `/`）。
3. 取得 Pages 網址後，回到 Supabase Dashboard → Authentication → URL Configuration，將該網址加入 **Site URL** 與 **Redirect URLs**，Google 登入才能正確回跳。
4. 完成後即可用 Pages 網址存取，分享連結格式為 `https://<你的-pages-網址>/#/share/{token}`。

## 安全性

- 前端僅使用 Supabase **anon public key**，絕不含 service_role。
- 分享頁（匿名）只呼叫 `get_shared_list` RPC 並讀取公開儲存空間 URL，不直接讀任何資料表。
- 內容鎖定（發佈後不可改目標／分類）由資料庫層強制，前端即使被繞過也改不動。
