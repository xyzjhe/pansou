**模拟登录文档 - pinglian.lol**

### 1. 文档目的
本文档提供完整、规范的模拟登录流程及技术细节，用于开发代码实现自动登录 `https://pinglian.lol`。

### 2. 登录接口信息

- **请求方式**：`POST`
- **接口地址**：`https://pinglian.lol/api/login.php`
- **Content-Type**：`multipart/form-data`
- **表单字段**：
  | 字段名      | 值          | 说明         |
  |-------------|-------------|--------------|
  | username    | pansou      | 用户名       |
  | password    | pansou      | 密码         |
  | remember    | on          | 记住登录     |

### 3. 完整登录流程（推荐步骤）

**步骤 1：获取最新 Session**  
先访问登录页面以获取最新的 `PHPSESSID`。

- **请求方式**：`GET`
- **URL**：`https://pinglian.lol/pages/login.php`
- **目的**：获取有效的 `PHPSESSID` Cookie

**步骤 2：提交登录请求**  
使用步骤 1 中获取的 `PHPSESSID` 发送登录 POST 请求。

### 4. 关键 HTTP Headers（必须保留）

```http
User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36
sec-ch-ua: "Chromium";v="146", "Not-A.Brand";v="24", "Google Chrome";v="146"
sec-ch-ua-platform: "macOS"
Origin: https://pinglian.lol
Referer: https://pinglian.lol/pages/login.php
Accept: */*
Accept-Language: zh-TW,zh;q=0.9,zh-CN;q=0.8,en;q=0.7
```

### 5. 代码实现示例

#### cURL 命令（测试用）

```bash
# 1. 先获取 Session
curl -c cookies.txt -b cookies.txt \
  -H "User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ..." \
  https://pinglian.lol/pages/login.php

Set-Cookie	PHPSESSID=gb6pfiaidsc6atp52s2motb378; expires=Fri, 15-May-2026 04:02:26 GMT; Max-Age=2592000; path=/; secure; HttpOnly; SameSite=Strict

# 2. 执行登录
curl -c cookies.txt -b cookies.txt -X POST \
  -H "User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) ..." \
  -H "Origin: https://pinglian.lol" \
  -H "Referer: https://pinglian.lol/pages/login.php" \
  -F "username=pansou" \
  -F "password=pansou" \
  -F "remember=on" \
  https://pinglian.lol/api/login.php
```
返回：
{
  "success": true,
  "message": "登录成功",
  "user": {
      "id": 11268,
      "username": "pansou",
      "email": "2011820123@qq.com",
      "vip_level": 0,
      "invite_code": "FEFADY"
  }
}
Set-Cookie	session_token=f8bcceb610f7ef8fc228c9ffbb23daa19c97baa7ef4f643eb49eb2704d719135; expires=Fri, 15-May-2026 04:03:14 GMT; Max-Age=2592000; path=/; secure; HttpOnly; SameSite=Strict


### 6. 注意事项

1. **必须先访问登录页面**获取最新 `PHPSESSID`，直接使用旧的 Session 容易失败。
2. 使用同一个 `Session` 对象（Python requests）或同一个 cookie 文件（curl）进行两次请求。
3. 服务器可能对登录频率、IP、User-Agent 有一定限制，建议模拟真实浏览器行为。
4. 登录成功后，建议检查响应中是否返回新的 Cookie 或跳转信息。
5. 如需保持长期登录，可保存返回的 Cookie（尤其是 PHPSESSID）。

测试账号 pansou 密码 pansou

---

const fs = require("fs");
const path = require("path");

const SITE_CONFIG = {
  title: "盘链",
  host: "https://pinglian.lol",
  apiPath: "/api/get_videos.php",
  typesPath: "/api/get_types.php",
  panLinksPath: "/api/search_pan_links.php",
  allVideosPath: "/all-videos.php",
  cookie: process.env.PANLIAN_COOKIE || "",
  headers: {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
    "X-Requested-With": "XMLHttpRequest",
    Accept: "application/json, text/plain, */*",
  },
  timeout: 15000,
};

const CACHE_TTL = {
  types: 6 * 60 * 60 * 1000,
  pageFilters: 6 * 60 * 60 * 1000,
  panLinks: 30 * 60 * 1000,
  detail: 2 * 60 * 60 * 1000,
};

const PAN_ORDER = ["quark", "uc", "baidu", "xunlei", "123", "tianyi", "115", "aliyun"];
const FOLDER_PREFIX = "plf_";
const CONFIG_PATH = path.join(__dirname, "panlian.config.json");
const meta = {
  key: "panlian",
  name: SITE_CONFIG.title,
  type: 4,
  api: "/video/panlian",
  loginApi: "/video/panlian/login",
  loginPage: "/video/panlian/login_page",
  configApi: "/video/panlian/config",
  searchable: 1,
  quickSearch: 1,
  filterable: 1,
};

let log = {
  info: (...args) => console.log(args.join(" ")),
  warn: (...args) => console.warn(args.join(" ")),
  error: (...args) => console.error(args.join(" ")),
};

const typesCache = {
  data: null,
  time: 0,
};

const pageFiltersCache = {
  data: null,
  time: 0,
};

const panLinksCache = new Map();
const detailCache = new Map();

function normalizeBlockedPanTypes(value) {
  const rawList = Array.isArray(value)
    ? value
    : safeString(value)
        .split(/[\n,，]/)
        .map((item) => item.trim());
  const result = [];
  const seen = new Set();
  for (const item of rawList) {
    const normalized = normalizePanTypeName(item);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(normalized);
  }
  return result;
}

