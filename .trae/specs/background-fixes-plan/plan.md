# background.js 修复方案文档

> 状态：方案已定稿（多轮 review + security_review 交叉审查后），待实施
> 审查依据：review 子代理（功能 F1-F4）+ security_review 子代理（安全 H1-H3 / M1-M3 / L1-L2 / I1）+ 二次 review/security_review 复核
> 关键结论补充（复核后确认）：
> - **data URL 下载主路径动机成立**：MV3 Service Worker 无 `URL.createObjectURL`（downloadViaFetch :1661 的 blob fallback 必然失败），data URL 是必要方案；但必须加 `blob.type` 图片校验（M2）
> - **STORAGE_KEY 语义澄清**：`'polo_product_data'` 是单条当前产品数据键（每次发品覆盖写入，background.js:356），切新文件清理它合理，非"全库"；全库数据在 `prefix+'product__rowN'` 键下（有文件名前缀保护）
> - **color_images_row_\* 为 legacy 迁移键**（getColorImagePathData:268 迁移后即删），删除无功能损失，但无文件名前缀、跨文件共享，清理收益低，本次去掉
> 修复优先级：**P0 先修（功能阻断 + 高危害安全）→ P1 推荐（中危安全）→ P2 可选（低危/健壮性）**

---

## 一、功能问题（review 发现）

### F1. 下载目录默认值不一致 → 颜色图读取失败（P0）

- **位置**：`background.js:1476`（downloadDoubaoImage，未提交修改引入 `'default'`）vs `background.js:251`（buildColorImagePath 仍用 `'默认'`）
- **问题**：`CURRENT_FILENAME` 为空时，下载侧把图存到 `Polo发品_颜色图/default/rowN/`，而读取侧 `getColorImagePathData`/`buildColorImagePath` 去 `.../默认/rowN/` 找 → 颜色图上传失败。
- **修复**：统一定义常量并两端引用：

```js
// 文件顶部新增
const DEFAULT_FILE_FOLDER = '默认';   // 历史路径一直是 '默认'，改 'default' 会破坏已有数据

// :1476
const fileFolder = CURRENT_FILENAME || DEFAULT_FILE_FOLDER;
// :251
const fileFolder = CURRENT_FILENAME || DEFAULT_FILE_FOLDER;
```

- **验证**：`node --check chrome_extension/background.js`；在 CURRENT_FILENAME 为空时执行一次换色下载并核对落盘目录（手动）。

### F2. downloadFilenameMap 事件时序与泄漏（P0）

- **位置**：`background.js:32-45`（onDeterminingFilename + downloadFilenameMap）+ `:1516-1520`（mapping set 在 download 回调中）+ `:1529-1540`（onChanged 仅 complete 时清理）
- **问题**：①时序竞态：`downloadFilenameMap.set()` 在 `chrome.downloads.download()` 回调中执行，与 `onDeterminingFilename` 触发顺序无硬性保证，竞态下 `suggest()` 不命中、文件名回退默认值；②map 泄漏：条目只在 suggest 命中时删除，下载失败/取消时永久累积，且全局监听器影响扩展所有 downloads（含 downloadViaFetch 的 blob 下载）
- **决策说明**：保留 data URL 主路径与 downloadFilenameMap 机制（不删除）——download() 的 filename 参数在有 onDeterminingFilename 监听器时可能被忽略，机制承担强制命名职责；但需修复竞态与泄漏。**注意**：onDeterminingFilename 触发时 mapping 可能尚未 set 的根因（download 回调时序）需运行时实测，本修复只做兜底，根治方案见"遗留项"
- **修复（最小改动，不改变现状行为）**：

