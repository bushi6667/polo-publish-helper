// 测试 doubao.js 的生成失败/被拒检测逻辑（isGenerationErrorText 纯函数）
// 用 vm 在桩环境中执行豆包 content 脚本，直接调用其顶层纯函数验证判定规则。
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'chrome_extension', 'content', 'doubao.js'), 'utf-8');

let passed = 0;
let failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✓ ' + msg); passed++; }
    else { console.log('  ✗ ' + msg); failed++; }
}

// 最小可运行的浏览器桩，满足 doubao.js 顶层仅注册监听、不真正操作 DOM
const sandbox = {
    console: { log() {}, warn() {}, error() {} },
    document: { addEventListener() {}, querySelector: () => null, querySelectorAll: () => [], createElement: () => ({ style: {}, set textContent(_) {}, appendChild() {}, remove() {} }) },
    window: {},
    location: { href: 'https://www.doubao.com/chat/' },
    chrome: {
        runtime: {
            onMessage: { addListener() {} },
            sendMessage() { return Promise.resolve(undefined); },
            lastError: null
        }
    },
    setTimeout: () => 0, clearTimeout: () => {}, setInterval: () => 0, clearInterval: () => {},
    Map, Set, Event: class Event {}, MouseEvent: class MouseEvent {}, KeyboardEvent: class KeyboardEvent {},
    Promise, Date, Math, JSON, Number, String, Array, Object
};
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(SRC, sandbox, { filename: 'doubao.js' });

const f = sandbox.isGenerationErrorText;

function t(name, cond) { assert(cond, name); }

console.log('\n[生成失败检测 isGenerationErrorText]');
t('AI 消息含「生成失败」→ 判定错误', f('生成失败了，请重试', true, false) === true);
t('AI 消息含「无法生成」→ 判定错误', f('抱歉，无法生成你要求的内容', true, false) === true);
t('EN 消息含 "generation failed" → 判定错误', f('generation failed', true, false) === true);
t('EN 消息含 "is not allowed" → 判定错误', f('this content is not allowed', true, false) === true);

t('用户消息即使含「生成失败」也不算错误', f('帮我看看生成失败的原因', false, false) === false);
t('AI 正在生成中（hasLoading=true）不算错误', f('正在生成中，请稍候', true, true) === false);
t('AI 正常生成内容不算错误', f('已按你的要求生成 4 张新图，请查收', true, false) === false);
t('文本为空不算错误', f('', true, false) === false);

// 过宽词汇必须不误判：这些是良性回复，不能触发"生成失败"早退
t('良性「未能」不误判', f('未能完全匹配参考图，已按常规风格生成', true, false) === false);
t('良性「抱歉」不误判', f('抱歉，让我为你重新生成一组', true, false) === false);
t('良性「失败了」不误判', f('上次失败了，这次重新生成', true, false) === false);
t('单个 "error"/"failed" 不误判（太泛）', f('an error occurred, retrying', true, false) === false);
t('道歉开头若带硬性失败词才判定', f('sorry, generation failed, retry', true, false) === true);

console.log(`\n结果: passed=${passed} failed=${failed}`);
process.exit(failed === 0 ? 0 : 1);