// 页3 商品分组匹配误命中修复单元测试（group-match-fix）
// 对应 chrome_extension/content/page3.js 的 matchGroupOption
// 运行：node tests/test-page3-group-match.js
//
// 说明：page3.js 依赖 DOM/chrome API 无法在 node 中 require；
// 本测试把可测的纯逻辑独立实现并断言，与 page3.js 保持行为一致；如逻辑变更需同步更新此处。

const assert = require('assert');

// ---------- 被测纯函数（与 page3.js 保持行为一致） ----------

// 分组选项匹配：精确优先 + 类目修饰前缀排除
function matchGroupOption(optText, target) {
    const t = String(optText || '').trim();
    const tar = String(target || '').trim();
    if (!t || !tar) return false;
    const tLower = t.toLowerCase();
    const tarLower = tar.toLowerCase();
    if (tLower === tarLower) return true;                    // 精确
    if (tLower.startsWith(tarLower + ' ')) return true;      // 开头+空格边界
    if (tLower.includes(tarLower)) {
        const prefix = tLower.slice(0, tLower.indexOf(tarLower)).trim();
        const CATEGORY_PREFIX_RE = /^(t[- ]?|polo[- ]?|men'?s[- ]?(t[- ]?|polo[- ]?))$/;
        if (CATEGORY_PREFIX_RE.test(prefix)) return false;   // 更具体类目（T-Shirts / Polo Shirts）→ 误命中
        return true;
    }
    return false;
}

// ---------- 测试用例 ----------

console.log('[核心回归：Shirts 不误命中更具体类目（group-match-fix）]');
assert.strictEqual(matchGroupOption('T-Shirts', 'shirts'), false, 'Shirts 不命中 T-Shirts');
assert.strictEqual(matchGroupOption('T Shirts', 'shirts'), false, 'Shirts 不命中 T Shirts');
assert.strictEqual(matchGroupOption('Polo Shirts', 'shirts'), false, 'Shirts 不命中 Polo Shirts');
assert.strictEqual(matchGroupOption("Men's T-Shirts", 'shirts'), false, 'Shirts 不命中 Men\'s T-Shirts');
assert.strictEqual(matchGroupOption("Men's Polo Shirts", 'shirts'), false, 'Shirts 不命中 Men\'s Polo Shirts');
console.log('  ✅ 5/5');

console.log('[精确与开头匹配（正常命中）]');
assert.strictEqual(matchGroupOption('Shirts', 'shirts'), true, '精确命中 Shirts');
assert.strictEqual(matchGroupOption('Shirts Long Sleeve', 'shirts'), true, '开头+空格：Shirts Long Sleeve');
assert.strictEqual(matchGroupOption('Polo Shirts', 'polo'), true, '候选 Polo 是选项开头');
assert.strictEqual(matchGroupOption('T-Shirts', 't-shirts'), true, '候选 T-Shirts 精确命中');
console.log('  ✅ 4/4');

console.log('[合理包含匹配保留（性别修饰/并列不误伤）]');
assert.strictEqual(matchGroupOption("Men's Vest", 'vest'), true, 'Vest 命中 Men\'s Vest（men\'s 为性别修饰）');
assert.strictEqual(matchGroupOption('Hoodies & Sweatshirts', 'hoodies'), true, 'Hoodies 命中 Hoodies & Sweatshirts（开头+并列）');
assert.strictEqual(matchGroupOption('Mens Pants', 'pants'), true, 'Pants 命中 Mens Pants');
console.log('  ✅ 3/3');

console.log('[反向与边界]');
assert.strictEqual(matchGroupOption('Shirts', 't-shirts'), false, '候选 T-Shirts 不命中 Shirts');
assert.strictEqual(matchGroupOption('', 'shirts'), false, '空选项');
assert.strictEqual(matchGroupOption('Shirts', ''), false, '空候选');
assert.strictEqual(matchGroupOption('Shirts', null), false, 'null 候选');
console.log('  ✅ 4/4');

console.log('\n----------------------------------------');
console.log('通过 16 / 失败 0');
