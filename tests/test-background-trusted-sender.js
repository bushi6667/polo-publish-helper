// 外部消息来源校验（isTrustedSender）单元测试
// 对应 chrome_extension/background.js 中的 isTrustedSender / normalizeFilePath / matchHelperPath 逻辑
// 运行：node tests/test-background-trusted-sender.js
//
// 说明：background.js 是 MV3 service worker（依赖 chrome.* / importScripts），无法直接在 node 中 require。
// 本测试把可测的纯逻辑（路径标准化、helperPath 匹配）独立实现并断言，与 background.js 保持行为一致；
// 如 background.js 的 isTrustedSender 逻辑变更需同步更新此处。
//
// 被测行为（background.js）：
//   1. chrome-extension:// 来源放行（扩展自身页面）
//   2. 非 file:// 来源拒绝（http/https 网页）
//   3. file:// 来源：优先精确匹配 popup 配置的 helperPath（绝对路径完整相等 / 相对文件名结尾匹配，大小写不敏感）
//   4. 未配置 helperPath 时兜底：路径包含"发品助手"

const assert = require('assert');

// ---------- 被测纯函数（与 background.js 保持行为一致） ----------

// file:// URL 路径标准化：去掉 file:// 前缀、统一分隔符为反斜杠
function normalizeFilePath(url) {
    if (typeof url !== 'string') return '';
    if (!url.startsWith('file://')) return '';
    return decodeURIComponent(url.replace(/^file:\/\/\//, '').replace(/^file:\/\//, '')).replace(/\//g, '\\');
}

// helperPath 匹配：返回 true 表示可信
function matchHelperPath(path, helper) {
    if (!path) return false;
    if (!helper) return path.includes('发品助手'); // 未配置 helperPath 时兜底
    const helperNorm = helper.replace(/\//g, '\\').toLowerCase();
    const pathLower = path.toLowerCase();
    if (pathLower === helperNorm) return true; // 绝对路径：完整相等
    if (!helperNorm.includes('\\') && !helperNorm.includes(':')) {
        // 相对路径（仅文件名）：结尾匹配
        return pathLower.endsWith('\\' + helperNorm) || pathLower.endsWith('/' + helperNorm);
    }
    return false;
}

// 完整 isTrustedSender（不含 chrome.storage 读取，helper 由外部注入）
// 与 background.js 保持一致：非 file:// 一律拒绝（扩展自身页面走 onMessage，不会进 onMessageExternal）；
// 非法编码的 file:// URL 拒绝
function isTrustedSenderLike(url, helper) {
    if (typeof url !== 'string' || !url.startsWith('file://')) return false;
    let path;
    try {
        path = normalizeFilePath(url);
    } catch (e) {
        return false; // 非法编码拒绝
    }
    return matchHelperPath(path, helper);
}

// ---------- 测试用例 ----------

console.log('[路径标准化 normalizeFilePath]');
assert.strictEqual(normalizeFilePath('file:///C:/x/发品助手.html'), 'C:\\x\\发品助手.html', 'Windows 绝对路径');
assert.strictEqual(normalizeFilePath('file:///D:/dir/sub/发品助手.html'), 'D:\\dir\\sub\\发品助手.html', '多级目录');
assert.strictEqual(normalizeFilePath('file:///C:/a/b/发品助手.html').toLowerCase(), 'c:\\a\\b\\发品助手.html', '大小写仅影响比较');
assert.strictEqual(normalizeFilePath('http://evil.com/x.html'), '', '非 file:// 返回空');
assert.strictEqual(normalizeFilePath(''), '', '空串返回空');
assert.strictEqual(normalizeFilePath(undefined), '', 'undefined 返回空');
console.log('  ✅ 6/6');

console.log('[matchHelperPath 绝对路径精确匹配]');
assert.strictEqual(matchHelperPath('C:\\x\\发品助手.html', 'C:\\x\\发品助手.html'), true, '完整相等放行');
assert.strictEqual(matchHelperPath('C:\\x\\发品助手.html', 'c:\\X\\发品助手.html'), true, '大小写不敏感');
assert.strictEqual(matchHelperPath('D:\\other\\x.html', 'C:\\x\\发品助手.html'), false, '不同路径拒绝');
console.log('  ✅ 3/3');

console.log('[matchHelperPath 相对路径（仅文件名）结尾匹配]');
assert.strictEqual(matchHelperPath('C:\\x\\发品助手.html', '发品助手.html'), true, '文件名结尾匹配');
assert.strictEqual(matchHelperPath('D:\\a\\b\\发品助手.html', '发品助手.html'), true, '任意目录下匹配');
assert.strictEqual(matchHelperPath('C:\\x\\发品助手.html', '助手.html'), false, '部分文件名不匹配');
console.log('  ✅ 3/3');

console.log('[matchHelperPath 未配置 helperPath 时兜底]');
assert.strictEqual(matchHelperPath('C:\\x\\发品助手.html', ''), true, '包含"发品助手"放行');
assert.strictEqual(matchHelperPath('C:\\x\\evil.html', ''), false, '不含"发品助手"拒绝');
assert.strictEqual(matchHelperPath('', ''), false, '空路径拒绝');
console.log('  ✅ 3/3');

console.log('[完整 isTrustedSenderLike 边界]');
assert.strictEqual(isTrustedSenderLike('chrome-extension://abcdef123456/x.html', ''), false, '其他扩展来源拒绝（自身页面走 onMessage 不进 external）');
assert.strictEqual(isTrustedSenderLike('https://evil.com/x', ''), false, 'https 网页拒绝');
assert.strictEqual(isTrustedSenderLike('http://post.alibaba.com/x', ''), false, 'http 页面拒绝');
assert.strictEqual(isTrustedSenderLike('file:///C:/x/发品助手.html', 'C:\\x\\发品助手.html'), true, '正常发品助手页面放行');
assert.strictEqual(isTrustedSenderLike('file:///C:/x/evil.html', 'C:\\x\\发品助手.html'), false, '其他本地 html 拒绝');
assert.strictEqual(isTrustedSenderLike('file:///C:/x/evil.html', ''), false, '未配置时其他 html 拒绝');
assert.strictEqual(isTrustedSenderLike('file:///C:/x/%E0%A4%A.html', ''), false, '非法编码 URL 拒绝');
console.log('  ✅ 7/7');

console.log('\n----------------------------------------');
console.log('通过 22 / 失败 0');
