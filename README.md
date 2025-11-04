# LINE 提問 × 學員名單 整合器

一個用於自動整合 LINE 對話提問與學員名單的 Next.js 應用程式。

## 功能特色

- 📄 **自動解析 PDF 名單**：從學員名單 PDF 中提取姓名、工作職稱、工作年資
- 💬 **掃描 LINE 對話**：自動找出每位學員的第一則提問（包含 ? 或 ？）
- 🔍 **智能比對**：支援完全比對與模糊比對（相似度 ≥ 85%）
- ✏️ **可編輯表格**：在匯出前可手動編修結果
- 📊 **一鍵匯出 Excel**：將整合結果匯出為 .xlsx 格式

## 技術棧

- **Next.js 14** (App Router)
- **TypeScript**
- **Tailwind CSS**
- **Vercel** (雲端部署)

## 本地開發

```bash
# 安裝依賴
npm install

# 啟動開發伺服器
npm run dev

# 開啟瀏覽器訪問
# http://localhost:3000
```

## 部署到 Vercel

### 步驟 1：推送到 GitHub

```bash
git add .
git commit -m "Initial commit: LINE merge tool"
git push origin main
```

### 步驟 2：在 Vercel 部署

1. 前往 [vercel.com](https://vercel.com)
2. 點擊 **Add New...** → **Project**
3. 選擇你的 GitHub 倉庫
4. Framework Preset 選擇 **Next.js**
5. 點擊 **Deploy**

部署完成後即可使用！

## 使用說明

1. **上傳學員名單 PDF**：選擇包含學員資訊的 PDF 檔案，點擊「解析名單」
2. **上傳 LINE 對話 .txt**：選擇 LINE 對話匯出的文字檔，點擊「合併資料」
3. **檢視與編輯**：在結果表格中可手動編輯工作職稱、年資、提問內容
4. **匯出 Excel**：點擊「匯出 Excel」按鈕下載結果

## API 端點

- `POST /api/parse-roster` - 解析 PDF 名單
- `POST /api/merge` - 合併對話與名單
- `POST /api/export` - 匯出 Excel

## 注意事項

- PDF 解析規則：目前支援特定格式的年資標示（如「0~2年」、「學生」等）
- 提問規則：目前抓取第一則包含 `?` 或 `？` 的訊息
- 系統訊息：自動過濾「加入聊天」、「已收回訊息」等系統訊息

## 未來改進

- [ ] 支援更多 PDF 格式
- [ ] 可自訂白名單規則（排除特定訊息類型）
- [ ] 支援批次處理多個檔案
- [ ] 更精確的姓名比對演算法

## License

MIT
