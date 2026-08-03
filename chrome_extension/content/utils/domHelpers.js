// DOM辅助函数 - 滚动、等待、点击确认等通用操作
//
// 依赖文件(按加载顺序):
//   1. common.js - 通用函数: log, findFieldContainer
//   2. configs/waitTimes.js - 等待时间配置: waitTimes.get(), wait()

/**
 * 滚动到元素并等待渲染
 * @param {Element} element - 目标元素
 * @param {Object} options - 配置选项
 * @param {number} options.waitTime - 滚动后等待时间(默认300ms)
 * @param {string} options.block - 滚动位置(默认'center')
 */
async function scrollAndWait(element, options = {}) {
    if (!element) return false;
    
    const times = waitTimes.get();
    const waitTime = options.waitTime || times.scroll.after;
    const block = options.block || 'center';
    
    element.scrollIntoView({ block, behavior: 'instant' });
    await wait(waitTime);
    
    return true;
}

/**
 * 等待元素渲染
 * @param {Function} findFn - 查找元素的函数
 * @param {Object} options - 配置选项
 * @param {number} options.maxWait - 最大等待时间(默认5000ms)
 * @param {number} options.interval - 轮询间隔(默认200ms)
 * @returns {Element|null} 找到的元素或null
 */
async function waitForElement(findFn, options = {}) {
    const times = waitTimes.get();
    const maxWait = options.maxWait || times.province.maxWait;
    const interval = options.interval || times.province.interval;
    
    let elapsed = 0;
    while (elapsed < maxWait) {
        const el = findFn();
        if (el && el.offsetParent !== null && el.offsetWidth > 0) {
            return el;
        }
        await wait(interval);
        elapsed += interval;
    }
    
    return null;
}

/**
 * 点击元素并触发确认事件
 * @param {Element} element - 目标元素
 * @param {Object} options - 配置选项
 * @param {boolean} options.blur - 是否触发blur事件(默认true)
 */
async function clickAndConfirm(element, options = {}) {
    if (!element) return false;
    
    const times = waitTimes.get();
    const shouldBlur = options.blur !== false;
    
    // 模拟鼠标点击
    const rect = element.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    
    element.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, clientX: x, clientY: y }));
    element.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, clientX: x, clientY: y }));
    element.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, clientX: x, clientY: y }));
    
    element.focus?.();
    
    if (shouldBlur) {
        await wait(times.field.confirm);
        element.dispatchEvent(new FocusEvent('blur', { bubbles: true }));
        await wait(times.field.blur);
    }
    
    return true;
}

/**
 * 批量填入字段并返回统计结果
 * @param {Array} fields - 字段列表 [{lbl, val, fallback}]
 * @param {Function} fillFn - 单字段填入函数
 * @returns {Object} 统计结果 {successCount, failCount, results}
 */
async function fillFieldBatch(fields, fillFn) {
    const results = [];
    let successCount = 0;
    let failCount = 0;
    
    for (const field of fields) {
        if (!field.val) continue;
        
        const result = await fillFn(field);
        results.push(result);
        
        if (result.ok) {
            successCount++;
        } else {
            failCount++;
        }
        
        // 特殊处理：原产地后等待省份字段
        if (field.lbl === '原产地') {
            log('⏳ 原产地已填，等待省份字段渲染...', 'info');
            const provinceContainer = await waitForElement(() => findFieldContainer('', '省份'));
            if (provinceContainer) {
                log('ℹ️ 省份字段已渲染', 'info');
            } else {
                log('⚠️ 省份字段未在5秒内渲染', 'warn');
            }
        }
    }
    
    return { successCount, failCount, results };
}

/**
 * 重新点击确认所有已填字段
 * @param {Array} fields - 已填字段列表
 */
async function reconfirmAllFields(fields) {
    log('🔄 重新点击确认所有属性输入框...', 'info');
    let count = 0;
    
    for (const field of fields) {
        if (!field.val) continue;
        
        const container = findFieldContainer('', field.lbl);
        if (!container) continue;
        
        await scrollAndWait(container, { waitTime: 100 });
        
        const inp = container.querySelector('input:not([readonly]):not([type="hidden"])');
        if (inp) {
            inp.focus();
            await clickAndConfirm(inp, { blur: true });
            count++;
            continue;
        }
        
        const trigger = container.querySelector('.next-select-trigger');
        if (trigger) {
            await clickAndConfirm(trigger, { blur: true });
            count++;
        }
    }
    
    log(`✅ 重点击确认完成，共 ${count} 个字段`, 'success');
}

/**
 * 滚动查找元素(多次尝试)
 * @param {Function} findFn - 查找元素的函数
 * @param {Object} options - 配置选项
 * @param {number} options.maxAttempts - 最大尝试次数(默认6)
 * @param {number} options.scrollStep - 每次滚动距离(默认400)
 * @returns {Element|null} 找到的元素或null
 */
async function scrollAndFind(findFn, options = {}) {
    const times = waitTimes.get();
    const maxAttempts = options.maxAttempts || 6;
    const scrollStep = options.scrollStep || 400;
    
    for (let i = 0; i < maxAttempts; i++) {
        const el = findFn();
        if (el) {
            await scrollAndWait(el);
            const el2 = findFn();
            if (el2) return el2;
            return el;
        }
        window.scrollBy(0, scrollStep);
        await wait(times.scroll.between);
    }
    
    const el = findFn();
    if (el) {
        await scrollAndWait(el);
    }
    return el;
}

/**
 * 关闭所有覆盖层
 */
async function closeOverlays() {
    const times = waitTimes.get();
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', keyCode: 27, bubbles: true }));
    await wait(times.overlay.keydown);
    document.body.dispatchEvent(new KeyboardEvent('keyup', { key: 'Escape', keyCode: 27, bubbles: true }));
    await wait(times.overlay.keyup);
    
    const overlays = document.querySelectorAll('.next-overlay-wrapper, .next-overlay');
    for (const ov of overlays) {
        if (ov.offsetHeight > 0) {
            ov.style.display = 'none';
        }
    }
    await wait(times.overlay.hide);
}

// 导出
if (typeof window !== 'undefined') {
    window.domHelpers = {
        scrollAndWait,
        waitForElement,
        clickAndConfirm,
        fillFieldBatch,
        reconfirmAllFields,
        scrollAndFind,
        closeOverlays
    };
}