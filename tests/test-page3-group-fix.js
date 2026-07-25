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

// 提取 fillGroupPage3 函数体
const groupMatch = page3Src.match(/async function fillGroupPage3[\s\S]*?^\}/m);
const fnBody = groupMatch ? groupMatch[0] : '';

test('方案1: nativeMouseClick 点击 label', () => {
    assert(
        fnBody.includes('nativeMouseClick(labelEl)'),
        '方案1 使用 nativeMouseClick 点击 labelEl'
    );
    assert(
        fnBody.includes("log(`🖱️ 方案1: nativeMouseClick"),
        '方案1 有日志输出'
    );
});

test('方案2: realClick 降级', () => {
    assert(
        fnBody.includes('realClick(treeItem || labelEl)'),
        '方案1 失败后尝试 realClick'
    );
    assert(
        fnBody.includes("log(`🔄 方案1 未生效，尝试方案2"),
        '方案2 有降级日志'
    );
});

test('方案3: nativeMouseClick treeItem', () => {
    assert(
        fnBody.includes("log(`🔄 方案3"),
        '方案3 有降级日志'
    );
    assert(
        fnBody.includes('nativeMouseClick(treeItem)'),
        '方案3 使用 nativeMouseClick 点击 treeItem'
    );
});

test('方案4: 强制触发选中事件', () => {
    assert(
        fnBody.includes('setAttribute'),
        '方案4 强制设置 aria-selected'
    );
    assert(
        fnBody.includes("log(`🔄 方案4"),
        '方案4 有降级日志'
    );
});

test('aria-selected 选中校验', () => {
    assert(
        fnBody.includes("getAttribute('aria-selected')"),
        '校验 aria-selected 属性判断是否选中'
    );
    assert(
        fnBody.includes("=== 'true'"),
        '判断 aria-selected 是否为 "true"'
    );
});

test('选中后有差异化日志', () => {
    assert(
        fnBody.includes('✅ 商品分组 ='),
        '选中后输出成功日志'
    );
    assert(
        fnBody.includes('⚠️ 商品分组 ='),
        '未确认选中时输出警告日志'
    );
});

test('始终关闭下拉菜单', () => {
    const afterClick = fnBody.includes('document.body.click()');
    assert(afterClick, '最终调用 document.body.click() 关闭下拉菜单');
});

test('未找到选项时保持原逻辑', () => {
    assert(
        page3Src.includes("results.push('⚠️ 商品分组: 未找到匹配选项')"),
        '未找到时仍输出警告日志'
    );
});

test('不影响 buildGroupCandidates', () => {
    assert(
        page3Src.includes('buildGroupCandidates(product.category)'),
        '仍然调用 buildGroupCandidates'
    );
    assert(
        page3Src.includes('candidates.join'),
        '仍然输出候选词日志'
    );
});

console.log('\n' + '='.repeat(50));
console.log(`通过: ${passed}  失败: ${failed}  总计: ${passed + failed}`);

if (failed > 0) {
    process.exit(1);
}
