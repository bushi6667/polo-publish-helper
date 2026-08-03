// 配置导入导出 + 路径解析单元测试
// 对应 chrome_extension/popup.js 中的 resolveHelperPath / pathToFileUrl / 导入校验逻辑
// 运行：node tests/test-config-io.js
//
// 说明：popup.js 依赖 chrome.* / document 等 API，无法直接在 node 中 require。
// 本测试把可测的纯逻辑（路径正则、payload 校验）独立实现并断言，
// 与 popup.js 中的实现保持行为一致；如 popup.js 逻辑变更需同步更新此处。

const assert = require('assert');

// ---------- 被测纯函数（与 popup.js 保持行为一致） ----------

// 模拟 chrome.runtime.getURL：扩展根目录映射为 chrome-extension://<id>/
function makeResolveHelperUrl(extensionId) {
    return function (raw) {
        if (!raw) return '';
        const trimmed = raw.trim();
        if (/^[A-Za-z]:[\\/]/.test(trimmed) || trimmed.startsWith('/') || trimmed.startsWith('file://')) {
            return trimmed;
        }
        return `chrome-extension://${extensionId}/${trimmed.replace(/^\.\//, '')}`;
    };
}

function pathToFileUrl(path, extensionId) {
    const resolveHelperPath = makeResolveHelperUrl(extensionId);
    const resolved = resolveHelperPath(path);
    if (resolved.startsWith('file://') || resolved.startsWith('chrome-extension://')) {
        return resolved;
    }
    return 'file:///' + resolved.replace(/\\/g, '/').replace(/^\//, '');
}

// 校验导入 payload：必须含 __type === 'polo-config-export' 且 data 为对象
function validateImportPayload(parsed) {
    if (!parsed || typeof parsed !== 'object') {
        return { ok: false, error: '根节点不是对象' };
    }
    if (parsed.__type !== 'polo-config-export') {
        return { ok: false, error: '缺少 polo-config-export 标识' };
    }
    if (!parsed.data || typeof parsed.data !== 'object') {
        return { ok: false, error: 'data 字段缺失或非对象' };
    }
    return { ok: true };
}

// ---------- 测试用例 ----------

let passed = 0;
let failed = 0;

function test(name, fn) {
    try {
        fn();
        passed++;
        console.log(`  ✅ ${name}`);
    } catch (e) {
        failed++;
        console.log(`  ❌ ${name}`);
        console.log(`     ${e.message}`);
    }
}

console.log('\n[路径解析 resolveHelperPath / pathToFileUrl]');

const EXT_ID = 'abcdefg1234567890abcdef';

test('Windows 绝对路径原样返回（盘符开头）', () => {
    const r = makeResolveHelperUrl(EXT_ID)('C:\\Users\\test\\发品助手.html');
    assert.strictEqual(r, 'C:\\Users\\test\\发品助手.html');
});

test('Unix 绝对路径原样返回（/ 开头）', () => {
    const r = makeResolveHelperUrl(EXT_ID)('/home/user/发品助手.html');
    assert.strictEqual(r, '/home/user/发品助手.html');
});

test('file:// 协议路径原样返回', () => {
    const r = makeResolveHelperUrl(EXT_ID)('file:///C:/Users/test/发品助手.html');
    assert.strictEqual(r, 'file:///C:/Users/test/发品助手.html');
});

test('相对路径基于扩展根目录解析', () => {
    const r = makeResolveHelperUrl(EXT_ID)('发品助手.html');
    assert.strictEqual(r, `chrome-extension://${EXT_ID}/发品助手.html`);
});

test('相对路径 ./ 前缀被剥离', () => {
    const r = makeResolveHelperUrl(EXT_ID)('./发品助手.html');
    assert.strictEqual(r, `chrome-extension://${EXT_ID}/发品助手.html`);
});

test('空字符串返回空', () => {
    const r = makeResolveHelperUrl(EXT_ID)('');
    assert.strictEqual(r, '');
});

test('pathToFileUrl: Windows 绝对路径转 file:/// URL', () => {
    const u = pathToFileUrl('C:\\Users\\test\\发品助手.html', EXT_ID);
    assert.strictEqual(u, 'file:///C:/Users/test/发品助手.html');
});

test('pathToFileUrl: 相对路径转 chrome-extension:// URL', () => {
    const u = pathToFileUrl('发品助手.html', EXT_ID);
    assert.strictEqual(u, `chrome-extension://${EXT_ID}/发品助手.html`);
});

test('pathToFileUrl: 已带 file:// 前缀不重复转换', () => {
    const u = pathToFileUrl('file:///C:/x/y.html', EXT_ID);
    assert.strictEqual(u, 'file:///C:/x/y.html');
});

console.log('\n[导入 payload 校验 validateImportPayload]');

test('合法 payload 通过', () => {
    const r = validateImportPayload({
        __type: 'polo-config-export',
        __version: 1,
        __exportedAt: '2026-07-31T00:00:00.000Z',
        data: { polo_helper_path: 'C:\\x' }
    });
    assert.strictEqual(r.ok, true);
});

test('缺 __type 字段失败', () => {
    const r = validateImportPayload({ data: {} });
    assert.strictEqual(r.ok, false);
    assert.match(r.error, /polo-config-export/);
});

test('__type 值错误失败', () => {
    const r = validateImportPayload({ __type: 'something-else', data: {} });
    assert.strictEqual(r.ok, false);
});

test('缺 data 字段失败', () => {
    const r = validateImportPayload({ __type: 'polo-config-export' });
    assert.strictEqual(r.ok, false);
    assert.match(r.error, /data/);
});

test('data 为非对象失败', () => {
    const r = validateImportPayload({ __type: 'polo-config-export', data: 'not-object' });
    assert.strictEqual(r.ok, false);
});

test('根节点非对象失败', () => {
    const r = validateImportPayload(null);
    assert.strictEqual(r.ok, false);
    const r2 = validateImportPayload('string');
    assert.strictEqual(r2.ok, false);
});

// ---------- 端到端：导出 → 导入往返 ----------

console.log('\n[端到端：导出 → 导入往返]');

test('导出 payload 能通过导入校验', () => {
    // 模拟 popup.js export-config 的输出
    const storageSnapshot = {
        polo_helper_path: 'C:\\Users\\me\\发品助手.html',
        polo_helper_path_history: ['C:\\Users\\me\\发品助手.html'],
        polo_color_img_dir: 'D:\\颜色图',
        polo_color_img_dir_history: ['D:\\颜色图'],
        current_filename: 'test.xlsx',
        polo_image_dir: 'D:\\imgs',
        polo_last_config: { colorImgDir: 'D:\\颜色图', helperPath: 'C:\\Users\\me\\发品助手.html' }
    };
    const payload = {
        __type: 'polo-config-export',
        __version: 1,
        __exportedAt: new Date().toISOString(),
        data: storageSnapshot
    };
    // 模拟 JSON 序列化 → 反序列化（导出文件再读回）
    const roundtrip = JSON.parse(JSON.stringify(payload));
    const r = validateImportPayload(roundtrip);
    assert.strictEqual(r.ok, true);
    assert.strictEqual(roundtrip.data.polo_helper_path, 'C:\\Users\\me\\发品助手.html');
    assert.deepStrictEqual(roundtrip.data.polo_helper_path_history, ['C:\\Users\\me\\发品助手.html']);
});

// ---------- 总结 ----------

console.log(`\n----------------------------------------`);
console.log(`通过 ${passed} / 失败 ${failed}`);
console.log(`----------------------------------------\n`);

if (failed > 0) {
    process.exit(1);
}