```js
// ① mapping 增加 url 字段（:1519 附近）
downloadFilenameMap.set(downloadId, { filename, relativePath, url: downloadUrl });

// ② onDeterminingFilename 增加 url 兜底匹配（:37-44）
chrome.downloads.onDeterminingFilename.addListener((downloadItem, suggest) => {
    let mapping = downloadFilenameMap.get(downloadItem.id);
    if (!mapping && downloadItem.url) {
        // 竞态/id 不匹配时按 url 兜底（data: 或原始 URL 均与传入 downloadUrl 一致）
        for (const m of downloadFilenameMap.values()) {
            if (m.url === downloadItem.url) { mapping = m; break; }
        }
    }
    if (mapping) {
        suggest({ filename: mapping.relativePath, conflictAction: 'overwrite' });
        downloadFilenameMap.delete(downloadItem.id);
    }
});

// ③ downloadDoubaoImage 的 onChanged 中补 interrupted 清理（:1529 附近）
if (delta.state && (delta.state.current === 'complete' || delta.state.current === 'interrupted')) {
    downloadFilenameMap.delete(downloadId);
    ...原逻辑...
}
```

- **遗留项（需运行时实测）**：若实测确认 download() 回调晚于 onDeterminingFilename，则 map 完全未 set 时兜底也无效，需改为在 `chrome.downloads.onCreated` 事件（下载对象创建时即触发）中登记 mapping，或在 listener 内按 downloadItem.url 直接推导目标路径（需要把 relativePath 计算抽成纯函数供两端复用）。
- **验证**：`node --check`；手动执行换色下载确认落盘路径正确（data URL 与原始 URL 两种场景）；下载中途取消后 map 无泄漏（日志确认无残留匹配）。

---

## 二、安全问题（security_review 发现）

### H1. onMessageExternal 无鉴权 → 任意本地页面可操控插件（P0）

- **位置**：`background.js:562-631` + `manifest.json:50-52`（externally_connectable 显式放行 `file:///*`）
- **问题**：不校验 `sender`，任何本地 HTML（或任意扩展）知道扩展 ID 即可：删光数据、篡改 IMAGE_DIR/COLOR_IMG_DIR、驱动 `startPsEdit`/`startColorChange`/`openBatchPublish`。注意 `file://` 通道是发品助手.html 的**设计需求**，不能简单移除，需加校验。
- **修复（三层递进，建议 1+2 必做，3 可选）**：

**第 1 层 — 校验 sender.url（必做，Chrome 提供、不可伪造）**：优先与 popup 已配置的 helperPath（`chrome.storage.local` 的 `polo_helper_path`，popup.js:3,165）精确匹配；未配置时按文件名兜底：

```js
const HELPER_PATH_KEY = 'polo_helper_path';

async function isTrustedSender(sender) {
    const url = sender?.url || '';
    if (url.startsWith('chrome-extension://')) return true;   // 扩展自身页面
    if (!url.startsWith('file://')) return false;              // 拒绝 http/https 等网页
    // file:// 路径标准化（去掉 file:// 前缀、统一分隔符）
    const path = decodeURIComponent(url.replace(/^file:\/\/\//, '').replace(/^file:\/\//, '')).replace(/\//g, '\\');
    // 优先精确匹配已配置的 helperPath
    const helper = await new Promise(r => chrome.storage.local.get(HELPER_PATH_KEY, v => r(v[HELPER_PATH_KEY] || '')));
    if (helper) return path.toLowerCase() === helper.replace(/\//g, '\\').toLowerCase();
    // 兜底：文件名包含"发品助手"
    return path.includes('发品助手');
}

// onMessageExternal 入口：包装为异步校验（return true 保持通道）
chrome.runtime.onMessageExternal.addListener((request, sender, sendResponse) => {
    isTrustedSender(sender).then(ok => {
        if (!ok) {
            console.warn('⛔ 拒绝未授权外部消息:', sender?.url);
            sendResponse({ ok: false, error: '未授权来源' });
            return;
        }
        // ...原逻辑（整体移入此处）...
    });
    return true;
});
```

onConnectExternal 同样加 isTrustedSender 校验（不通过则 port.disconnect()）。

