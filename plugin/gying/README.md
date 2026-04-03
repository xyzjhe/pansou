# Gying 搜索插件

## 📖 简介

Gying 是 PanSou 的搜索插件，用于抓取 Gying 站点的影视资源。当前实现里，`https://www.gying.net` 只是默认站点地址，实际支持在管理页里配置自定义域名 / 站点地址；搜索时会聚合所有有效账户的结果。

## ✨ 核心特性

- ✅ **多用户支持** - 每个用户独立配置，互不干扰
- ✅ **自定义域名** - 支持在管理页配置站点地址，登录/搜索/详情请求都基于当前 `base_url`
- ✅ **用户名密码登录** - 支持使用用户名和密码登录
- ✅ **智能去重** - 多用户搜索时自动去重
- ✅ **负载均衡** - 任务均匀分配，避免单用户限流
- ✅ **内存缓存** - 用户数据缓存到内存，搜索性能极高
- ✅ **持久化存储** - Cookie和用户配置自动保存，重启不丢失
- ✅ **Web管理界面** - 一站式配置，简单易用
- ✅ **RESTful API** - 支持程序化调用
- ✅ **默认账户自动登录** - 插件启动时自动使用默认账户登录
- ✅ **反爬挑战处理** - 内置 `cloudscraper` 和挑战页求解逻辑，支持 403 后自动重登重试

## 🚀 快速开始

### 步骤1: 启动服务

```bash
cd /Users/macbookpro/Desktop/fish2018/pansou
go run main.go

# 或者编译后运行
go build -o pansou main.go
./pansou
```

### 步骤2: 访问管理页面

如果需要添加更多账户或管理现有账户，可以访问管理页面：

```
http://localhost:8888/gying/你的用户名
```

**示例**：
```
http://localhost:8888/gying/myusername
```

系统会自动：
1. 根据用户名生成专属64位hash（不可逆）
2. 重定向到专属管理页面：`http://localhost:8888/gying/{hash}`
3. 显示登录表单供手动登录

**📌 提示**：请收藏hash后的URL（包含你的专属hash），方便下次访问。

### 步骤3: 先配置站点地址（重要）

进入管理页后，建议先在“站点地址”区域配置你的自定义域名 / 站点地址，再进行登录。

当前代码逻辑是：

- 默认站点地址为 `https://www.gying.net`
- 登录页：`{base_url}/user/login/`
- 登录接口：`{base_url}/user/login`
- 搜索页：`{base_url}/s/1---1/{keyword}`
- 详情接口：`{base_url}/res/downurl/{type}/{id}`

也就是说，插件不是固定写死抓某一个域名，而是所有核心请求都基于当前 `base_url` 动态拼接。

**📌 提示**：

- 站点地址会保存到 `cache/gying_users/gying_config.json`
- 修改站点地址后，插件会清空当前登录状态和搜索缓存，需要重新登录
- 站点地址只允许填写纯域名，例如 `https://your-gying-domain.com`

### 步骤4: 手动登录

在"登录状态"区域输入：
- 用户名
- 密码

点击"**登录**"按钮。

### 步骤5: 开始搜索

在PanSou主页搜索框输入关键词，系统会**自动聚合所有用户**的Gying搜索结果！

```bash
# 通过API搜索
curl "http://localhost:8888/api/search?kw=遮天"

# 只搜索插件（包括gying）
curl "http://localhost:8888/api/search?kw=遮天&src=plugin"
```

## 📡 API文档

### 统一接口

所有操作通过统一的POST接口：

```
POST /gying/{hash}
Content-Type: application/json

{
  "action": "操作类型",
  ...其他参数
}
```

### API列表

| Action | 说明 | 需要登录 |
|--------|------|---------|
| `get_status` | 获取状态 | ❌ |
| `get_config` | 获取当前站点地址 | ❌ |
| `update_config` | 更新站点地址 | ❌ |
| `login` | 登录 | ❌ |
| `logout` | 退出登录 | ✅ |
| `test_search` | 测试搜索 | ✅ |

