// 测试确认按钮文案判定（utils/confirmText.js 的 isConfirmText 纯函数）
// 该规则是模板/尺码弹窗"点确认"的单一真源，page3 与这里共用同一份实现。
const { isConfirmText } = require('../chrome_extension/content/utils/confirmText.js');

let passed = 0;
let failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✓ ' + msg); passed++; }
    else { console.log('  ✗ ' + msg); failed++; }
}
function t(name, cond) { assert(cond, name); }

console.log('\n[确认按钮文案 isConfirmText]');
t('「确定」是确认按钮', isConfirmText('确定') === true);
t('「确认」是确认按钮', isConfirmText('确认') === true);
t('「Confirm」是确认按钮', isConfirmText('Confirm') === true);
t('「OK」是确认按钮', isConfirmText('OK') === true);
t('「Ok」是确认按钮', isConfirmText('Ok') === true);
t('首尾空白不影响判定', isConfirmText('  确定  ') === true);

t('「取消」不是确认按钮', isConfirmText('取消') === false);
t('「保存」不是确认按钮', isConfirmText('保存') === false);
t('空字符串不是确认按钮', isConfirmText('') === false);
t('null 不是确认按钮', isConfirmText(null) === false);
t('undefined 不是确认按钮', isConfirmText(undefined) === false);

console.log(`\n结果: passed=${passed} failed=${failed}`);
process.exit(failed === 0 ? 0 : 1);