function loadPersistedConfig() {
  try {
    if (!fs.existsSync(CONFIG_PATH)) return {};
    const raw = fs.readFileSync(CONFIG_PATH, "utf-8");
    return JSON.parse(raw);
  } catch (error) {
    return {};
  }
}

const persistedConfig = loadPersistedConfig();
const runtimeState = {
  cookie: safeString(persistedConfig.cookie) || SITE_CONFIG.cookie,
  blockedPanTypes: normalizeBlockedPanTypes(persistedConfig.blockedPanTypes),
};

function persistRuntimeConfig() {
  fs.writeFileSync(
    CONFIG_PATH,
    JSON.stringify(
      {
        cookie: runtimeState.cookie,
        blockedPanTypes: runtimeState.blockedPanTypes,
        updatedAt: new Date().toISOString(),
      },
      null,
      2
    ),
    "utf-8"
  );
}

function clearPersistedConfig() {
  if (fs.existsSync(CONFIG_PATH)) {
    fs.unlinkSync(CONFIG_PATH);
  }
}

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), SITE_CONFIG.timeout);
  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

const init = async (server) => {
  if (log.init) return;
  if (server?.log) {
    log.info = (...args) => server.log.info(args.join(" "));
    log.warn = (...args) => server.log.warn(args.join(" "));
    log.error = (...args) => server.log.error(args.join(" "));
  }
  log.init = true;
};

function buildHeaders(referer = `${SITE_CONFIG.host}${SITE_CONFIG.allVideosPath}`) {
  return {
    ...SITE_CONFIG.headers,
    Referer: referer,
    Origin: SITE_CONFIG.host,
    Cookie: runtimeState.cookie,
  };
}

