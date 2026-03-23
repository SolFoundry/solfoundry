FROM node:20-alpine

# 安装必要的工具
RUN apk add --no-cache \
    git \
    python3 \
    make \
    g++

# 设置工作目录
WORKDIR /app

# 安装 pnpm
RUN npm install -g pnpm@8

# 复制 package 文件
COPY package.json pnpm-lock.yaml* ./

# 安装依赖
RUN pnpm install --frozen-lockfile || pnpm install

# 复制源代码
COPY . .

# 构建项目
RUN pnpm build

# 创建非 root 用户
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

USER nodejs

# 默认命令
CMD ["pnpm", "test"]
