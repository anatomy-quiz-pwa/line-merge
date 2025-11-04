# 🚀 快速部署到 Vercel

## 方法 1: 使用 Cursor 的 Source Control（最簡單）

### 步驟 1: 推送 to GitHub
1. 在 Cursor 左側點擊 **Source Control** 圖示
2. 點擊 **"Publish Branch"** 或三個點選單中的 **"Push to GitHub"**
3. 如果還沒有 GitHub 倉庫，會提示建立新倉庫
4. 輸入倉庫名稱：`line-merge`
5. 選擇 Public 或 Private
6. 點擊確定

### 步驟 2: 在 Vercel 部署
1. 前往 https://vercel.com
2. 使用 GitHub 帳號登入
3. 點擊 **"Add New..."** → **"Project"**
4. 選擇 `line-merge` 倉庫
5. Framework Preset: **Next.js**（自動偵測）
6. 點擊 **"Deploy"**

完成！🎉

---

## 方法 2: 使用命令列

### 步驟 1: 在 GitHub 建立新倉庫
前往 https://github.com/new
- Repository name: `line-merge`
- 選擇 Public
- **不要**勾選任何初始化選項
- 點擊 "Create repository"

### 步驟 2: 推送程式碼
```bash
cd /Users/baobaoc/Desktop/line-merge
git remote add origin https://github.com/YOUR_USERNAME/line-merge.git
git branch -M main
git push -u origin main
```

（將 `YOUR_USERNAME` 替換為你的 GitHub 用戶名）

### 步驟 3: 在 Vercel 部署
1. 前往 https://vercel.com
2. 使用 GitHub 帳號登入
3. 點擊 **"Add New..."** → **"Project"**
4. 選擇 `line-merge` 倉庫
5. 點擊 **"Deploy"**

---

## ⚠️ 注意事項

- Vercel 會自動偵測 Next.js 專案
- 不需要設定環境變數（目前 MVP 不需要）
- 部署完成後會提供一個 URL（例如：`https://line-merge.vercel.app`）

## 🔧 如果部署失敗

如果 PDF 解析在 Vercel 上仍有問題，可能需要：
1. 檢查 Vercel Function Logs
2. 確認 `runtime = "nodejs"` 已設定（已設定）
3. 可能需要調整 PDF 解析庫的配置

