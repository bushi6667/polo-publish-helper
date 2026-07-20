/**
 * @file tests/test-psedit-injection.js
 * @description PS编辑脚本注入可靠性修复测试
 * @module tests/psedit-injection
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const EXT_ROOT = path.join(__dirname, '..');
const bgPath = path.join(EXT_ROOT, 'background.js');
const bgSrc = fs.readFileSync(bgPath, 'utf-8');

let passed = 0;
let failed = 0;

function test(name, fn) {
    try {
        fn();
        console.log(`  ✅ ${name}`);
        passed++;
    } catch (e) {
        console.log(`  ❌ ${name}: ${e.message}`);
        failed++;
    }
}

// ---------- 静态代码检查 ----------

test('waitForTabComplete 函数已定义', () => {
    assert(bgSrc.includes('function waitForTabComplete'), '未找到 waitForTabComplete 定义');
});

test('startPsEdit 不再使用固定 3 秒延迟', () => {
    const idx = bgSrc.indexOf('async function startPsEdit');
    const fnEnd = bgSrc.indexOf('function injectFetchInterceptor', idx);
    const fnBody = bgSrc.slice(idx, fnEnd);
    assert(!fnBody.includes('setTimeout(r, 3000)'), '仍包含固定 3 秒延迟');
});

test('startPsEdit 调用了 waitForTabComplete', () => {
    const idx = bgSrc.indexOf('async function startPsEdit');
    const fnEnd = bgSrc.indexOf('function injectFetchInterceptor', idx);
    const fnBody = bgSrc.slice(idx, fnEnd);
    assert(fnBody.includes('waitForTabComplete(tabId'), '未调用 waitForTabComplete');
});

test('startPsEdit 注入前检查 tab 存在性', () => {
    const idx = bgSrc.indexOf('async function startPsEdit');
    const fnEnd = bgSrc.indexOf('function injectFetchInterceptor', idx);
    const fnBody = bgSrc.slice(idx, fnEnd);
    assert(fnBody.includes('chrome.tabs.get(tabId)'), '未检查 tab 存在性');
});

test('错误处理包含 "标签页已被关闭" 分支', () => {
    const idx = bgSrc.indexOf('async function startPsEdit');
    const fnEnd = bgSrc.indexOf('function injectFetchInterceptor', idx);
    const fnBody = bgSrc.slice(idx, fnEnd);
    assert(fnBody.includes('标签页已被关闭'), '未找到标签页关闭错误处理');
});

test('错误处理包含 "无法访问页面内容" 分支', () => {
    const idx = bgSrc.indexOf('async function startPsEdit');
    const fnEnd = bgSrc.indexOf('function injectFetchInterceptor', idx);
    const fnBody = bgSrc.slice(idx, fnEnd);
    assert(fnBody.includes('无法访问页面内容'), '未找到权限错误处理');
});

// ---------- waitForTabComplete 逻辑单元测试 ----------

/**
 * 在隔离作用域中运行 waitForTabComplete，使用模拟的 chrome API。
 * @returns {object} 包含 promise 和触发方法的对象
 */
function runWaitForTabComplete(tabId, timeoutMs) {
    const listeners = [];
    const mockChrome = {
        tabs: {
            onUpdated: {
                addListener: (fn) => listeners.push(fn),
                removeListener: (fn) => {
                    const i = listeners.indexOf(fn);
                    if (i >= 0) listeners.splice(i, 1);
                }
            }
        }
    };

    // 将函数源码提取并执行
    const fnMatch = bgSrc.match(/function waitForTabComplete\(tabId, timeoutMs = 30000\)[\s\S]*?^\}/m);
    assert(fnMatch, '无法提取 waitForTabComplete 源码');
    const fnSrc = fnMatch[0];

    // 在闭包中执行，注入 mock chrome
    const wrapped = new Function('chrome', 'return ' + fnSrc);
    const waitForTabComplete = wrapped(mockChrome);

    return {
        promise: waitForTabComplete(tabId, timeoutMs),
        trigger: (updatedTabId, changeInfo) => {
            listeners.forEach(fn => fn(updatedTabId, changeInfo));
        },
        listeners
    };
}

test('waitForTabComplete 在 status=complete 时 resolve', async () => {
    const { promise, trigger } = runWaitForTabComplete(123, 5000);
    setTimeout(() => trigger(123, { status: 'complete' }), 10);
    await promise;
});

test('waitForTabComplete 忽略其他 tabId', async () => {
    const { promise, trigger } = runWaitForTabComplete(123, 5000);
    setTimeout(() => {
        trigger(999, { status: 'complete' });
        trigger(123, { status: 'complete' });
    }, 10);
    await promise;
});

test('waitForTabComplete 超时时 reject', async () => {
    const { promise } = runWaitForTabComplete(123, 50);
    try {
        await promise;
        throw new Error('应抛出超时错误');
    } catch (e) {
        assert(e.message.includes('加载超时'), '错误信息应包含加载超时');
    }
});

test('waitForTabComplete resolve 后清理监听器', async () => {
    const { promise, trigger, listeners } = runWaitForTabComplete(123, 5000);
    setTimeout(() => trigger(123, { status: 'complete' }), 10);
    await promise;
    assert.strictEqual(listeners.length, 0, '监听器应已被移除');
});

// ---------- 汇总 ----------

console.log(`\n共 ${passed + failed} 项测试，通过 ${passed}，失败 ${failed}`);
if (failed > 0) process.exit(1);
