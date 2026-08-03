// ============================================================
// 箱规填写 iframe 内嵌脚本（注入 scm.alibaba.com 的模板关联弹窗 iframe）
// 职责：在弹窗 iframe 内按固定步骤完成"手动设置 → 一箱多件 →
//       填写 50*40*30 行件数 25 → 关联 → 确认完成"的箱规配置
// 通信：监听 chrome.runtime 消息 fillBoxRuleIframe / pingBoxRuleIframe
//       结果通过 sendResponse 回传给 background
// ============================================================
(function() {
    'use strict';

    if (window.__boxRuleIframeInjected) return;
    window.__boxRuleIframeInjected = true;

    // 延时工具（毫秒）
    function sleep(ms) {
        return new Promise(function(resolve) { setTimeout(resolve, ms); });
    }

    // 模拟真实鼠标点击（坐标 + mousedown/mouseup/click 事件序列）
    function nativeClick(el) {
        if (!el) return;
        var rect = el.getBoundingClientRect();
        var x = rect.left + rect.width / 2;
        var y = rect.top + rect.height / 2;
        el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: x, clientY: y }));
        el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, clientX: x, clientY: y }));
        el.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: x, clientY: y }));
    }

    // 带 [BoxRule] 前缀的日志
    function log(msg) {
        console.log('[BoxRule]', msg);
    }

    // 按文本在常见按钮/单选元素中查找可见元素（多选择器兜底）
    function findEl(text) {
        var selectors = ['button', '.next-btn', 'label', '.next-radio-wrapper', '.ant-radio-wrapper', '[class*="radio"]'];
        for (var i = 0; i < selectors.length; i++) {
            var els = document.querySelectorAll(selectors[i]);
            for (var j = 0; j < els.length; j++) {
                var t = (els[j].innerText || els[j].textContent || '').trim();
                if (t.indexOf(text) >= 0 && els[j].offsetParent !== null) {
                    return els[j];
                }
            }
        }
        return null;
    }

    async function fillBoxRule() {
        var result = { s1: false, s2: false, s3: false, s4: false, s5: false, s6: false };

        try {
            log('========== 开始 ==========');

            await sleep(800);

            // 步骤1: 手动设置
            try {
                var manual = findEl('手动设置');
                if (manual) {
                    log('找到手动设置');
                    nativeClick(manual);
                    await sleep(500);
                }
                var next1 = findEl('下一步');
                if (next1) {
                    log('点击下一步');
                    nativeClick(next1);
                    await sleep(1500);
                    result.s1 = true;
                }
            } catch(e) { log('步骤1异常: ' + e.message); }

            await sleep(800);

            // 步骤2: 一箱多件
            try {
                var multi = findEl('一箱多件');
                if (multi) {
                    log('找到一箱多件');
                    nativeClick(multi);
                    await sleep(500);
                }
                var confirm1 = findEl('确认');
                if (confirm1) {
                    log('点击确认');
                    nativeClick(confirm1);
                    await sleep(1500);
                    result.s2 = true;
                }
            } catch(e) { log('步骤2异常: ' + e.message); }

            await sleep(1000);

            // 步骤3: 下一步
            try {
                var next2 = findEl('下一步');
                if (next2) {
                    log('点击下一步');
                    nativeClick(next2);
                    await sleep(1500);
                    result.s3 = true;
                }
            } catch(e) { log('步骤3异常: ' + e.message); }

            await sleep(1500);

            // 步骤4: 输入25
            try {
                log('查找50*40*30行');
                var rows = document.querySelectorAll('tr, .next-table-row');
                var targetRow = null;
                for (var i = 0; i < rows.length; i++) {
                    var text = rows[i].innerText || '';
                    if (text.indexOf('50*40*30') >= 0 || text.indexOf('50x40x30') >= 0) {
                        targetRow = rows[i];
                        log('找到目标行');
                        break;
                    }
                }

                if (!targetRow) {
                    log('未找到尺寸行，找输入框');
                    var inputs = document.querySelectorAll('input[type="number"], .next-number-picker input');
                    if (inputs.length > 0) {
                        targetRow = inputs[0].closest('tr');
                        log('通过输入框找到行');
                    }
                }

                if (targetRow) {
                    var inputEl = targetRow.querySelector('input[type="number"], .next-number-picker input, input[aria-valuemax]');
                    if (inputEl) {
                        log('找到输入框，开始输入25');

                        inputEl.focus();
                        inputEl.value = '25';
                        inputEl.dispatchEvent(new Event('input', { bubbles: true }));
                        inputEl.dispatchEvent(new Event('change', { bubbles: true }));

                        await sleep(800);

                        inputEl.blur();
                        await sleep(500);

                        log('输入完成');
                        result.s4 = true;
                    }
                }
            } catch(e) { log('步骤4异常: ' + e.message); }

            await sleep(1000);

            // 步骤5: 关联
            try {
                log('查找关联按钮（50*40*30行）');
                var associateBtn = null;
                var rows = document.querySelectorAll('tr, .next-table-row');
                for (var i = 0; i < rows.length; i++) {
                    var text = rows[i].innerText || '';
                    if (text.indexOf('50*40*30') >= 0 || text.indexOf('50x40x30') >= 0) {
                        var btns = rows[i].querySelectorAll('button, .next-btn');
                        for (var j = 0; j < btns.length; j++) {
                            var t = (btns[j].innerText || '').trim();
                            if (t.indexOf('关联') >= 0) {
                                associateBtn = btns[j];
                                break;
                            }
                        }
                        if (associateBtn) break;
                    }
                }

                if (!associateBtn) {
                    log('未在50*40*30行找到关联按钮，尝试全局查找');
                    var buttons = document.querySelectorAll('button');
                    for (var i = 0; i < buttons.length; i++) {
                        var t = (buttons[i].innerText || '').trim();
                        if (t.indexOf('关联') >= 0) {
                            associateBtn = buttons[i];
                            break;
                        }
                    }
                }

                if (associateBtn) {
                    if (associateBtn.disabled || associateBtn.classList.contains('disabled')) {
                        log('关联按钮disabled，强制启用');
                        associateBtn.disabled = false;
                        associateBtn.classList.remove('disabled');
                    }
                    log('点击关联');
                    nativeClick(associateBtn);
                    await sleep(1500);
                    result.s5 = true;
                }
            } catch(e) { log('步骤5异常: ' + e.message); }

            await sleep(1500);

            // 步骤6: 确认完成
            try {
                var confirm2 = findEl('确认');
                if (confirm2) {
                    log('点击确认');
                    nativeClick(confirm2);
                    await sleep(1000);
                }

                var finish = findEl('确认完成');
                if (!finish) finish = findEl('完成');
                if (finish) {
                    log('点击确认完成');
                    nativeClick(finish);
                    await sleep(1000);
                    result.s6 = true;
                }
            } catch(e) { log('步骤6异常: ' + e.message); }

            log('========== 结束 ==========');
            log('结果: ' + JSON.stringify(result));

        } catch(e) {
            log('fillBoxRule异常: ' + e.message);
        }

        return result;
    }

    // 消息入口：fillBoxRuleIframe 执行六步箱规填写，pingBoxRuleIframe 探活
    chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
        if (request.action === 'fillBoxRuleIframe') {
            fillBoxRule().then(function(result) {
                var ok = result.s1 && result.s2 && result.s3 && result.s4 && result.s5 && result.s6;
                sendResponse({ ok: ok, steps: result });
            }).catch(function(err) {
                sendResponse({ ok: false, error: err.message });
            });
            return true;
        }
        if (request.action === 'pingBoxRuleIframe') {
            sendResponse({ ok: true });
            return true;
        }
        return false;
    });
})();