async function requestJson(path, params = {}, referer) {
  const url = `${SITE_CONFIG.host}${path}`;
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params || {})) {
    if (value !== undefined && value !== null && String(value) !== "") {
      searchParams.set(key, String(value));
    }
  }
  const finalUrl = searchParams.toString() ? `${url}?${searchParams.toString()}` : url;
  const response = await fetchWithTimeout(finalUrl, {
    headers: buildHeaders(referer),
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  return await response.json();
}

async function requestHtml(path, referer = `${SITE_CONFIG.host}${SITE_CONFIG.allVideosPath}`) {
  const url = `${SITE_CONFIG.host}${path}`;
  const response = await fetchWithTimeout(url, {
    headers: {
      "User-Agent": SITE_CONFIG.headers["User-Agent"],
      Referer: referer,
      Origin: SITE_CONFIG.host,
      Cookie: runtimeState.cookie,
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    },
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  return await response.text();
}

function safeString(value) {
  if (value === undefined || value === null) return "";
  return String(value).trim();
}

function fixImg(url) {
  const img = safeString(url);
  if (!img) return "";
  if (img.startsWith("http://") || img.startsWith("https://")) return img;
  if (img.startsWith("//")) return `https:${img}`;
  if (img.startsWith("/")) return `${SITE_CONFIG.host}${img}`;
  return `${SITE_CONFIG.host}/${img}`;
}

function decodeExt(ext) {
  if (!ext) return {};
  try {
    return JSON.parse(Buffer.from(String(ext), "base64").toString("utf-8"));
  } catch (error) {
    try {
      return JSON.parse(String(ext));
    } catch (fallbackError) {
      return {};
    }
  }
}

function encodeFolder(data) {
  return `${FOLDER_PREFIX}${Buffer.from(JSON.stringify(data)).toString("base64url")}`;
}

function decodeFolder(id) {
  const value = safeString(id);
  if (!value.startsWith(FOLDER_PREFIX)) return null;
  try {
    return JSON.parse(Buffer.from(value.slice(FOLDER_PREFIX.length), "base64url").toString("utf-8"));
  } catch (error) {
    return null;
  }
}

function setDetailCache(item) {
  if (!item?.vod_id) return;
  detailCache.set(String(item.vod_id), {
    data: item,
    time: Date.now(),
  });
  if (detailCache.size > 2000) {
    const firstKey = detailCache.keys().next().value;
    if (firstKey) detailCache.delete(firstKey);
  }
}

function getDetailCache(id) {
  const cached = detailCache.get(String(id));
  if (!cached) return null;
  if (Date.now() - cached.time > CACHE_TTL.detail) {
    detailCache.delete(String(id));
    return null;
  }
  return cached.data;
}

function buildOptionGroup(key, name, values, init = "") {
  return {
    key,
    name,
    init,
    value: values,
  };
}

function createActionItem({ actionConfig, name, pic = "", remarks = "" }) {
  return {
    vod_id: JSON.stringify(actionConfig),
    vod_name: name,
    vod_pic: pic,
    vod_remarks: remarks,
    vod_tag: "action",
  };
}

function formatPanTime(value) {
  const text = safeString(value);
  if (!text || text.startsWith("0001-01-01")) return "";
  const timestamp = Date.parse(text);
  if (Number.isNaN(timestamp)) return text;
  const date = new Date(timestamp);
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${month}-${day}`;
}

function normalizePanUrl(url, password, type) {
  let value = safeString(url).replace(/#+$/, "");
  const pwd = safeString(password);
  if (!value) return "";
  if (!pwd) return value;
  if (/([?&])(pwd|password|passcode|code)=/i.test(value)) return value;
  if (["baidu", "xunlei", "123"].includes(safeString(type))) {
    value += value.includes("?") ? `&pwd=${encodeURIComponent(pwd)}` : `?pwd=${encodeURIComponent(pwd)}`;
  }
  return value;
}

function sortPanGroups(entries) {
  return entries.sort((a, b) => {
    const indexA = PAN_ORDER.indexOf(a.key);
    const indexB = PAN_ORDER.indexOf(b.key);
    const priorityA = indexA === -1 ? PAN_ORDER.length : indexA;
    const priorityB = indexB === -1 ? PAN_ORDER.length : indexB;
    if (priorityA !== priorityB) return priorityA - priorityB;
    return a.name.localeCompare(b.name, "zh-CN");
  });
}

function normalizePanTypeName(value) {
  const text = safeString(value).toLowerCase();
  if (!text) return "";
  if (text === "迅雷" || text === "迅雷云盘") return "xunlei";
  if (text === "百度" || text === "百度网盘") return "baidu";
  if (text === "夸克" || text === "夸克网盘") return "quark";
  if (text === "uc" || text === "uc网盘") return "uc";
  if (text === "123" || text === "123网盘") return "123";
  if (text === "天翼" || text === "天翼云盘") return "tianyi";
  if (text === "115" || text === "115网盘") return "115";
  if (text === "阿里" || text === "阿里云盘" || text === "aliyun") return "aliyun";
  return text;
}

function isBlockedPanType(key, name) {
  const normalizedKey = normalizePanTypeName(key);
  const normalizedName = normalizePanTypeName(name);
  return runtimeState.blockedPanTypes.some((item) => {
    return item && (item === normalizedKey || item === normalizedName);
  });
}

function filterVisiblePanGroups(groups) {
  return Object.values(groups || {}).filter(
    (group) => !isBlockedPanType(group?.key, group?.name)
  );
}

function parseCookiePair(setCookie) {
  const firstPart = safeString(setCookie).split(";")[0];
  const eqIndex = firstPart.indexOf("=");
  if (eqIndex <= 0) return null;
  return {
    name: firstPart.slice(0, eqIndex).trim(),
    value: firstPart.slice(eqIndex + 1).trim(),
  };
}

function mergeCookieString(existingCookie, nextCookies) {
  const cookieMap = new Map();
  for (const pair of safeString(existingCookie).split(";")) {
    const trimmed = pair.trim();
    if (!trimmed) continue;
    const eqIndex = trimmed.indexOf("=");
    if (eqIndex <= 0) continue;
    cookieMap.set(trimmed.slice(0, eqIndex).trim(), trimmed.slice(eqIndex + 1).trim());
  }
  for (const item of nextCookies) {
    if (!item?.name) continue;
    cookieMap.set(item.name, item.value);
  }
  return Array.from(cookieMap.entries())
    .map(([name, value]) => `${name}=${value}`)
    .join("; ");
}

async function performPanlianLogin(username, password, remember = true) {
  const body = new URLSearchParams();
  body.set("username", safeString(username));
  body.set("password", safeString(password));
  if (remember) body.set("remember", "on");

  const response = await fetchWithTimeout(`${SITE_CONFIG.host}/api/login.php`, {
      method: "POST",
      headers: {
        "User-Agent": SITE_CONFIG.headers["User-Agent"],
        Referer: `${SITE_CONFIG.host}/pages/login.php`,
        Origin: SITE_CONFIG.host,
        "X-Requested-With": "XMLHttpRequest",
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      },
      body: body.toString(),
    });
  const data = await response.json();
  if (!response.ok || !data?.success) {
    throw new Error(data?.message || `HTTP ${response.status}`);
  }

  const setCookies =
    typeof response.headers.getSetCookie === "function"
      ? response.headers.getSetCookie()
      : [response.headers.get("set-cookie")].filter(Boolean);
  const parsedCookies = setCookies.map(parseCookiePair).filter(Boolean);
  updateRuntimeConfig({
    cookie: mergeCookieString(runtimeState.cookie, parsedCookies),
  });

  return {
    success: true,
    message: data?.message || "登录成功",
    saved: true,
    blockedPanTypes: runtimeState.blockedPanTypes,
    user: data?.user || {},
  };
}

function buildLoginPageHtml() {
  const blockedValue = runtimeState.blockedPanTypes.join("\n");
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>盘链登录</title>
</head>
<body>
  <h2>盘链登录</h2>
  <p>这里用来更新盘链的登录状态。</p>
  <p>登录成功后会自动保存，服务重启后也还能继续用。</p>
  <form id="loginForm">
    <div>
      <label>账号</label>
      <input name="username" value="" autocomplete="username">
    </div>
    <div>
      <label>密码</label>
      <input name="password" type="password" autocomplete="current-password">
    </div>
    <div>
      <label>
        <input name="remember" type="checkbox" checked>
        保持登录
      </label>
    </div>
    <button type="submit">登录并保存</button>
  </form>
  <hr>
  <h3>屏蔽网盘类型</h3>
  <p>一行一个，也可以用逗号分隔。支持写法例如：123、迅雷、百度、夸克、uc、天翼。</p>
  <form id="configForm">
    <div>
      <label>屏蔽列表</label>
      <textarea id="blockedPanTypes" name="blockedPanTypes" rows="8">${blockedValue}</textarea>
    </div>
    <button type="submit">保存设置</button>
  </form>
  <pre id="result"></pre>
  <script>
    const form = document.getElementById('loginForm');
    const configForm = document.getElementById('configForm');
    const result = document.getElementById('result');
    const urlToken = new URLSearchParams(window.location.search).get('token') || '';
    const buildApiUrl = (base) => {
      let apiUrl = base;
      if (urlToken) {
        apiUrl += '?token=' + encodeURIComponent(urlToken);
      }
      return apiUrl;
    };
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      result.textContent = '登录中...';
      const formData = new FormData(form);
      const payload = {
        username: formData.get('username') || '',
        password: formData.get('password') || '',
        remember: formData.get('remember') === 'on',
        token: urlToken
      };
      try {
        const response = await fetch(buildApiUrl('${meta.loginApi}'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const data = await response.json();
        result.textContent = JSON.stringify({
          success: data.success,
          message: data.message,
          saved: data.saved,
          user: data.user ? {
            id: data.user.id,
            username: data.user.username,
            vip_level: data.user.vip_level
          } : undefined
        }, null, 2);
      } catch (error) {
        result.textContent = String(error);
      }
    });

    configForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      result.textContent = '保存中...';
      const payload = {
        blockedPanTypes: document.getElementById('blockedPanTypes').value || ''
      };
      try {
        const response = await fetch(buildApiUrl('${meta.configApi}'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const data = await response.json();
        result.textContent = JSON.stringify({
          success: data.success,
          message: data.message,
          blockedPanTypes: data.blockedPanTypes
        }, null, 2);
      } catch (error) {
        result.textContent = String(error);
      }
    });
  </script>
</body>
</html>`;
}

function updateRuntimeConfig(patch = {}) {
  if (Object.prototype.hasOwnProperty.call(patch, "cookie")) {
    runtimeState.cookie = safeString(patch.cookie);
  }
  if (Object.prototype.hasOwnProperty.call(patch, "blockedPanTypes")) {
    runtimeState.blockedPanTypes = normalizeBlockedPanTypes(patch.blockedPanTypes);
  }
  persistRuntimeConfig();
}

function sortPanLinks(links) {
  return [...links].sort((a, b) => {
    const timeA = Date.parse(a.time || "") || 0;
    const timeB = Date.parse(b.time || "") || 0;
    return timeB - timeA;
  });
}

function createFolderItem({ id, name, pic, remarks }) {
  return {
    vod_id: id,
    vod_name: name,
    vod_pic: pic || "",
    vod_remarks: remarks || "",
    vod_tag: "folder",
  };
}

function createEntryItem({ id, name, pic, remarks }) {
  return {
    vod_id: id,
    vod_name: name,
    vod_pic: pic || "",
    vod_remarks: remarks || "",
  };
}

function buildDirectDetailFromItem(item) {
  return normalizeDetail(item);
}

function getItemByVodId(vodId) {
  return getDetailCache(vodId);
}

async function fetchPanLinks(keyword, vodId) {
  const cacheKey = `${vodId}`;
  const cached = panLinksCache.get(cacheKey);
  if (cached && Date.now() - cached.time < CACHE_TTL.panLinks) {
    return cached.data;
  }

  const data = await requestJson(
    SITE_CONFIG.panLinksPath,
    {
      keyword: safeString(keyword),
      vod_id: safeString(vodId),
      _t: Date.now(),
    },
    `${SITE_CONFIG.host}${SITE_CONFIG.allVideosPath}`
  );

  if (!data?.success || !data?.data || typeof data.data !== "object") {
    throw new Error(data?.msg || "盘链接口返回异常");
  }

  const normalized = {};
  for (const [groupKey, groupValue] of Object.entries(data.data)) {
    const links = Array.isArray(groupValue?.links) ? groupValue.links : [];
    const deduped = [];
    const seen = new Set();
    for (const link of links) {
      const url = normalizePanUrl(link?.url, link?.password, link?.type || groupKey);
      if (!url) continue;
      const dedupeKey = `${url}@@${safeString(link?.password)}`;
      if (seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);
      deduped.push({
        title: safeString(link?.title) || `${safeString(groupValue?.name) || groupKey}资源`,
        url,
        password: safeString(link?.password),
        type: safeString(link?.type) || groupKey,
        time: safeString(link?.time),
        source: safeString(link?.source),
      });
    }
    if (deduped.length === 0) continue;
    normalized[groupKey] = {
      key: groupKey,
      name: safeString(groupValue?.name) || groupKey,
      icon: safeString(groupValue?.icon),
      links: sortPanLinks(deduped),
    };
  }

  panLinksCache.set(cacheKey, {
    data: normalized,
    time: Date.now(),
  });

  return normalized;
}

function findMatchedDrive(url, drives, preferredType = "") {
  const preferred = drives.find(
    (drive) =>
      safeString(drive?.key) === safeString(preferredType) &&
      typeof drive?.matchShare === "function" &&
      drive.matchShare(url)
  );
  if (preferred) return preferred;
  return drives.find((drive) => {
    try {
      return typeof drive?.matchShare === "function" && drive.matchShare(url);
    } catch (error) {
      return false;
    }
  });
}

function buildPanSummary(groups) {
  const parts = sortPanGroups(
    filterVisiblePanGroups(groups).map((item) => ({
      key: item.key,
      name: item.name,
      count: item.links.length,
    }))
  ).map((item) => `${item.name}${item.count}条`);
  return parts.join(" / ");
}

async function buildSinglePanDetail(item, link, drives) {
  const baseDetail = normalizeDetail(item);
  const targetUrl = normalizePanUrl(link.url, link.password, link.type);
  const drive = findMatchedDrive(targetUrl, drives, link.type);

  let content = baseDetail.vod_content || "";
  const extraContent = [];
  if (safeString(link.password)) extraContent.push(`提取码: ${safeString(link.password)}`);
  if (safeString(link.source)) extraContent.push(`来源: ${safeString(link.source)}`);
  if (safeString(link.time) && !safeString(link.time).startsWith("0001-01-01")) {
    extraContent.push(`时间: ${safeString(link.time)}`);
  }
  if (extraContent.length > 0) {
    content = [content, extraContent.join(" | ")].filter(Boolean).join("\n");
  }

  if (drive && typeof drive.getVod === "function") {
    try {
      const panVod = await drive.getVod(targetUrl);
      if (panVod?.vod_play_url) {
        const rawUrlGroups = String(panVod.vod_play_url).split("$$$");
        const lineNames = rawUrlGroups.map((_, index) =>
          index === 0 ? safeString(drive.key) : `${safeString(drive.key)}#${index + 1}`
        );
        return {
          ...baseDetail,
          vod_pic: baseDetail.vod_pic || safeString(panVod.vod_pic),
          vod_actor: baseDetail.vod_actor || safeString(panVod.vod_actor),
          vod_director: baseDetail.vod_director || safeString(panVod.vod_director),
          vod_content: content || safeString(panVod.vod_content),
          vod_play_from: lineNames.join("$$$"),
          vod_play_url: rawUrlGroups.join("$$$"),
        };
      }
    } catch (error) {
      log.warn(`[盘链] 网盘解析失败 ${targetUrl}: ${error.message}`);
    }
  }

  return {
    ...baseDetail,
    vod_content: content,
    vod_play_from: `${safeString(link.type) || "pan"}原始链接`,
    vod_play_url: `${safeString(link.title) || "分享链接"}$link://auto/${encodeURIComponent(targetUrl)}`,
  };
}

async function buildPanRootFolders(item) {
  const groups = await fetchPanLinks(item.vod_name, item.vod_id);
  const entries = sortPanGroups(filterVisiblePanGroups(groups));
  if (entries.length === 0) {
    return {
      ...normalizeDetail(item),
      vod_play_from: "提示",
      vod_play_url: `未找到网盘链接$${SITE_CONFIG.host}${SITE_CONFIG.allVideosPath}`,
    };
  }

  return entries.map((group) =>
    createFolderItem({
      id: encodeFolder({
        kind: "panType",
        vodId: safeString(item.vod_id),
        type: safeString(group.key),
      }),
      name: `${group.icon || ""}${group.name}`.trim(),
      pic: fixImg(item.vod_pic),
      remarks: `${group.links.length}条链接`,
    })
  );
}

async function buildPanLinkFolders(item, type) {
  const groups = await fetchPanLinks(item.vod_name, item.vod_id);
  const group = groups[safeString(type)];
  if (
    !group ||
    isBlockedPanType(group.key, group.name) ||
    !Array.isArray(group.links) ||
    group.links.length === 0
  ) {
    return {
      ...normalizeDetail(item),
      vod_play_from: "提示",
      vod_play_url: `该网盘类型暂无可用链接$${SITE_CONFIG.host}${SITE_CONFIG.allVideosPath}`,
    };
  }

  return group.links.map((link, index) =>
    createEntryItem({
      id: encodeFolder({
        kind: "panLink",
        vodId: safeString(item.vod_id),
        type: safeString(group.key),
        index,
      }),
      name: safeString(link.title) || `${group.name}链接${index + 1}`,
      pic: fixImg(item.vod_pic),
      remarks: [
        safeString(link.password) ? `提取码 ${safeString(link.password)}` : "",
        formatPanTime(link.time),
        safeString(link.source),
      ]
        .filter(Boolean)
        .join(" · "),
    })
  );
}

function extractFilterOptions(html, listId, key, name) {
  const blockMatch = html.match(
    new RegExp(`<div class="filter-list" id="${listId}">([\\s\\S]*?)<\\/div>`, "i")
  );
  if (!blockMatch) return null;

  const options = [];
  const optionRegex =
    /<span class="filter-item(?: active)?" data-value="([^"]*)">([\s\S]*?)<\/span>/gi;
  let match;
  while ((match = optionRegex.exec(blockMatch[1])) !== null) {
    const value = safeString(match[1]);
    const label = safeString(match[2].replace(/<[^>]+>/g, ""));
    options.push({
      n: label || "全部",
      v: value,
    });
  }

  if (options.length === 0) return null;
  return buildOptionGroup(key, name, options);
}

async function fetchPageFilters() {
  if (pageFiltersCache.data && Date.now() - pageFiltersCache.time < CACHE_TTL.pageFilters) {
    return pageFiltersCache.data;
  }

  try {
    const html = await requestHtml(SITE_CONFIG.allVideosPath);
    const filters = {
      year: extractFilterOptions(html, "yearFilterList", "year", "年代"),
      area: extractFilterOptions(html, "areaFilterList", "area", "地区"),
      lang: extractFilterOptions(html, "langFilterList", "lang", "语言"),
    };
    pageFiltersCache.data = filters;
    pageFiltersCache.time = Date.now();
    return filters;
  } catch (error) {
    if (pageFiltersCache.data) {
      log.warn(`[盘链] 页面筛选解析失败，继续使用缓存: ${error.message}`);
      return pageFiltersCache.data;
    }
    log.warn(`[盘链] 页面筛选解析失败: ${error.message}`);
    return {
      year: null,
      area: null,
      lang: null,
    };
  }
}

async function fetchTypes() {
  if (typesCache.data && Date.now() - typesCache.time < CACHE_TTL.types) {
    return typesCache.data;
  }

  try {
    const data = await requestJson(SITE_CONFIG.typesPath, {}, `${SITE_CONFIG.host}${SITE_CONFIG.allVideosPath}`);
    if (data?.success && Array.isArray(data.data) && data.data.length > 0) {
      typesCache.data = data.data;
      typesCache.time = Date.now();
      return data.data;
    }
    log.warn("[盘链] 分类接口返回为空");
  } catch (error) {
    if (typesCache.data) {
      log.warn(`[盘链] 分类接口获取失败，继续使用缓存: ${error.message}`);
      return typesCache.data;
    }
    log.warn(`[盘链] 分类接口获取失败: ${error.message}`);
  }

  return [];
}

function appendFilter(groups, group) {
  if (group?.value?.length) groups.push(group);
}

async function buildClassAndFilters(types) {
  const classList = [
    { type_id: "settings", type_name: "设置" },
    { type_id: "0", type_name: "全部" },
  ];
  const filters = {};
  const pageFilters = await fetchPageFilters();

  filters["0"] = [];
  appendFilter(filters["0"], pageFilters.year);
  appendFilter(filters["0"], pageFilters.area);
  appendFilter(filters["0"], pageFilters.lang);

  const resolvedTypes = Array.isArray(types) ? types : [];

  for (const parent of resolvedTypes) {
    const parentId = safeString(parent.type_id);
    const children = Array.isArray(parent.children) ? parent.children : [];
    const typeValues = [{ n: "全部", v: parentId }].concat(
      children.map((item) => ({
        n: safeString(item.type_name),
        v: safeString(item.type_id),
      }))
    );

    classList.push({
      type_id: parentId,
      type_name: safeString(parent.type_name),
    });

    filters[parentId] = [];
    appendFilter(filters[parentId], buildOptionGroup("typeId", "类型", typeValues, parentId));
    appendFilter(filters[parentId], pageFilters.year);
    appendFilter(filters[parentId], pageFilters.area);
    appendFilter(filters[parentId], pageFilters.lang);

    for (const child of children) {
      const childId = safeString(child.type_id);
      filters[childId] = [];
      appendFilter(filters[childId], buildOptionGroup("typeId", "类型", typeValues, childId));
      appendFilter(filters[childId], pageFilters.year);
      appendFilter(filters[childId], pageFilters.area);
      appendFilter(filters[childId], pageFilters.lang);
    }
  }

  return { class: classList, filters };
}

function buildSettingsActions() {
  return [
    createActionItem({
      name: "登录",
      remarks: runtimeState.cookie ? "已保存登录状态" : "未登录",
      actionConfig: {
        actionId: "panlian_login",
        type: "multiInput",
        title: "盘链登录",
        width: 640,
        msg: "登录成功后会自动保存。",
        input: [
          {
            id: "username",
            name: "账号",
            tip: "请输入账号",
            value: "",
          },
          {
            id: "password",
            name: "密码",
            tip: "请输入密码",
            value: "",
            inputType: 129,
          },
          {
            id: "remember",
            name: "保持登录",
            tip: "填 1 表示开启，填 0 表示关闭",
            value: "1",
          },
        ],
      },
    }),
    createActionItem({
      name: "屏蔽",
      remarks:
        runtimeState.blockedPanTypes.length > 0
          ? runtimeState.blockedPanTypes.join(", ")
          : "当前未屏蔽",
      actionConfig: {
        actionId: "panlian_blocked_types",
        type: "multiInput",
        title: "屏蔽网盘类型",
        width: 640,
        msg: "一行一个，也可以用逗号分隔。",
        input: [
          {
            id: "blockedPanTypes",
            name: "屏蔽列表",
            tip: "例如：123、迅雷、百度",
            value: runtimeState.blockedPanTypes.join("\n"),
            multiLine: 6,
          },
        ],
      },
    }),
    createActionItem({
      name: "清空配置",
      remarks: "清除登录和屏蔽设置",
      actionConfig: {
        actionId: "panlian_clear_config",
        type: "msgbox",
        title: "清空配置",
        msg: "执行后会清除当前保存的登录状态和屏蔽设置。",
      },
    }),
  ];
}

function actionSuccess(message, extra = {}) {
  return {
    code: 200,
    msg: message,
    toast: message,
    action: {
      actionId: "__keep__",
    },
    ...extra,
  };
}

function actionFail(message) {
  return {
    code: 500,
    msg: message,
    toast: message,
    action: {
      actionId: "__keep__",
    },
  };
}

async function handleAction(action, value) {
  const actionId = safeString(action);
  let payload = {};
  if (value !== undefined && value !== null && String(value) !== "") {
    try {
      payload = typeof value === "string" ? JSON.parse(value) : value;
    } catch (error) {
      return actionFail("参数格式不正确");
    }
  }

  if (actionId === "panlian_login") {
    const username = safeString(payload.username);
    const password = safeString(payload.password);
    const remember = safeString(payload.remember || "1") !== "0";
    if (!username || !password) {
      return actionFail("账号和密码不能为空");
    }
    try {
      const result = await performPanlianLogin(username, password, remember);
      return actionSuccess(result.message || "登录成功");
    } catch (error) {
      return actionFail(error.message || "登录失败");
    }
  }

  if (actionId === "panlian_blocked_types") {
    updateRuntimeConfig({
      blockedPanTypes: payload.blockedPanTypes,
    });
    return actionSuccess("设置已保存", {
      blockedPanTypes: runtimeState.blockedPanTypes,
    });
  }

  if (actionId === "panlian_clear_config") {
    runtimeState.cookie = safeString(process.env.PANLIAN_COOKIE || "");
    runtimeState.blockedPanTypes = [];
    clearPersistedConfig();
    return actionSuccess("配置已清空");
  }

  return actionFail("不支持的动作");
}

async function fetchVideos({
  page = 1,
  typeId = "0",
  keyword = "",
  year = "",
  area = "",
  lang = "",
}) {
  const params = {
    pg: String(page || 1),
  };

  if (keyword) {
    params.wd = safeString(keyword);
  } else {
    params.t = safeString(typeId || "0") || "0";
  }
  if (year) params.year = safeString(year);
  if (area) params.area = safeString(area);
  if (lang) params.lang = safeString(lang);

  const data = await requestJson(
    SITE_CONFIG.apiPath,
    params,
    `${SITE_CONFIG.host}${SITE_CONFIG.allVideosPath}`
  );

  if (!data || Number(data.code) !== 1) {
    throw new Error(data?.msg || "盘链列表接口返回异常");
  }

  return {
    list: Array.isArray(data.list) ? data.list : [],
    page: Number(data.page || page || 1),
    pagecount: Number(data.pagecount || 1),
    total: Number(data.total || 0),
  };
}

function normalizeVideo(item) {
  setDetailCache(item);
  return createFolderItem({
    id: encodeFolder({
      kind: "entry",
      vodId: safeString(item.vod_id),
    }),
    name: safeString(item.vod_name),
    pic: fixImg(item.vod_pic),
    remarks: [
      safeString(item.vod_remarks),
      safeString(item.vod_year),
      safeString(item.vod_area),
      safeString(item.type_name),
    ]
      .filter(Boolean)
      .join(" / "),
  });
}

function normalizeDetail(item) {
  setDetailCache(item);
  return {
    vod_id: safeString(item.vod_id),
    vod_name: safeString(item.vod_name),
    vod_pic: fixImg(item.vod_pic),
    vod_remarks: safeString(item.vod_remarks),
    vod_score: safeString(item.vod_score),
    vod_year: safeString(item.vod_year),
    vod_area: safeString(item.vod_area),
    vod_lang: safeString(item.vod_lang),
    vod_actor: safeString(item.vod_actor),
    vod_director: safeString(item.vod_director),
    vod_content: safeString(item.vod_content)
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>/gi, "\n")
      .replace(/<[^>]+>/g, "")
      .trim(),
    type_name: safeString(item.type_name),
    vod_play_from: safeString(item.vod_play_from),
    vod_play_url: safeString(item.vod_play_url),
  };
}

