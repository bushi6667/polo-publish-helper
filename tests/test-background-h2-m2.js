// H2 脚本注入防护 + M2-② 图片类型校验 单元测试
// 对应 chrome_extension/background.js 中 startPsEdit 的 baseFileName 清洗与 downloadDoubaoImage 的 blob.type 判断
// 运行：node tests/test-background-h2-m2.js
//
// 说明：background.js 是 MV3 service worker，无法直接在 node 中 require。
// 本测试把可测的纯逻辑独立实现并断言，与 background.js 保持行为一致；如 background.js 逻辑变更需同步更新此处。

const assert = require('assert');

// ---------- 被测纯函数（与 background.js 保持行为一致） ----------

// startPsEdit：baseFileName 白名单清洗（H2）
// 白名单：字母/数字/中文(\u4e00-\u9fff)/._-，其余替换为 _
function sanitizeBaseFileName(fileName) {
    return (fileName || '')
        .replace(/\.(jpg|jpeg|png|gif|webp)$/i, '')
        .replace(/[^a-zA-Z0-9\u4e00-\u9fff._-]/g, '_');
}

// downloadDoubaoImage/downloadViaFetch：blob 类型是否为 raster 图片（M2-②/M4）
// 仅放行 png/jpeg/webp/gif/bmp，排除 image/svg+xml（含脚本的 SVG 本地打开可在 file:// 上下文执行）
function isImageBlobType(blobType) {
    return /^image\/(png|jpe?g|webp|gif|bmp)$/i.test(String(blobType || ''));
}

// ---------- 测试用例 ----------

console.log('[sanitizeBaseFileName 正常文件名]');
assert.strictEqual(sanitizeBaseFileName('row10_main.jpg'), 'row10_main', '剥离 .jpg 扩展名');
assert.strictEqual(sanitizeBaseFileName('我的产品_蓝色.png'), '我的产品_蓝色', '中文+下划线保留');
assert.strictEqual(sanitizeBaseFileName('product.v2-final.png'), 'product.v2-final', '点与连字符保留');
console.log('  ✅ 3/3');

console.log('[sanitizeBaseFileName 注入用例（H2 核心）]');
const evil = 'x";window.__psEditFileName="hacked';
const cleaned = sanitizeBaseFileName(evil);
assert.strictEqual(cleaned.includes('"'), false, '双引号被清除');
assert.strictEqual(cleaned.includes(';'), false, '分号被清除');
assert.strictEqual(cleaned.includes('('), false, '括号被清除');
assert.strictEqual(cleaned.includes('='), false, '等号被清除');
assert.strictEqual(cleaned.includes('<'), false, '尖括号被清除');
assert.strictEqual(cleaned.includes('>'), false, '尖括号被清除');
assert.strictEqual(/^[a-zA-Z0-9\u4e00-\u9fff._-]+$/.test(cleaned), true, '清洗后仅剩白名单字符');
console.log('  ✅ 7/7');

console.log('[sanitizeBaseFileName 极端输入]');
// 注意：baseFileName 仅用于 Photopea 文档名（app.activeDocument.name），不参与文件系统路径拼接，
// 因此白名单保留 '.' 与 '..' 无安全后果（与 background.js 行为一致）
assert.strictEqual(sanitizeBaseFileName('../../etc/passwd'), '.._.._etc_passwd', '路径分隔符清洗为下划线，点号保留');
assert.strictEqual(sanitizeBaseFileName('a b&c*'), 'a_b_c_', '空格与特殊字符清洗');
assert.strictEqual(sanitizeBaseFileName(''), '', '空串');
assert.strictEqual(sanitizeBaseFileName(undefined), '', 'undefined');
console.log('  ✅ 4/4');

console.log('[isImageBlobType 图片类型放行]');
assert.strictEqual(isImageBlobType('image/png'), true, 'image/png');
assert.strictEqual(isImageBlobType('image/jpeg'), true, 'image/jpeg');
assert.strictEqual(isImageBlobType('image/webp'), true, 'image/webp');
assert.strictEqual(isImageBlobType('image/gif'), true, 'image/gif');
assert.strictEqual(isImageBlobType('image/bmp'), true, 'image/bmp');
assert.strictEqual(isImageBlobType('IMAGE/PNG'), true, '大小写不敏感');
console.log('  ✅ 6/6');

console.log('[isImageBlobType 非图片/危险类型拒绝（M2-②/M4 核心）]');
assert.strictEqual(isImageBlobType('text/html'), false, 'text/html 拒绝');
assert.strictEqual(isImageBlobType('application/javascript'), false, 'JS 拒绝');
assert.strictEqual(isImageBlobType('image/svg+xml'), false, 'SVG 拒绝（含脚本风险）');
assert.strictEqual(isImageBlobType(''), false, '空类型拒绝');
assert.strictEqual(isImageBlobType(undefined), false, 'undefined 拒绝');
assert.strictEqual(isImageBlobType(null), false, 'null 拒绝');
console.log('  ✅ 6/6');

console.log('\n----------------------------------------');
console.log('通过 26 / 失败 0');
