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

const source = fs.readFileSync(PAGE3_PATH, 'utf-8');

test('面板默认位置 - left:0', () => {
    assert(
        source.includes('position:fixed;top:60px;left:0;'),
        '面板初始位置为 left:0（左边贴边）'
    );
    assert(
        !source.includes('position:fixed;top:60px;right:20px;'),
        '不再使用 right:20px 定位'
    );
});

test('默认折叠状态', () => {
    // 初始值为 false，由 togglePanel() 翻转为 true 实现默认折叠
    assert(
        source.match(/let\s+isCollapsed\s*=\s*false/),
        'isCollapsed 初始值为 false（由 togglePanel 翻转为 true）'
    );
    assert(
        !source.match(/let\s+isCollapsed\s*=\s*true/),
        'isCollapsed 初始值不为 true（避免 togglePanel 翻转为 false 导致展开）'
    );
});

test('togglePanel 初始调用', () => {
    const createPanelMatch = source.match(/function createPage3Panel\(\)\s*\{[\s\S]*?^\}/m);
    const fnBody = createPanelMatch ? createPanelMatch[0] : '';

    const toggleCallCount = (fnBody.match(/togglePanel\(\)/g) || []).length;
    assert(
        toggleCallCount >= 1,
        `createPage3Panel 中调用了 togglePanel()（找到 ${toggleCallCount} 次）`
    );
});

test('折叠时隐藏的元素', () => {
    const toggleFnMatch = source.match(/function togglePanel\(\)\s*\{[\s\S]*?^\}/m);
    const fnBody = toggleFnMatch ? toggleFnMatch[0] : '';

    ['pasteBtn', 'autofillBtn', 'dropdownBtn', 'actionMenu', 'logArea'].forEach(name => {
        assert(
            fnBody.includes(`${name}.style.display = 'none'`),
            `折叠时隐藏 ${name}`
        );
    });
});

test('折叠时保留的元素', () => {
    const toggleFnMatch = source.match(/function togglePanel\(\)\s*\{[\s\S]*?^\}/m);
    const fnBody = toggleFnMatch ? toggleFnMatch[0] : '';

    assert(
        !fnBody.includes('productInfo.style.display'),
        '折叠时不隐藏产品信息区'
    );
});

test('折叠时模式切换区变为一键填入按钮', () => {
    const toggleFnMatch = source.match(/function togglePanel\(\)\s*\{[\s\S]*?^\}/m);
    const fnBody = toggleFnMatch ? toggleFnMatch[0] : '';

    assert(
        fnBody.includes('modeOverwriteBtn.style.display = \'none\''),
        '折叠时隐藏覆盖填入按钮'
    );
    assert(
        fnBody.includes('modeAppendBtn.style.display = \'none\''),
        '折叠时隐藏追加填入按钮'
    );
    assert(
        fnBody.includes('modeGlider.style.display = \'none\''),
        '折叠时隐藏模式滑动指示器'
    );
    assert(
        fnBody.includes('modeFillBtn.style.display = \'block\''),
        '折叠时显示一键填入按钮'
    );
});

test('展开时恢复模式切换区', () => {
    const toggleFnMatch = source.match(/function togglePanel\(\)\s*\{[\s\S]*?^\}/m);
    const fnBody = toggleFnMatch ? toggleFnMatch[0] : '';

    assert(
        fnBody.includes('modeOverwriteBtn.style.display = \'flex\''),
        '展开时显示覆盖填入按钮'
    );
    assert(
        fnBody.includes('modeAppendBtn.style.display = \'flex\''),
        '展开时显示追加填入按钮'
    );
    assert(
        fnBody.includes('modeFillBtn.style.display = \'none\''),
        '展开时隐藏一键填入按钮'
    );
});

test('新模式按钮 HTML 存在', () => {
    assert(
        source.includes('id="polo-mode-fill-btn"'),
        'HTML 中存在 polo-mode-fill-btn 按钮'
    );
    assert(
        source.includes('const modeFillBtn = document.getElementById'),
        'JS 中获取了 modeFillBtn 引用'
    );
});

test('新模式按钮点击事件', () => {
    assert(
        source.includes('modeFillBtn.onclick'),
        'modeFillBtn 绑定了 onclick 事件'
    );
    assert(
        source.includes('autofillBtn.click()'),
        'modeFillBtn 点击时触发原 autofillBtn 的点击事件'
    );
});

test('拖拽兼容性 - left 定位', () => {
    const dragMatch = source.match(/panel\.style\.left\s*=\s*newLeft/);
    assert(
        dragMatch !== null,
        '拖拽逻辑使用 panel.style.left，与 left 初始定位兼容'
    );

    const rightAutoMatch = source.match(/panel\.style\.right\s*=\s*['"]auto['"]/);
    assert(
        rightAutoMatch !== null,
        '拖拽时设置 right:auto，避免与初始 left 冲突'
    );
});

test('折叠宽度', () => {
    assert(
        source.includes(`panel.style.width = '260px'`),
        '折叠时宽度为 260px'
    );
    assert(
        source.includes(`panel.style.width = '380px'`),
        '展开时宽度为 380px'
    );
});

console.log('\n' + '='.repeat(50));
console.log(`通过: ${passed}  失败: ${failed}  总计: ${passed + failed}`);

if (failed > 0) {
    process.exit(1);
}