async function _home() {
  const [types, latest] = await Promise.all([
    fetchTypes(),
    fetchVideos({ page: 1, typeId: "0" }).catch((error) => {
      log.warn(`[盘链] 首页列表获取失败: ${error.message}`);
      return { list: [] };
    }),
  ]);

  const result = await buildClassAndFilters(types);
  if (Array.isArray(latest.list) && latest.list.length > 0) {
    result.list = latest.list.map(normalizeVideo);
  }
  return result;
}

async function _category({ id, page, filters }) {
  if (safeString(id) === "settings") {
    const list = buildSettingsActions();
    return {
      list,
      page: 1,
      pagecount: 1,
      total: list.length,
      limit: list.length,
    };
  }

  const targetTypeId = safeString(filters?.typeId || id || "0") || "0";
  const data = await fetchVideos({
    page,
    typeId: targetTypeId,
    year: safeString(filters?.year),
    area: safeString(filters?.area),
    lang: safeString(filters?.lang),
  });

  return {
    list: data.list.map(normalizeVideo),
    page: data.page,
    pagecount: data.pagecount,
    total: data.total,
    limit: data.list.length,
  };
}

async function _search(keyword, page) {
  const data = await fetchVideos({
    page,
    typeId: "0",
    keyword,
  });
  return {
    list: data.list.map(normalizeVideo),
    page: data.page,
    pagecount: data.pagecount,
    total: data.total,
    limit: data.list.length,
  };
}