**第 2 层 — 握手 token（推荐）**：

```js
// background 侧
const TOKEN_KEY = 'polo_access_token';
function getOrCreateToken() {
    return new Promise(resolve => {
        chrome.storage.local.get(TOKEN_KEY, r => {
            if (r[TOKEN_KEY]) return resolve(r[TOKEN_KEY]);
            const token = Array.from(crypto.getRandomValues(new Uint8Array(16)), b =>
                b.toString(16).padStart(2, '0')).join('');
            chrome.storage.local.set({ [TOKEN_KEY]: token }, () => resolve(token));
        });
    });
}
// onMessageExternal：request.token === token 才放行（'ping' 首次可免 token 用于取 token）
```

发品助手.html 侧：首次 `ping` 拿 token 存 `localStorage`，之后所有消息带 `token` 字段。

**第 3 层 — 敏感动作限定走长连接（可选加强）**：`updateConfig` / `clearAll*` / `startPsEdit` / `startColorChange` / `startAiEdit` / `openBatchPublish` 只接受来自 `assistant-channel` 长连接（`onConnectExternal` 同样加 sender.url 校验），`onMessageExternal` 仅保留只读动作（`ping` / `getConfig` / `getProductByRow` 等）。

- **验证**：任意新建一个本地 html（含 `chrome.runtime.sendMessage(EXT_ID, {action:'updateConfig',...})`）→ 应被拒绝；发品助手.html 正常操作不受影响。

### H2. startPsEdit 脚本注入（P0）

- **位置**：`background.js:1805,1815`（`baseFileName` 仅剥扩展名，未转义即拼入 `app.activeDocument.name = "${baseFileName}";`，经 H1 通道外部可达）
- **修复**：白名单清洗 + JSON 转义双保险：

```js
// :1805 之后
const baseFileName = fileName
    .replace(/\.(jpg|jpeg|png|gif|webp)$/i, '')
    .replace(/[^a-zA-Z0-9\u4e00-\u9fff._-]/g, '_');   // 白名单：字母/数字/中文/._-
// :1815
script: `app.activeDocument.name = ${JSON.stringify(baseFileName)};`
```

- **验证**：对 fileName 传 `x";window.__psEditFileName="hacked` 的用例跑转义函数断言输出无引号/分号（node 单测）。

### H3. clearAllOnNewFile 空前缀清库（P0）

- **位置**：`background.js:592-606`
- **问题**：①`CURRENT_FILENAME` 为空时 `getFilePrefix()` 返回 `''`，`k.startsWith('')` 恒真 → 删除 storage 全部键（含 IMAGE_DIR / COLOR_IMG_DIR / current_filename 配置）——本次改动中可能清空全库的最高危点；②未提交修改新增的 `k.startsWith('color_images_row_')` 清理无文件名前缀、跨文件共享的 legacy 键（收益低）。
- **决策说明**：`STORAGE_KEY`（单条当前产品数据）保留在清理范围——它随每次发品覆盖写入，切新文件清理是合理行为；`color_images_row_*` 去掉（legacy 迁移键，清理收益低）。
- **修复**：

```js
if (request.action === 'clearAllOnNewFile') {
    const prefix = getFilePrefix();
    if (!prefix) {
        // 无当前文件名时拒绝清理（避免空前缀删全库）；或仅清理明确全局键
        sendResponse({ ok: false, error: '未设置当前文件名，已跳过清理' });
        return true;
    }
    chrome.storage.local.get(null, (result) => {
        const keys = Object.keys(result).filter(k =>
            k.startsWith(prefix) || k === STORAGE_KEY
        );
        // 注意：不要删 'color_images_row_' 前缀的跨文件 legacy 键；
        // 如需清理应先迁移（见 getColorImagePathData :268 的迁移逻辑）再删。
        ...
    });
}
```

