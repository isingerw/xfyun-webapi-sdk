#!/bin/bash

# 科大讯飞语音SDK发布脚本

set -e

# 切换到项目根目录
cd "$(dirname "$0")/.."

echo "开始发布 xfyun-webapi-sdk..."
echo "当前工作目录: $(pwd)"

# 检查是否在正确的分支
CURRENT_BRANCH=$(git branch --show-current)
#if [ "$CURRENT_BRANCH" != "main" ] && [ "$CURRENT_BRANCH" != "master" ]&& [ "$CURRENT_BRANCH" != "develop" ]; then
#    echo "请在 main 或 master 分支上发布"
#    exit 1
#fi

# 检查工作区是否干净
#if [ -n "$(git status --porcelain)" ]; then
#    echo "工作区不干净，请先提交所有更改"
#    exit 1
#fi

# 检查是否已登录npm
if ! npm whoami > /dev/null 2>&1; then
    echo "请先登录npm: npm login"
    exit 1
fi

# 运行测试
echo "运行测试..."
npm test

# 构建项目
echo "构建项目..."
npm run build

# 等待一下确保构建完成
sleep 2

# 检查构建结果
echo "检查构建结果..."
if [ ! -d "dist" ]; then
    echo "构建失败，dist目录不存在"
    echo "当前目录内容："
    ls -la
    exit 1
fi

echo "构建成功，dist目录存在"
echo "dist目录内容："
ls -la dist/

# 检查版本号
CURRENT_VERSION=$(node -p "require('./package.json').version")
echo "当前版本: $CURRENT_VERSION"

# 询问是否继续
read -p "是否继续发布版本 $CURRENT_VERSION? (Y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "发布已取消"
    exit 1
fi

# 发布到npm
echo "发布到npm..."
npm publish

# 创建git标签
echo "创建git标签..."
git tag "v$CURRENT_VERSION"
git push origin "v$CURRENT_VERSION"

echo "发布完成！"
echo "版本: $CURRENT_VERSION"
echo "npm: https://www.npmjs.com/package/xfyun-webapi-sdk"
echo "文档: https://github.com/isingerw/xfyun-webapi-sdk#readme"
