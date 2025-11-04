# 部署指南

## 快速部署到 Vercel

### 前置準備

1. **確保專案已提交到 Git**
   ```bash
   git status  # 確認所有檔案都已提交
   ```

2. **建立 GitHub 倉庫**（如果還沒有）
   - 前往 [GitHub](https://github.com/new)
   - 建立新倉庫，名稱建議：`line-merge`
   - **不要**初始化 README、.gitignore 或 license（專案已包含）

### 步驟 1：推送到 GitHub

```bash
# 如果還沒有設定遠端倉庫
git remote add origin https://github.com/YOUR_USERNAME/line-merge.git

# 推送到 GitHub
git branch -M main
git push -u origin main
```

### 步驟 2：在 Vercel 部署

1. **前往 Vercel**
   - 打開 [vercel.com](https://vercel.com)
   - 使用 GitHub 帳號登入

2. **導入專案**
   - 點擊 **Add New...** → **Project**
   - 選擇你的 `line-merge` 倉庫
   - 點擊 **Import**

3. **設定專案**
   - Framework Preset：選擇 **Next.js**（應該會自動偵測）
   - Root Directory：`./`（預設即可）
   - Build Command：`npm run build`（預設）
   - Output Directory：`.next`（預設）
   - Install Command：`npm install`（預設）

4. **環境變數**
   - 目前 MVP 版本不需要設定環境變數
   - 直接點擊 **Deploy**

5. **等待部署完成**
   - Vercel 會自動建置並部署
   - 完成後會提供一個 URL（例如：`https://line-merge.vercel.app`）

### 步驟 3：測試部署

1. 訪問部署的 URL
2. 上傳測試檔案：
   - 學員名單 PDF
   - LINE 對話 .txt
3. 確認功能正常運作

## 本地開發

```bash
# 安裝依賴
npm install

# 啟動開發伺服器
npm run dev

# 訪問 http://localhost:3000
```

## 建置檢查

在部署前，建議先在本機執行建置測試：

```bash
npm run build
```

如果建置成功，表示可以正常部署。

## 故障排除

### 建置失敗

如果 Vercel 建置失敗：

1. **檢查建置日誌**
   - 在 Vercel Dashboard 查看建置錯誤

2. **常見問題**
   - PDF 解析問題：確認 `pdf-parse` 版本相容
   - 類型錯誤：確認所有 TypeScript 類型定義完整

3. **本地測試**
   ```bash
   npm run build
   ```

### 運行時錯誤

如果部署後出現錯誤：

1. **檢查 Vercel Function Logs**
   - Dashboard → Functions → 查看錯誤日誌

2. **確認 Runtime**
   - API routes 使用 `runtime = "nodejs"`（已設定）

3. **檔案大小限制**
   - Vercel 有 50MB 的檔案大小限制
   - 如果 PDF/TXT 檔案太大，可能需要優化

## 後續優化

- [ ] 加入錯誤處理與使用者提示
- [ ] 支援更大的檔案（考慮使用 Vercel Blob Storage）
- [ ] 加入進度顯示
- [ ] 優化 PDF 解析演算法