- **验证**：置空 CURRENT_FILENAME 触发该动作 → 配置键应保留；正常文件名下行为不变。

### M1. runClickScript eval 注入（P1）

- **位置**：`background.js:720-745`
- **问题**：`selector` 未转义拼入模板后 `eval` 执行；现调用点（page3.js:2780）传硬编码常量，但入口无校验。
- **修复**：改用 `executeScript` 直接传参，页面侧用 `querySelector`：

```js
chrome.scripting.executeScript({
    target: { tabId },
    func: (sel) => {
        const el = document.querySelector(sel);
        if (!el) return { ok: false, msg: '元素未找到' };
        const rect = el.getBoundingClientRect();
        const x = rect.left + rect.width / 2;
        const y = rect.top + rect.height / 2;
        el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: x, clientY: y }));
        el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, clientX: x, clientY: y }));
        el.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: x, clientY: y }));
        return { ok: true, msg: '点击完成', rect: { width: rect.width, height: rect.height } };
    },
    args: [selector]
}).then(...)
```

- **验证**：`node --check`；用含引号的 selector 跑一次不报错且不执行额外 JS。

### M2. downloadDoubaoImage 的 url/filename 无校验 + data URL 绕过 content-type 防护（P0 部分实施）

- **位置**：`background.js:1473-1575, 1678-1683`
- **问题**：①`filename` 未经校验拼入下载路径，`conflictAction:'overwrite'` 可覆盖下载目录已有文件；②data URL 下载不走 Chrome 对 http(s) 的 Safe Browsing/Content-Type 危险类型判定——doubao 响应被投毒为 `text/html` 时会落盘伪装 `.png` 的 HTML/JS 文件（钓鱼/XSS 载体）。
- **修复（P0-3 先做 ②，P1 做 ①）**：

```js
// ② data URL 生成前校验 blob 类型（:1483-1506，非图片则跳过 dataUrl，回退原始 URL 下载）
const resp = await fetch(url, { headers: { 'Referer': 'https://www.doubao.com/' } });
if (resp.ok) {
    const blob = await resp.blob();
    if (blob.type && blob.type.startsWith('image/')) {   // 新增：非图片不生成 data URL
        dataUrl = await new Promise((r) => { ...原 FileReader 逻辑... });
        ...存 IDB...
    } else {
        console.warn('[download] 响应非图片类型，跳过 data URL，回退原始 URL:', blob.type);
    }
}

// ①（P1）入口处校验 filename/url（:1473 之前）
const SAFE_FILENAME_RE = /^[a-zA-Z0-9\u4e00-\u9fff._-]+$/;
if (!SAFE_FILENAME_RE.test(filename) || filename.includes('..')) {
    console.warn('⛔ 非法下载文件名:', filename);
    return resolve({ ok: false, error: '非法文件名' });
}
```

- **决策说明**：suggest 保持 `overwrite` 不改 `uniquify`——颜色图按 `rowN/颜色` 固定命名，换色重跑就是要覆盖更新同款；同名覆盖风险由 filename 白名单（①）控制。
- **验证**：构造 `filename='../../evil.png'` 断言被拒；对返回 `text/html` 的响应断言 dataUrl 为 null（回退原始 URL）。

### M3. updateConfig 目录值无校验（P1）

- **位置**：`background.js:611-628, 659-676`
- **修复**：校验值非空、非盘符根、长度下限、不含控制字符：

```js
function isValidDir(v) {
    if (typeof v !== 'string' || !v.trim()) return false;
    if (/^[a-zA-Z]:[\\/]?$/.test(v.trim())) return false;        // 盘符根
    if (v.includes('\0') || v.includes('\n') || v.includes('\r')) return false;
    return v.trim().length >= 2;
}
// updateConfig 内：不合法则 sendResponse({ ok:false, error:'非法目录' }) 并跳过写入
```

---

## 三、低危/健壮性（P2 可选）

