const fs = require('fs');
const path = require('path');

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

const page3Src = fs.readFileSync(PAGE3_PATH, 'utf-8');

const buildMatch = page3Src.match(/function buildAttributeFields[\s\S]*?^\}/m);
const fnBody = buildMatch ? buildMatch[0] : '';

test('Shirt 类目产品特性为 tag 模式', () => {
    const shirtSection = fnBody.match(/isShirt\)[\s\S]*?requiredFields = \[[\s\S]*?\];/);
    const sectionText = shirtSection ? shirtSection[0] : '';
    const featuresLine = sectionText.match(/\{ lbl: ['"]产品特性['"][^}]*\}/);
    assert(
        featuresLine && featuresLine[0].includes("forceMode: 'tag'"),
        'Shirt 类目产品特性字段包含 forceMode: tag'
    );
});

test('T-shirt 类目产品特性为 tag 模式', () => {
    const tshirtSection = fnBody.match(/isTshirt\)[\s\S]*?requiredFields = \[[\s\S]*?\];/);
    const sectionText = tshirtSection ? tshirtSection[0] : '';
    const featuresLine = sectionText.match(/\{ lbl: ['"]产品特性['"][^}]*\}/);
    assert(
        featuresLine && featuresLine[0].includes("forceMode: 'tag'"),
        'T-shirt 类目产品特性字段包含 forceMode: tag'
    );
});

test('Polo 类目产品特性为 tag 模式', () => {
    const poloSection = fnBody.match(/isPolo\)[\s\S]*?requiredFields = \[[\s\S]*?\];/);
    const sectionText = poloSection ? poloSection[0] : '';
    const featuresLine = sectionText.match(/\{ lbl: ['"]产品特性['"][^}]*\}/);
    assert(
        featuresLine && featuresLine[0].includes("forceMode: 'tag'"),
        'Polo 类目产品特性字段包含 forceMode: tag'
    );
});

test('Hoodie/Sweatshirt 类目产品特性为 tag 模式', () => {
    const hoodieSection = fnBody.match(/isHoodie \|\| isSweatshirt\)[\s\S]*?optionalFields = \[[\s\S]*?\];/);
    const sectionText = hoodieSection ? hoodieSection[0] : '';
    const featuresLine = sectionText.match(/\{ lbl: ['"]产品特性['"][^}]*\}/);
    assert(
        featuresLine && featuresLine[0].includes("forceMode: 'tag'"),
        'Hoodie/Sweatshirt 类目产品特性字段包含 forceMode: tag'
    );
});

test('默认类目产品特性为 tag 模式', () => {
    const elseIndex = fnBody.lastIndexOf('} else {');
    const defaultSection = fnBody.substring(elseIndex);
    const featuresLine = defaultSection.match(/\{ lbl: ['"]产品特性['"][^}]*\}/);
    assert(
        featuresLine && featuresLine[0].includes("forceMode: 'tag'"),
        '默认类目产品特性字段包含 forceMode: tag'
    );
});

test('tag 模式支持多值循环输入', () => {
    const fillAttrMatch = page3Src.match(/else if \(actualMode === 'tag'\)[\s\S]*?^\s{8}\}/m);
    const tagSection = fillAttrMatch ? fillAttrMatch[0] : '';
    assert(
        tagSection.includes('for (const val of values)'),
        'tag 模式包含 for...of 循环处理多个值'
    );
    assert(
        tagSection.includes('Array.isArray(field.val)'),
        'tag 模式判断 field.val 是否为数组'
    );
});

test('tag 模式支持搜索匹配选项', () => {
    const fillAttrMatch = page3Src.match(/else if \(actualMode === 'tag'\)[\s\S]*?^\s{8}\}/m);
    const tagSection = fillAttrMatch ? fillAttrMatch[0] : '';
    assert(
        tagSection.includes('querySelectorAll'),
        'tag 模式查询下拉选项'
    );
    assert(
        tagSection.includes('normalizeCompare'),
        'tag 模式使用 normalizeCompare 匹配'
    );
    assert(
        tagSection.includes('nativeMouseClick(matchedOpt)'),
        'tag 模式点击匹配的选项'
    );
});

test('tag 模式找不到匹配时按回车确认', () => {
    const fillAttrMatch = page3Src.match(/else if \(actualMode === 'tag'\)[\s\S]*?^\s{8}\}/m);
    const tagSection = fillAttrMatch ? fillAttrMatch[0] : '';
    assert(
        tagSection.includes('pressEnter(inp)'),
        'tag 模式找不到匹配时按回车确认自定义值'
    );
});

test('tag 模式自动清除已有标签', () => {
    const fillAttrMatch = page3Src.match(/else if \(actualMode === 'tag'\)[\s\S]*?^\s{8}\}/m);
    const tagSection = fillAttrMatch ? fillAttrMatch[0] : '';
    assert(
        tagSection.includes('next-tag-close') || tagSection.includes('tag-close'),
        'tag 模式查找关闭按钮'
    );
    assert(
        tagSection.includes('closeBtns[i].click()'),
        'tag 模式点击关闭按钮清除已有标签'
    );
});

test('产品特性所有类目共 5 处均为 tag 模式', () => {
    const featuresLines = fnBody.match(/\{ lbl: ['"]产品特性['"][^}]*\}/g);
    const count = featuresLines ? featuresLines.length : 0;
    const tagCount = featuresLines ? featuresLines.filter(l => l.includes("forceMode: 'tag'")).length : 0;
    assert(count === 5, `产品特性字段出现 5 次（实际: ${count}）`);
    assert(tagCount === 5, `5 处产品特性均为 tag 模式（实际: ${tagCount}）`);
});

console.log(`\n========== 测试结果 ==========`);
console.log(`通过: ${passed}, 失败: ${failed}`);
if (failed > 0) {
    process.exit(1);
}
