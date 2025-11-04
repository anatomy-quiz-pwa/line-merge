#!/bin/bash

# 推送到 GitHub 的腳本

echo "🚀 LINE Merge 專案 - 推送到 GitHub"
echo ""

# 檢查是否已有遠端倉庫
if git remote get-url origin &>/dev/null; then
    echo "✓ 已設定遠端倉庫: $(git remote get-url origin)"
    echo ""
    echo "正在推送到 GitHub..."
    git push -u origin main
else
    echo "⚠️  尚未設定遠端倉庫"
    echo ""
    echo "請先到 GitHub 建立新倉庫："
    echo "1. 前往 https://github.com/new"
    echo "2. Repository name: line-merge"
    echo "3. 選擇 Public"
    echo "4. 不要勾選任何初始化選項"
    echo "5. 點擊 'Create repository'"
    echo ""
    echo "建立完成後，請告訴我你的 GitHub 用戶名，我會幫你設定並推送。"
    echo ""
    echo "或者手動執行："
    echo "  git remote add origin https://github.com/YOUR_USERNAME/line-merge.git"
    echo "  git push -u origin main"
fi

