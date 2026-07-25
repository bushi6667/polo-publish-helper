const fs = require('fs');
const path = require('path');

const PAGE3_PATH = path.join(__dirname, '..', 'chrome_extension', 'content', 'page3.js');
const UPLOAD_PATH = path.join(__dirname, '..', 'chrome_extension', 'upload', 'page3_upload.js');

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
const uploadSrc = fs.readFileSync(UPLOAD_PATH, 'utf-8');

test('fillImagesPage3 异步等待模式', () => {
    assert(
        page3Src.includes("action === 'uploadResult'"),
        'fillImagesPage3 监听 uploadResult 消息'
    );
    assert(
        page3Src.includes("chrome.runtime.onMessage.removeListener"),
        '收到结果后移除监听器，避免内存泄漏'
    );
    assert(
        page3Src.includes("'✅ 主图上传成功'"),
        '上传成功时返回 ✅ 主图上传成功'
    );
    assert(
        page3Src.includes("'❌ 主图上传失败"),
        '上传失败时返回 ❌ 主图上传失败'
    );
    assert(
        page3Src.includes("'⏳ 主图上传中，请稍候...'"),
        '仍保留上传中的提示信息'
    );
});

test('菜单项结果判断 - 上传主图会有成功项', () => {
    const fillFnMatch = page3Src.match(/async function fillImagesPage3[\s\S]*?^\}/m);
    const fnBody = fillFnMatch ? fillFnMatch[0] : '';

    assert(
        fnBody.includes("✅ 主图上传成功"),
        '函数返回结果中包含 ✅ 成功项，菜单项不会误判"未完成"'
    );
});

test('waitForPage3UploadImages 检测更准确', () => {
    assert(
        uploadSrc.includes('countRealImages'),
        '使用 countRealImages 函数精确统计'
    );
    assert(
        uploadSrc.includes("startsWith('data:image/svg')"),
        '排除 SVG 小图标'
    );
    assert(
        uploadSrc.includes("naturalWidth < 20"),
        '排除尺寸过小的装饰图标'
    );
    assert(
        uploadSrc.includes("includes('placeholder')"),
        '排除占位符图标'
    );
    assert(
        uploadSrc.includes(".image-upload-list-item, .image-item"),
        '只在列表项范围内查找图片'
    );
    assert(
        !uploadSrc.match(/querySelectorAll\('img, \.image-upload-list-item/),
        '不再使用宽泛的 img 选择器一次性统计'
    );
});

test('日志文案优化', () => {
    assert(
        uploadSrc.includes('已定位到上传区域'),
        'upload-select-inner 改为用户易懂的描述'
    );
    assert(
        !uploadSrc.includes('upload-select-inner: ${'),
        '不再输出 upload-select-inner: true/false 技术术语'
    );
    assert(
        uploadSrc.includes('正在查找上传文件选择器'),
        '"方式A：查找 file input" 改为友好描述'
    );
    assert(
        uploadSrc.includes('文件已注入上传组件'),
        '"方式A 注入成功 (objectId)" 改为友好描述'
    );
});

test('不影响现有功能 - fillAllPage3 不调用 fillImagesPage3', () => {
    const fillAllMatch = page3Src.match(/async function fillAllPage3[\s\S]*?^\}/m);
    const fnBody = fillAllMatch ? fillAllMatch[0] : '';

    assert(
        !fnBody.includes('fillImagesPage3'),
        'fillAllPage3 全量填入不调用 fillImagesPage3，不会被上传阻塞'
    );
});

test('不影响现有功能 - 菜单项 actionMap 不变', () => {
    assert(
        page3Src.includes("fill_images: fillImagesPage3"),
        '菜单项 actionMap 中 fill_images 仍映射到 fillImagesPage3'
    );
});

console.log('\n' + '='.repeat(50));
console.log(`通过: ${passed}  失败: ${failed}  总计: ${passed + failed}`);

if (failed > 0) {
    process.exit(1);
}
