# 部署到 Vercel 的步驟

## 步驟 1: 在 GitHub 建立新倉庫

### 選項 A: 使用 GitHub CLI（如果已安裝）
```bash
gh repo create line-merge --public --source=. --remote=origin --push
```

### 選項 B: 手動建立（推薦）

1. 前往 https://github.com/new
2. Repository name: `line-merge`
3. 選擇 Public 或 Private
4. **不要**勾選 "Initialize this repository with a README"
5. 點擊 "Create repository"

然後執行：
```bash
git remote add origin https://github.com/YOUR_USERNAME/line-merge.git
git branch -M main
git push -u origin main
```

## 步驟 2: 在 Vercel 部署

1. 前往 https://vercel.com
2. 使用 GitHub 帳號登入
3. 點擊 **"Add New..."** → **"Project"**
4. 選擇你的 `line-merge` 倉庫
5. Framework Preset: **Next.js**（會自動偵測）
6. 點擊 **"Deploy"**

## 步驟 3: 等待部署完成

Vercel 會自動：
- 安裝依賴
- 執行建置
- 部署到生產環境

完成後會提供一個 URL（例如：`https://line-merge.vercel.app`）

