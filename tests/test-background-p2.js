// P2 批次 L3（Windows 保留设备名校验）单元测试
// 对应 chrome_extension/background.js 的 isReservedWindowsName
// 运行：node tests/test-background-p2.js
//
// 说明：background.js 是 MV3 service worker，无法直接在 node 中 require。
// 本测试把可测的纯逻辑独立实现并断言，与 background.js 保持行为一致；如 background.js 逻辑变更需同步更新此处。

const assert = require('assert');

// ---------- 被测纯函数（与 background.js 保持行为一致） ----------

// L3：Windows 保留设备名（CON/PRN/AUX/NUL/COM1-9/LPT1-9，含带扩展名形式）
const RESERVED_WIN_NAME_RE = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\..*)?$/i;
function isReservedWindowsName(filename) {
    return RESERVED_WIN_NAME_RE.test(String(filename || '').split('.')[0]);
}

// ---------- 测试用例 ----------

console.log('[isReservedWindowsName 保留设备名拒绝（L3）]');
assert.strictEqual(isReservedWindowsName('CON'), true, 'CON');
assert.strictEqual(isReservedWindowsName('con'), true, 'con（大小写不敏感）');
assert.strictEqual(isReservedWindowsName('NUL'), true, 'NUL');
assert.strictEqual(isReservedWindowsName('AUX'), true, 'AUX');
assert.strictEqual(isReservedWindowsName('PRN'), true, 'PRN');
assert.strictEqual(isReservedWindowsName('COM1'), true, 'COM1');
assert.strictEqual(isReservedWindowsName('COM9'), true, 'COM9');
assert.strictEqual(isReservedWindowsName('LPT1'), true, 'LPT1');
assert.strictEqual(isReservedWindowsName('LPT9'), true, 'LPT9');
assert.strictEqual(isReservedWindowsName('CON.png'), true, 'CON.png（带扩展名形式）');
assert.strictEqual(isReservedWindowsName('nul.jpg'), true, 'nul.jpg');
console.log('  ✅ 11/11');

console.log('[isReservedWindowsName 正常文件名放行]');
assert.strictEqual(isReservedWindowsName('row10_white.png'), false, '正常颜色图文件名');
assert.strictEqual(isReservedWindowsName('product_blue.jpg'), false, '正常产品图');
assert.strictEqual(isReservedWindowsName('commercial.jpg'), false, 'commercial 非保留（前缀不误伤）');
assert.strictEqual(isReservedWindowsName('console.png'), false, 'console 非保留');
assert.strictEqual(isReservedWindowsName('COM10.png'), false, 'COM10 不在 COM1-9 范围');
assert.strictEqual(isReservedWindowsName('combat.jpg'), false, 'combat 非保留');
assert.strictEqual(isReservedWindowsName(''), false, '空串');
assert.strictEqual(isReservedWindowsName(undefined), false, 'undefined');
console.log('  ✅ 8/8');

console.log('[访问令牌格式（H1 第2层）]');
// 与 background.js getOrCreateToken 的生成逻辑保持一致：16 字节随机数 → 32 位 hex
function makeTokenLike() {
    const arr = new Uint8Array(16);
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) crypto.getRandomValues(arr);
    else for (let i = 0; i < 16; i++) arr[i] = Math.floor(Math.random() * 256);
    return Array.from(arr, b => b.toString(16).padStart(2, '0')).join('');
}
const t1 = makeTokenLike();
const t2 = makeTokenLike();
assert.strictEqual(t1.length, 32, '令牌为 32 位 hex');
assert.strictEqual(/^[0-9a-f]{32}$/.test(t1), true, '令牌仅含小写 hex');
assert.notStrictEqual(t1, t2, '两次生成不同（随机性）');
assert.strictEqual(typeof t1, 'string', '令牌为字符串');
console.log('  ✅ 4/4');

console.log('\n----------------------------------------');
console.log('通过 23 / 失败 0');