async function _detail(id, drives) {
  const folder = decodeFolder(id);
  if (folder) {
    const item = getItemByVodId(folder.vodId);
    if (!item) {
      return {
        vod_id: safeString(id),
        vod_name: `盘链资源 ${safeString(folder.vodId)}`,
        vod_remarks: "详情缓存已失效",
        vod_play_from: "提示",
        vod_play_url: `请重新从一级列表进入$${SITE_CONFIG.host}${SITE_CONFIG.allVideosPath}`,
      };
    }

    if (folder.kind === "direct") {
      return buildDirectDetailFromItem(item);
    }
    if (folder.kind === "entry") {
      let panSummary = "";
      try {
        const groups = await fetchPanLinks(item.vod_name, item.vod_id);
        panSummary = buildPanSummary(groups);
      } catch (error) {
        log.warn(`[盘链] 获取网盘摘要失败 ${item.vod_id}: ${error.message}`);
      }

      return [
        createEntryItem({
          id: encodeFolder({
            kind: "direct",
            vodId: safeString(item.vod_id),
          }),
          name: "直链播放",
          pic: fixImg(item.vod_pic),
          remarks: safeString(item.vod_remarks) || "当前站点播放线路",
        }),
        createFolderItem({
          id: encodeFolder({
            kind: "panRoot",
            vodId: safeString(item.vod_id),
          }),
          name: "网盘播放",
          pic: fixImg(item.vod_pic),
          remarks: panSummary || "按网盘类型浏览",
        }),
      ];
    }
    if (folder.kind === "panRoot") {
      return await buildPanRootFolders(item);
    }
    if (folder.kind === "panType") {
      return await buildPanLinkFolders(item, folder.type);
    }
    if (folder.kind === "panLink") {
      const groups = await fetchPanLinks(item.vod_name, item.vod_id);
      const links = groups[safeString(folder.type)]?.links || [];
      const group = groups[safeString(folder.type)];
      if (group && isBlockedPanType(group.key, group.name)) {
        return {
          ...normalizeDetail(item),
          vod_play_from: "提示",
          vod_play_url: `该网盘类型已被屏蔽$${SITE_CONFIG.host}${SITE_CONFIG.allVideosPath}`,
        };
      }
      const link = links[Number(folder.index)];
      if (!link) {
        return {
          ...normalizeDetail(item),
          vod_play_from: "提示",
          vod_play_url: `该网盘链接不存在或已失效$${SITE_CONFIG.host}${SITE_CONFIG.allVideosPath}`,
        };
      }
      return await buildSinglePanDetail(item, link, drives);
    }
  }

  const item = getItemByVodId(id);
  if (!item) {
    log.warn(`[盘链] 详情缓存未命中: ${id}`);
    return {
      vod_id: safeString(id),
      vod_name: `盘链资源 ${id}`,
      vod_remarks: "请先从分类或搜索进入",
      vod_play_from: "提示",
      vod_play_url: `请先打开分类列表再进详情$${SITE_CONFIG.host}${SITE_CONFIG.allVideosPath}`,
    };
  }
  return await _detail(encodeFolder({ kind: "entry", vodId: safeString(item.vod_id) }), drives);
}