---

### 1️⃣ get_status - 获取用户状态

**请求**：
```bash
curl -X POST "http://localhost:8888/gying/{hash}" \
  -H "Content-Type: application/json" \
  -d '{"action": "get_status"}'
```

**成功响应（已登录）**：
```json
{
  "success": true,
  "message": "获取成功",
  "data": {
    "hash": "abc123...",
    "logged_in": true,
    "status": "active",
    "username": "pansou",
    "login_time": "2025-10-28 12:00:00",
    "expire_time": "2026-02-26 12:00:00",
    "expires_in_days": 121
  }
}
```

**成功响应（未登录）**：
```json
{
  "success": true,
  "message": "获取成功",
  "data": {
    "hash": "abc123...",
    "logged_in": false,
    "status": "pending"
  }
}
```

---

### 2️⃣ login - 登录

**请求**：
```bash
curl -X POST "http://localhost:8888/gying/{hash}" \
  -H "Content-Type: application/json" \
  -d '{"action": "login", "username": "xxx", "password": "xxx"}'
```

**成功响应**：
```json
{
  "success": true,
  "message": "登录成功",
  "data": {
    "status": "active",
    "username": "xxx"
  }
}
```

**失败响应**：
```json
{
  "success": false,
  "message": "登录失败: 用户名或密码错误"
}
```

---

### 3️⃣ get_config - 获取站点地址

**请求**：
```bash
curl -X POST "http://localhost:8888/gying/{hash}" \
  -H "Content-Type: application/json" \
  -d '{"action": "get_config"}'
```

**成功响应**：
```json
{
  "success": true,
  "message": "获取成功",
  "data": {
    "base_url": "https://www.gying.net"
  }
}
```

---

### 4️⃣ update_config - 更新站点地址

**请求**：
```bash
curl -X POST "http://localhost:8888/gying/{hash}" \
  -H "Content-Type: application/json" \
  -d '{"action": "update_config", "base_url": "https://your-gying-domain.com"}'
```

**成功响应**：
```json
{
  "success": true,
  "message": "站点地址已保存，当前登录状态已清空，请重新登录",
  "data": {
    "base_url": "https://your-gying-domain.com"
  }
}
```

**说明**：

- 保存前会自动做域名标准化
- 不允许带路径、查询参数或锚点
- 如果域名发生变化，所有用户当前 Cookie 会被清空并回到 `pending`

---

### 5️⃣ logout - 退出登录

**请求**：
```bash
curl -X POST "http://localhost:8888/gying/{hash}" \
  -H "Content-Type: application/json" \
  -d '{"action": "logout"}'
```

**成功响应**：
```json
{
  "success": true,
  "message": "已退出登录",
  "data": {
    "status": "pending"
  }
}
```

---

### 6️⃣ test_search - 测试搜索

**请求**：
```bash
curl -X POST "http://localhost:8888/gying/{hash}" \
  -H "Content-Type: application/json" \
  -d '{"action": "test_search", "keyword": "遮天"}'
```

**成功响应**：
```json
{
  "success": true,
  "message": "找到 5 条结果",
  "data": {
    "keyword": "遮天",
    "total_results": 5,
    "results": [
      {
        "title": "遮天：禁区",
        "links": [
          {
            "type": "quark",
            "url": "https://pan.quark.cn/s/89f7aeef9681",
            "password": ""
          }
        ]
      }
    ]
  }
}
```

---

## 🔍 当前实现补充

下面这些是当前 `gying.go` 已经实现、但原始 README 没写全的部分：

### 1. 反爬挑战处理

所有关键请求都会经过 `requestWithChallengeRetry`，如果检测到“正在确认你是不是机器人”挑战页，会进入 `solveBotChallenge` 自动求解后再重试。

### 2. 搜索链路不是单接口

