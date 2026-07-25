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

test('只点击一次 treeItem', () => {
    const groupMatch = page3Src.match(/async function fillGroupPage3[\s\S]*?^\}/m);
    const fnBody = groupMatch ? groupMatch[0] : '';

    // 确认只调用一次 realClick(treeItem)
    const reClickTreeItem = fnBody.match(/realClick\(treeItem\)/g);
    assert(
        reClickTreeItem && reClickTreeItem.length === 1,
        `realClick(treeItem) 只出现 ${reClickTreeItem?.length} 次（应为 1 次）`
    );

    // 确认没有第二次 realClick(treeItem)
    assert(
        fnBody.includes('await realClick(treeItem);') && 
        !fnBody.includes('await realClick(treeItem);\n            await sleep3(500);\n            await realClick(treeItem);'),
        '没有连续两次 realClick(treeItem)'
    );
});

test('有点击后的选中校验逻辑', () => {
    const groupMatch = page3Src.match(/async function fillGroupPage3[\s\S]*?^\}/m);
    const fnBody = groupMatch ? groupMatch[0] : '';

    assert(
        fnBody.includes("getAttribute('aria-selected')"),
        '校验 aria-selected 属性判断是否选中'
    );
    assert(
        fnBody.includes("'true'"),
        '判断 aria-selected 是否为 "true"'
    );
});

test('有降级机制', () => {
    const groupMatch = page3Src.match(/async function fillGroupPage3[\s\S]*?^\}/m);
    const fnBody = groupMatch ? groupMatch[0] : '';

    assert(
        fnBody.includes('nativeMouseClick(treeItem)'),
        'aria-selected 不为 true 时使用 nativeMouseClick 降级'
    );
    assert(
        fnBody.includes('sleep3(500)'),
        '降级后也等待 500ms'
    );
});

test('else 分支保持不变', () => {
    const page3Src = fs.readFileSync(PAGE3_PATH, 'utf-8');
    assert(
        page3Src.includes("} else {\n            await realClick(foundOption);\n        }\n        await sleep3(500);"),
        '找不到 treeItem 时仍点击 foundOption'
    );
});

test('不影响现有流程', () => {
    assert(
        page3Src.includes("results.push('✅ 商品分组 = ' + foundName)"),
        '选中后仍输出成功日志'
    );
    assert(
        page3Src.includes("results.push('⚠️ 商品分组: 未找到匹配选项')"),
        '未找到时仍输出警告日志'
    );
    assert(
        page3Src.includes("document.body.click()"),
        '最终仍关闭弹窗'
    );
});

console.log('\n' + '='.repeat(50));
console.log(`通过: ${passed}  失败: ${failed}  总计: ${passed + failed}`);

if (failed > 0) {
    process.exit(1);
}