async function _play(flag, id, drives) {
  if (safeString(id).startsWith("link://")) {
    const match = safeString(id).match(/^link:\/\/([^/]+)\/(.+)$/);
    if (match) {
      const driveKey = safeString(match[1]);
      const url = decodeURIComponent(match[2]);
      const drive =
        (driveKey && driveKey !== "auto" && drives.find((item) => safeString(item.key) === driveKey)) ||
        findMatchedDrive(url, drives, driveKey);
      if (drive) {
        return await drive.play(url, flag);
      }
      return {
        parse: 0,
        jx: 0,
        url: `push://${url}`,
        header: {},
      };
    }
  }

  if (/^https?:\/\//i.test(safeString(id))) {
    return {
      parse: 0,
      jx: 0,
      url: id,
      header: {
        Referer: `${SITE_CONFIG.host}/`,
        "User-Agent": SITE_CONFIG.headers["User-Agent"],
      },
    };
  }

  const driveKey = safeString(flag).split("#")[0];
  const drive =
    drives.find((item) => safeString(item.key) === driveKey) || findMatchedDrive(safeString(id), drives, driveKey);
  if (drive) {
    return await drive.play(id, flag);
  }

  return {
    parse: 0,
    jx: 0,
    url: id,
    header: {
      Referer: `${SITE_CONFIG.host}/`,
      "User-Agent": SITE_CONFIG.headers["User-Agent"],
    },
  };
}

