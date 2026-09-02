// ============================================================
// confirmText —— 确认类按钮文案的单一真源
// 用途：模板/尺码选择弹窗中判断哪个按钮是"确认"（中英文），rule 仅定义一处，
//       page3 的 dismissConfirmDialog 与单元测试都引用这里，避免规则漂移。
// 双导出：浏览器挂到 window.isConfirmText，Node 测试可 require()。
// ============================================================
function isConfirmText(text) {
    const t = String(text == null ? '' : text).trim();
    return t === '确定' || t === '确认' || t === 'Confirm' || t === 'OK' || t === 'Ok';
}

if (typeof window !== 'undefined') {
    window.isConfirmText = isConfirmText;
}
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { isConfirmText };
}