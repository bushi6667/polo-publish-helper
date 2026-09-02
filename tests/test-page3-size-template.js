const fs = require('fs');
const path = require('path');

// 直接加载 categoryConfig（其逻辑已从 page3.js 收敛到配置模块，行为测试比源码模式匹配更可靠）
const categoryConfig = require('../chrome_extension/content/configs/categoryConfig.js');

const PAGE3_PATH = path.join(__dirname, '..', 'chrome_extension', 'content', 'page3.js');

let passed = 0;
let failed = 0;

function assert(condition, msg) {
    if (condition) {
        console.log(`  ✓ ${msg}`);
        passed++;
    } else {
        console.log(`  ✗ ${msg}`);
        failed++;
    }
}

function test(name, fn) {
    console.log(`\n[${name}]`);
    fn();
}

const SIZE_TEMPLATE = categoryConfig.SIZE_TEMPLATE_BY_TYPE;

test('数字括号映射到类型（单一真源 classifyCategory）', () => {
    assert(categoryConfig.classifyCategory('Men\'s T-Shirts(1)').type === 'tshirt', '(1) -> tshirt');
    assert(categoryConfig.classifyCategory('Polo(2)').type === 'polo', '(2) -> polo');
    assert(categoryConfig.classifyCategory('Men\'s Shirts(3)').type === 'shirt', '(3) -> shirt');
    assert(categoryConfig.classifyCategory('Hooded sweatshirt(4)').type === 'hoodie', '(4) -> hoodie（帽衫）');
    assert(categoryConfig.classifyCategory('Sweatshirt(5)').type === 'sweatshirt', '(5) -> sweatshirt（卫衣）');
});

test('数字 4=帽衫、5=卫衣 模板分开', () => {
    assert(SIZE_TEMPLATE.hoodie === '男士帽衫通用', '(4) Hooded 用「男士帽衫通用」');
    assert(SIZE_TEMPLATE.sweatshirt === '男士卫衣通用版', '(5) Sweatshirt 用「男士卫衣通用版」');
    assert(SIZE_TEMPLATE.hoodie !== SIZE_TEMPLATE.sweatshirt, '帽衫与卫衣模板不同');
});

test('其余数字模板保持不变', () => {
    assert(SIZE_TEMPLATE.tshirt === '男士T恤通用', '(1) T-shirt -> 男士T恤通用');
    assert(SIZE_TEMPLATE.polo === '男士商务正装通用', '(2) Polo -> 男士商务正装通用');
    assert(SIZE_TEMPLATE.shirt === '男士商务正装通用', '(3) Shirt -> 男士商务正装通用');
});

test('关键词兜底优先级帽衫>卫衣>Polo>T恤>衬衫', () => {
    assert(categoryConfig.classifyCategory('hoodie').type === 'hoodie', 'hoodie -> hoodie');
    assert(categoryConfig.classifyCategory('sweatshirt').type === 'sweatshirt', 'sweatshirt -> sweatshirt');
    assert(categoryConfig.classifyCategory('polo shirt').type === 'polo', 'polo shirt -> polo（Polo 优先于衬衫）');
    assert(categoryConfig.classifyCategory('t-shirt').type === 'tshirt', 't-shirt -> tshirt（T恤 优先于衬衫）');
    assert(categoryConfig.classifyCategory('men\'s shirts').type === 'shirt', 'men\'s shirts -> shirt');
    assert(categoryConfig.classifyCategory('衬衫').type === 'shirt', '衬衫 -> shirt');
    assert(categoryConfig.classifyCategory('T恤').type === 'tshirt', 'T恤 -> tshirt');
});

test('公司介绍模板映射', () => {
    const c = categoryConfig.COMPANY_INTRO_BY_TYPE;
    assert(c.tshirt === 'T恤' && c.polo === 'Polo衫' && c.shirt === 'Shirt'
        && c.hoodie === '卫衣有帽' && c.sweatshirt === '卫衣无帽', '类型->公司介绍模板一致');
    assert(categoryConfig.DEFAULT_COMPANY_INTRO === 'Polo衫', '未识别默认公司介绍');
});

test('colors/sizes/szMap/group 配置完整', () => {
    assert(Array.isArray(categoryConfig.DEFAULT_COLORS) && categoryConfig.DEFAULT_COLORS.length > 0, 'DEFAULT_COLORS 存在');
    assert(Array.isArray(categoryConfig.DEFAULT_SIZES) && categoryConfig.DEFAULT_SIZES.includes('2XL'), 'DEFAULT_SIZES 含 2XL');
    assert(categoryConfig.SIZE_LABEL_MAP['2XL'] === '2 XL', 'SIZE_LABEL_MAP 2XL -> 2 XL');
    assert(Array.isArray(categoryConfig.GROUP_CANDIDATES_BY_TYPE.hoodie), 'GROUP_CANDIDATES_BY_TYPE 完整');
});

test('page3 源码不再有帽衫/卫衣合并的判断（防倒退）', () => {
    const page3Src = fs.readFileSync(PAGE3_PATH, 'utf-8');
    const blockMatch = page3Src.match(/let targetTemplate = [\s\S]*?男士商务正装通用';/);
    const block = blockMatch ? blockMatch[0] : '';
    assert(!/if \(isHoodie \|\| isSweatshirt\)/.test(block), '未出现帽衫/卫衣合并 if');
});

console.log(`\n========== 测试结果 ==========`);
console.log(`通过: ${passed}, 失败: ${failed}`);
if (failed > 0) {
    process.exit(1);
}