async function handleT4Request(req) {
  const body = req.body || {};
  const query = req.query || {};
  const { ids, id, wd, play, t, pg, ext, ac } = query;
  const page = Number(pg || 1) || 1;
  const drives = req.server?.drives || [];
  const idsValue = safeString(ids || id);
  const tValue = safeString(t);
  const folderTypeId =
    safeString(ac) === "detail" && tValue.startsWith(FOLDER_PREFIX) ? tValue : "";
  const detailId = safeString(idsValue || folderTypeId);

  if (detailId) {
    const detailResult = await _detail(detailId, drives);
    return {
      list: Array.isArray(detailResult) ? detailResult : [detailResult],
      page: 1,
      pagecount: 1,
    };
  }

  if (play) {
    return await _play(query.flag || "", play, drives);
  }

  if (safeString(ac) === "action" && query.action !== undefined) {
    return await handleAction(query.action, query.value ?? body.value);
  }

  if (wd) {
    return await _search(safeString(wd), page);
  }

  if (t !== undefined) {
    return await _category({
      id: safeString(t),
      page,
      filters: decodeExt(ext),
    });
  }

  return await _home();
}

module.exports = async (serverOrApp, opt) => {
  await init(serverOrApp);
  serverOrApp.get(meta.api, async (req, reply) => {
    try {
      return await handleT4Request(req);
    } catch (error) {
      log.error(`[盘链] 插件异常: ${error.message}`);
      return {
        error: "Internal Server Error",
        message: error.message,
      };
    }
  });

  if (typeof serverOrApp.post === "function") {
    serverOrApp.post(meta.api, async (req, reply) => {
      try {
        return await handleT4Request(req);
      } catch (error) {
        log.error(`[盘链] 插件异常: ${error.message}`);
        return {
          error: "Internal Server Error",
          message: error.message,
        };
      }
    });
  }

  if (typeof serverOrApp.get === "function") {
    serverOrApp.get(meta.loginPage, async (req, reply) => {
      if (reply?.type) reply.type("text/html; charset=utf-8");
      return buildLoginPageHtml();
    });
  }

  if (typeof serverOrApp.post === "function") {
    serverOrApp.post(meta.loginApi, async (req, reply) => {
      try {
        const body = req.body || {};
        const username = safeString(body.username);
        const password = safeString(body.password);
        const remember = body.remember !== false;
        if (!username || !password) {
          return {
            success: false,
            message: "账号和密码不能为空",
          };
        }
        const result = await performPanlianLogin(username, password, remember);
        return result;
      } catch (error) {
        log.warn(`[盘链] 登录辅助失败: ${error.message}`);
        return {
          success: false,
          message: error.message,
        };
      }
    });
  }

  if (typeof serverOrApp.post === "function") {
    serverOrApp.post(meta.configApi, async (req, reply) => {
      try {
        const body = req.body || {};
        updateRuntimeConfig({
          blockedPanTypes: body.blockedPanTypes,
        });
        return {
          success: true,
          message: "设置已保存",
          blockedPanTypes: runtimeState.blockedPanTypes,
        };
      } catch (error) {
        log.warn(`[盘链] 配置保存失败: ${error.message}`);
        return {
          success: false,
          message: error.message,
        };
      }
    });
  }

  opt.sites.push({
    key: meta.key,
    name: meta.name,
    type: meta.type,
    api: meta.api,
    searchable: meta.searchable,
    quickSearch: meta.quickSearch,
    filterable: meta.filterable,
  });

  log.info(`[盘链] 已加载，API: ${meta.api}`);
};
