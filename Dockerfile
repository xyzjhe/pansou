# 构建阶段
# 使用 --platform=$BUILDPLATFORM 确保构建器始终在运行 Actions 的机器的原生架构上运行 (通常是 linux/amd64)
# $BUILDPLATFORM 是 buildx 自动提供的变量
FROM --platform=$BUILDPLATFORM golang:1.23-alpine AS builder

# 安装构建依赖
RUN apk add --no-cache git ca-certificates tzdata

# 设置工作目录
WORKDIR /app

# 复制依赖文件
COPY go.mod go.sum ./

# 下载依赖
RUN go mod download

# 复制源代码
COPY . .

# 构建参数
ARG VERSION=dev
ARG BUILD_DATE=unknown
ARG VCS_REF=unknown

# 这是 buildx 自动传入的目标平台架构参数，例如 amd64, arm64
ARG TARGETARCH

# 构建应用
# Go 语言原生支持交叉编译，这里会根据传入的 TARGETARCH 编译出对应平台的可执行文件
RUN CGO_ENABLED=0 GOOS=linux GOARCH=${TARGETARCH} go build -ldflags="-s -w -extldflags '-static'" -o pansou .

# 运行阶段
# 这一阶段会根据 buildx 的 --platform 参数选择正确的基础镜像 (例如 linux/arm64 会拉取 arm64/alpine)
FROM alpine:3.19

# 添加运行时依赖
RUN apk add --no-cache ca-certificates tzdata

# 创建缓存目录
RUN mkdir -p /app/cache

# 从构建阶段复制可执行文件
# buildx 会智能地从对应平台的 builder 中复制正确的可执行文件
COPY --from=builder /app/pansou /app/pansou

# 设置工作目录
WORKDIR /app

# 暴露端口
EXPOSE 8888

# 设置环境变量
ENV CACHE_PATH=/app/cache \
    CACHE_ENABLED=true \
    TZ=Asia/Shanghai \
    ASYNC_PLUGIN_ENABLED=true \
    ASYNC_RESPONSE_TIMEOUT=4 \
    ASYNC_MAX_BACKGROUND_WORKERS=20 \
    ASYNC_MAX_BACKGROUND_TASKS=100 \
    ASYNC_CACHE_TTL_HOURS=1

# 构建参数
ARG VERSION=dev
ARG BUILD_DATE=unknown
ARG VCS_REF=unknown

# 添加镜像标签
LABEL org.opencontainers.image.title="PanSou" \
      org.opencontainers.image.description="高性能网盘资源搜索API服务" \
      org.opencontainers.image.version="${VERSION}" \
      org.opencontainers.image.created="${BUILD_DATE}" \
      org.opencontainers.image.revision="${VCS_REF}" \
      org.opencontainers.image.url="https://github.com/fish2018/pansou" \
      org.opencontainers.image.source="https://github.com/fish2018/pansou" \
      maintainer="fish2018"

# 运行应用
CMD ["/app/pansou"]
