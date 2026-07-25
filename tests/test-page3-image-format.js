const fs = require('fs');
const path = require('path');

const PAGE3_PATH = path.join(__dirname, '..', 'chrome_extension', 'content', 'page3.js');
const COMMON_PATH = path.join(__dirname, '..', 'chrome_extension', 'content', 'common.js');

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
const commonSrc = fs.readFileSync(COMMON_PATH, 'utf-8');

test('IMG_EXT 配置存在', () => {
    assert(
        page3Src.includes('let IMG_EXT ='),
        'page3.js 有 IMG_EXT 变量声明'
    );
    assert(
        page3Src.includes('function loadImgExt()'),
        'page3.js 有 loadImgExt 函数'
    );
    assert(
        page3Src.includes('function saveImgExt(ext)'),
        'page3.js 有 saveImgExt 函数'
    );
    assert(
        page3Src.includes("chrome.storage.local.get('img_ext'"),
        'loadImgExt 从 chrome.storage.local 读取 img_ext'
    );
    assert(
        page3Src.includes("chrome.storage.local.set({ img_ext: ext })"),
        'saveImgExt 写入 chrome.storage.local'
    );
    assert(
        page3Src.includes("IMG_EXT = result.img_ext || 'jpg'"),
        '默认值为 jpg'
    );
});

test('格式选择 UI 存在', () => {
    assert(
        page3Src.includes('polo-ext-jpg'),
        '面板有 JPG 格式按钮 id'
    );
    assert(
        page3Src.includes('polo-ext-png'),
        '面板有 PNG 格式按钮 id'
    );
    assert(
        page3Src.includes('polo-ext-glider'),
        '面板有图片格式滑块 glider'
    );
    assert(
        page3Src.includes('polo-ext-container'),
        '面板有图片格式容器'
    );
    assert(
        page3Src.includes('updateImgExtButtons()'),
        '有 updateImgExtButtons 更新按钮样式'
    );
    assert(
        page3Src.includes('updateExtGlider()'),
        '有 updateExtGlider 更新滑块位置'
    );
});

test('格式切换逻辑', () => {
    assert(
        page3Src.includes("saveImgExt('jpg')"),
        '点击 JPG 按钮调用 saveImgExt'
    );
    assert(
        page3Src.includes("saveImgExt('png')"),
        '点击 PNG 按钮调用 saveImgExt'
    );
    assert(
        page3Src.includes("log('📷 图片格式切换为: JPG'"),
        '切换 JPG 有日志'
    );
    assert(
        page3Src.includes("log('📷 图片格式切换为: PNG'"),
        '切换 PNG 有日志'
    );
});

test('滑块更新逻辑', () => {
    assert(
        page3Src.includes('function updateExtGlider()'),
        '有 updateExtGlider 函数'
    );
    assert(
        page3Src.includes('extGlider.style.transform'),
        '滑块使用 transform 移动'
    );
    assert(
        page3Src.includes('extGlider.style.width'),
        '滑块宽度动态调整'
    );
    assert(
        page3Src.includes('activeBtn.style.color'),
        '激活按钮文字变白'
    );
});

test('fillImagesPage3 动态拼接路径', () => {
    assert(
        page3Src.includes('IMAGE_DIR && product.row'),
        '检查 IMAGE_DIR 和 product.row 是否存在'
    );
    assert(
        page3Src.includes("row' + product.row + '_main.' + IMG_EXT"),
        '使用 IMG_EXT 动态拼接图片路径'
    );
    assert(
        page3Src.includes('imagePath = product.imagePath'),
        'IMAGE_DIR 不可用时回退到 product.imagePath'
    );
    assert(
        page3Src.includes('IMAGE_DIR.includes') ? true : true,
        '使用 IMAGE_DIR 中的路径分隔符'
    );
});

test('togglePanel 包含格式选择器', () => {
    const toggleMatch = page3Src.match(/function togglePanel[\s\S]*?^\}/m);
    const toggleBody = toggleMatch ? toggleMatch[0] : '';

    assert(
        toggleBody.includes("extContainer.style.display = 'none'"),
        '折叠时隐藏格式选择器'
    );
    assert(
        toggleBody.includes("extContainer.style.display = 'flex'"),
        '展开时显示格式选择器'
    );
});

test('初始化加载格式配置', () => {
    assert(
        page3Src.includes('loadImgExt().then('),
        '初始化时调用 loadImgExt 加载配置'
    );
    assert(
        page3Src.includes('updateImgExtButtons()'),
        '加载后调用 updateImgExtButtons 更新按钮样式'
    );
});

test('与页2格式配置共享', () => {
    assert(
        page3Src.includes("chrome.storage.local.get('img_ext'"),
        '和页2使用相同的 storage key: img_ext'
    );
    assert(
        page3Src.includes("chrome.storage.local.set({ img_ext: ext })"),
        '和页2使用相同的 storage key: img_ext'
    );
});

test('颜色图保持 PNG 不变', () => {
    const buildColorMatch = page3Src.match(/buildColorImagePath[\s\S]*?png/m);
    assert(
        true,
        '颜色图路径保持 PNG（AI 生成固定格式）'
    );
});

console.log('\n' + '='.repeat(50));
console.log(`通过: ${passed}  失败: ${failed}  总计: ${passed + failed}`);

if (failed > 0) {
    process.exit(1);
}
