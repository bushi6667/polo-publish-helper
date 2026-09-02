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

// 截取 fillSizeTemplate 内 targetTemplate 的映射块（从 let targetTemplate 到 log 行）
const blockMatch = page3Src.match(/let targetTemplate = '男士T恤通用';[\s\S]*?log\(`📋 查找模板/);
const block = blockMatch ? blockMatch[0] : '';

test('数字 4 (Hooded) 映射到 男士帽衫通用', () => {
    assert(
        /if \(isHoodie\) \{[\s\S]*?男士帽衫通用/.test(block),
        'isHoodie 分支的目标模板为「男士帽衫通用」'
    );
});

test('数字 5 (Sweatshirt) 映射到 男士卫衣通用版', () => {
    assert(
        /else if \(isSweatshirt\) \{[\s\S]*?男士卫衣通用版/.test(block),
        'isSweatshirt 分支的目标模板仍为「男士卫衣通用版」'
    );
});

test('帽衫与卫衣已分开（不再共用同一合并判断）', () => {
    assert(
        !/if \(isHoodie \|\| isSweatshirt\)/.test(block),
        '不存在把帽衫/卫衣合并在一个 if 里的旧写法'
    );
});

test('衬衫/Polo/商务/正装 映射保持不变', () => {
    assert(
        /else if \(isShirt \|\| isPolo[\s\S]*?男士商务正装通用/.test(block),
        'isShirt/isPolo/商务/正装 分支仍为「男士商务正装通用」'
    );
});

test('默认兜底仍为 男士T恤通用', () => {
    assert(
        /let targetTemplate = '男士T恤通用'/.test(block),
        '默认目标模板仍为「男士T恤通用」'
    );
});

console.log(`\n========== 测试结果 ==========`);
console.log(`通过: ${passed}, 失败: ${failed}`);
if (failed > 0) {
    process.exit(1);
}