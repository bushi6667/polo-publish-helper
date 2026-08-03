// M2-① filename 白名单 + M3 目录校验 单元测试
// 对应 chrome_extension/background.js 的 SAFE_FILENAME_RE（downloadDoubaoImage 入口）与 isValidDir（updateConfig）
// 运行：node tests/test-background-p1.js
//
// 说明：background.js 是 MV3 service worker，无法直接在 node 中 require。
// 本测试把可测的纯逻辑独立实现并断言，与 background.js 保持行为一致；如 background.js 逻辑变更需同步更新此处。

const assert = require('assert');

// ---------- 被测纯函数（与 background.js 保持行为一致） ----------

// M2-①：下载文件名白名单（禁路径分隔符/绝对路径/..）
// 注意：RegExp.test(null) 会把 null 转 "null"（全在白名单内返回 true），必须先 typeof 检查
const SAFE_FILENAME_RE = /^[a-zA-Z0-9\u4e00-\u9fff._-]+$/;
function isValidDownloadFilename(filename) {
    return typeof filename === 'string' && SAFE_FILENAME_RE.test(filename) && !filename.includes('..');
}

// M3：目录配置值校验
// 空串/空值 = 显式清空目录（popup.js 与 发品助手.html 支持清空），放行；
// 非空值校验格式：拒绝盘符根/控制字符
function isValidDir(v) {
    if (v === '' || v === null || v === undefined) return true; // 显式清空
    if (typeof v !== 'string' || !v.trim()) return false;
    if (/^[a-zA-Z]:[\\/]?$/.test(v.trim())) return false; // 盘符根
    if (v.includes('\0') || v.includes('\n') || v.includes('\r')) return false;
    return true; // 单字符目录（如「图」）合法
}

// ---------- 测试用例 ----------

console.log('[isValidDownloadFilename 正常文件名（M2-① 放行）]');
assert.strictEqual(isValidDownloadFilename('row10_white.png'), true, '标准颜色图文件名');
assert.strictEqual(isValidDownloadFilename('产品_蓝色.jpg'), true, '中文文件名');
assert.strictEqual(isValidDownloadFilename('row10_white.png'), true, '数字下划线');
console.log('  ✅ 3/3');

console.log('[isValidDownloadFilename 恶意文件名（M2-① 拒绝）]');
assert.strictEqual(isValidDownloadFilename('../../evil.png'), false, '路径穿越 .. 拒绝');
assert.strictEqual(isValidDownloadFilename('..\\..\\evil.png'), false, '反斜杠路径拒绝');
assert.strictEqual(isValidDownloadFilename('a/b.png'), false, '正斜杠拒绝');
assert.strictEqual(isValidDownloadFilename('C:\\evil.png'), false, '盘符绝对路径拒绝');
assert.strictEqual(isValidDownloadFilename('a b.png'), false, '空格拒绝');
assert.strictEqual(isValidDownloadFilename(''), false, '空串拒绝');
assert.strictEqual(isValidDownloadFilename(null), false, 'null 拒绝（正则 test 抛错需兜底）');
console.log('  ✅ 7/7');

console.log('[isValidDir 合法目录（M3 放行）]');
assert.strictEqual(isValidDir('D:\\下载\\颜色图'), true, 'Windows 目录');
assert.strictEqual(isValidDir('D:/下载/颜色图'), true, '正斜杠目录');
assert.strictEqual(isValidDir('C:\\Users\\me\\Desktop\\xlsx发品'), true, '深路径');
assert.strictEqual(isValidDir('图'), true, '单字符目录（如「图」）合法');
console.log('  ✅ 4/4');

console.log('[isValidDir 空值 = 显式清空（M3 放行）]');
assert.strictEqual(isValidDir(''), true, '空串 = 清空目录（popup/发品助手支持清空）');
assert.strictEqual(isValidDir(undefined), true, 'undefined = 未设置/清空');
assert.strictEqual(isValidDir(null), true, 'null = 清空');
console.log('  ✅ 3/3');

console.log('[isValidDir 非法目录（M3 拒绝）]');
assert.strictEqual(isValidDir('   '), false, '纯空格');
assert.strictEqual(isValidDir('C:'), false, '盘符根 C:');
assert.strictEqual(isValidDir('C:\\'), false, '盘符根 C:\\');
assert.strictEqual(isValidDir('D:/'), false, '盘符根 D:/');
assert.strictEqual(isValidDir('a\nb'), false, '含换行');
assert.strictEqual(isValidDir('a\0b'), false, '含空字符');
assert.strictEqual(isValidDir(123), false, '非字符串');
console.log('  ✅ 7/7');

console.log('\n----------------------------------------');
console.log('通过 24 / 失败 0');