当前搜索逻辑不是直接调一个公开 API，而是：

1. 访问搜索页 `/{base_url}/s/1---1/{keyword}`
2. 从 HTML 中提取 `_obj.search = {...}` 内嵌 JSON
3. 再并发请求详情接口 `/{base_url}/res/downurl/{type}/{id}`
4. 从详情里提取网盘链接和磁力链接

### 3. 403 自动重新登录

如果搜索页或详情接口返回 403，插件会尝试使用已保存的加密密码重新登录，然后用新的会话重试搜索。

### 4. 当前管理页的实际定位

管理页是“一个 hash 对应一个用户槽位”，不是统一多账号后台；但插件搜索时，仍然会把所有 `active` 用户的结果汇总后去重。

---

## 🔧 配置说明

### 站点地址配置（重要）

站点地址相关逻辑对应 `getBaseURL()`、`updateBaseURL()`、`getLoginPageURL()`、`getLoginAPIURL()` 等方法。

配置规则：

- 默认值：`https://www.gying.net`
- 支持通过管理页动态修改
- 自动补全 `https://`
- 只允许 `http://` 或 `https://`
- 不允许包含路径、参数、锚点

建议实际使用顺序：

1. 访问 `/gying/你的用户名`
2. 进入 hash 页面后先配置站点地址
3. 再登录账号
4. 最后再使用 `test_search` 或正式搜索

### 环境变量（可选）

```bash
# 缓存目录（默认 ./cache）
export CACHE_PATH="./cache"

# Hash Salt（推荐自定义，增强安全性）
export GYING_HASH_SALT="your-custom-salt-here"

# 代码中保留了该配置对应的辅助函数，但当前主流程未使用它保存用户密码
export GYING_ENCRYPTION_KEY="your-32-byte-key-here!!!!!!!!!!"
```

### 代码内配置

在 `gying.go` 中修改：

```go
const (
    MaxConcurrentUsers   = 10    // 最多使用的用户数（搜索时）
    MaxConcurrentDetails = 50    // 最大并发详情请求数
    DebugLog             = false // 调试日志开关
)
```

### 默认账户配置

在 `gying.go` 中修改默认账户：

```go
var DefaultAccounts = []struct {
    Username string
    Password string
}{
    // 可以添加更多默认账户
    // {"user2", "password2"},
}
```

**参数说明**：

| 参数 | 默认值 | 说明 | 建议 |
|------|--------|------|------|
| `MaxConcurrentUsers` | 10 | 单次搜索最多使用的用户数 | 10-20足够 |
| `MaxConcurrentDetails` | 50 | 最大并发详情请求数 | 50-100 |
| `DebugLog` | false | 是否开启调试日志 | 生产环境false |

## 📂 数据存储

### 存储位置

```
cache/gying_users/gying_config.json
cache/gying_users/{hash}.json
```

### 数据结构

**站点配置文件**：

```json
{
  "base_url": "https://your-gying-domain.com",
  "updated_at": "2026-04-03T12:00:00+08:00"
}
```

**用户文件**：

```json
{
  "hash": "abc123...",
  "username": "pansou",
  "encrypted_password": "base64-aes-gcm",
  "cookie": "BT_auth=xxx; BT_cookietime=xxx",
  "status": "active",
  "created_at": "2025-10-28T12:00:00+08:00",
  "login_at": "2025-10-28T12:00:00+08:00",
  "expire_at": "2026-02-26T12:00:00+08:00",
  "last_access_at": "2025-10-28T13:00:00+08:00"
}
```

**字段说明**：
- `hash`: 用户唯一标识（SHA256，不可逆推用户名）
- `username`: 原始用户名（存储）
- `encrypted_password`: 加密后的密码，用于 403 后自动重新登录
- `cookie`: 登录Cookie（明文存储，建议配置加密）
- `status`: 用户状态（`pending`/`active`/`expired`）
- `expire_at`: Cookie过期时间（121天）
