#!/bin/zsh
set -e

cd "$(dirname "$0")"

echo "📦 Installing dependencies..."
npm install --include=dev 2>&1

echo ""
echo "🔨 Compiling TypeScript..."
./node_modules/.bin/tsc

if [ -d out ] && [ -f out/extension.js ]; then
  echo ""
  echo "✅ Build successful!"
  echo ""
  ls -la out/
  echo ""
  echo "📁 Project: $(pwd)"
  echo ""
  echo "测试方法:"
  echo "  code $(pwd)"
  echo "  然后按 F5 启动调试"
else
  echo "❌ Build failed"
fi
