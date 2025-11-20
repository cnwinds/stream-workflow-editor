#!/bin/bash
# 发布脚本
# 使用方法: 编辑 VERSION 变量后运行 ./release.sh

set -e  # 遇到错误立即退出

# ========================================
# 配置: 修改这里的版本号
# ========================================
VERSION="0.2.3"
# ========================================

echo "========================================"
echo "准备发布 stream-workflow-editor v${VERSION}"
echo "========================================"

# 1. 确认当前分支
echo ""
echo "步骤 1: 检查当前分支..."
BRANCH=$(git branch --show-current)
echo "当前分支: $BRANCH"
if [ "$BRANCH" != "main" ]; then
    echo "警告: 不在 main 分支上！"
    read -p "是否继续？(y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# 2. 检查是否有未提交的更改
echo ""
echo "步骤 2: 检查工作目录..."
if [ -n "$(git status --porcelain)" ]; then
    echo "发现未提交的更改："
    git status --short
    echo ""
    read -p "是否提交这些更改？(y/N) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        git add .
        echo "请输入提交信息："
        read COMMIT_MSG
        git commit -m "$COMMIT_MSG"
    else
        echo "请先处理未提交的更改"
        exit 1
    fi
fi

# 3. 推送到远程
echo ""
echo "步骤 3: 推送到远程仓库..."
git push origin $BRANCH

# 4. 创建标签
echo ""
echo "步骤 4: 创建版本标签..."
if git rev-parse "v${VERSION}" >/dev/null 2>&1; then
    echo "标签 v${VERSION} 已存在"
    read -p "是否删除并重新创建？(y/N) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        git tag -d "v${VERSION}"
        git push origin ":refs/tags/v${VERSION}"
    else
        echo "跳过标签创建"
        exit 0
    fi
fi

git tag -a "v${VERSION}" -m "Release v${VERSION}"
echo "标签创建成功: v${VERSION}"

# 5. 推送标签
echo ""
echo "步骤 5: 推送标签到远程..."
git push origin "v${VERSION}"

echo ""
echo "========================================"
echo "发布完成！"
echo "========================================"
echo ""
echo "下一步："
echo "1. 访问 GitHub 创建 Release"
echo "   https://github.com/cnwinds/stream-workflow-editor/releases/new?tag=v${VERSION}"
echo ""
echo "2. 用户可以通过以下方式安装："
echo "   pip install git+https://github.com/cnwinds/stream-workflow-editor.git@v${VERSION}"
echo ""