### L1. psEditSave / psEditSaveFsa 无来源与大小校验
- **位置**：`background.js:770-782, 2147-2225`
- **修复**：校验 `sender.tab?.id === psEditState?.tabId`；对 `imgData` 长度设上限（如 100MB）拒绝超限。

### L2. injectMessageBridge 不校验 event.origin
- **位置**：`background.js:2096-2114`
- **修复**：

```js
window.addEventListener('message', (event) => {
    if (event.origin !== 'https://www.photopea.com' || event.source !== window) return;
    if (event.data && (event.data.type === 'PS_EDIT_SAVE' || event.data.type === 'PS_EDIT_SAVE_FSA')) { ... }
});
```

### I1. getColorImagePath 泄露本地路径
- **位置**：`background.js:523-538`
- **修复**：H1 鉴权落地后自然缓解；如仍需收紧，可仅对 `sender.url` 为发品助手页面的请求返回 `path` 字段。

---

## 四、修复执行顺序与回归验证

| 批次 | 内容 | 回归验证 |
|---|---|---|
| P0-1 | F1 + F2（目录默认值统一、downloadFilenameMap url 兜底 + interrupted 清理） | `node --check background.js` + 全量测试 + 手动换色下载核对落盘 |
| P0-2 | H1 第1层 + H3（sender.url 校验含 helperPath 匹配、空前缀保护、去掉 color_images_row_ 清理） | 恶意本地 html 被拒 + 正常发品助手流程冒烟 |
| P0-3 | H2（baseFileName 白名单 + JSON.stringify）+ M2-②（blob.type 图片校验） | `node --check` + 转义/图片类型断言单测 |
| P1 | M1 + M2-① + M3（eval 改 executeScript、filename/url 校验、目录校验） | `node --check` + 非法输入单测（文件名/URL/目录） |
| P2 | L1 + L2 + I1 + H1 第2/3层（token/长连接）+ F2 遗留项实测 | 全量回归：`tests/` 6 文件 137 断言全绿 |

现有测试（tests/ 下 6 个文件，137 项断言）与 `node --check` 为全量回归基线；H1/H3/M2 的纯逻辑（isTrustedSender / isValidDir / SAFE_FILENAME_RE / blob 类型判断）抽成独立函数并补充 node 单元测试，便于直接纳入 tests/。

---

## 附：当前未提交修改清单（background.js，49+/15-）

| 位置 | 改动 | 审查结论 |
|---|---|---|
| :33-45 | 新增 downloadFilenameMap + onDeterminingFilename 强制文件名 | ⚠️ F2：保留机制，修复竞态（url 兜底）+ 泄漏（interrupted 清理）；根治需运行时实测时序（遗留项） |
| :207,219 | IDB 键名/前缀正则加入中文 `\u4e00-\u9fff` | ✅ 改进（旧键成无害孤儿；IDB 键无注入面，security_review 确认） |
| :592-606 | clearAllOnNewFile 增加清理 STORAGE_KEY 与 `color_images_row_` 全局键 | ⚠️ H3：STORAGE_KEY 保留（单条当前产品，清理合理）、`color_images_row_` 去掉（legacy 键收益低）、空前缀保护 |
| :1473-1575 | downloadDoubaoImage：data URL 下载 + 路径改 `/` + 默认目录 `'default'` | ⚠️ F1 默认值不一致；data URL 主路径动机成立（MV3 SW 无 createObjectURL）但需 blob.type 图片校验（M2-②）；正斜杠正确 |
| :2091-2114 | 消息桥扩展 ID 硬编码 → `chrome.runtime.id` | ✅ 正确修复（旧硬编码从未匹配）；L2 仍需加 origin 校验 |
| :2170-2173 | EXTENSION_ID 动态化 | ✅ 正确修复；注释"换电脑"说法不实（manifest 无 `key`，重装 ID 仍变）——如需跨机稳定，应给 manifest 加固定 `"key"` |
