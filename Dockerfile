# 使用官方 Bun 镜像
FROM oven/bun:latest

# 设置工作目录
WORKDIR /app

# 复制依赖文件
COPY package.json bun.lock ./

# 安装生产环境依赖
RUN bun install --production

# 复制源代码
COPY . .

# 暴露应用默认端口
EXPOSE 8080

# 启动命令
CMD ["bun", "run", "src/server/index.ts"]
