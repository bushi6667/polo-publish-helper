// ============================================================
// smartFind —— 智能 DOM 查找工具库（content scripts 共用）
// 解决 1688 发品页 DOM 结构多变的问题：
//   1. 多级选择器候选（配置驱动，见 selectors.js），逐级尝试
//   2. 可见性过滤（隐藏元素不参与匹配）
//   3. 轮询等待（页面异步渲染时等待元素出现）
//   4. 文本/标签/iframe/属性多策略回退
// 对外暴露 window.smartFind（见文件尾部 return 列表）
// ============================================================
const smartFind = (() => {
    let logFn = console.log;

    // 设置日志函数（页面侧可注入自己的 log 实现）
    function setLog(fn) {
        logFn = fn;
    }

    // 统一日志出口，便于全局替换
    function log(...args) {
        logFn.apply(console, args);
    }

    // 依次尝试多个 CSS 选择器，返回第一个可见匹配 {el, sel}；单个选择器解析失败不中断
    function tryQuerySelector(selectors, context = document) {
        for (const sel of selectors) {
            try {
                const el = context.querySelector(sel);
                if (el && isVisible(el)) {
                    return { el, sel };
                }
            } catch (e) {
                log(`[选择器] 选择器 "${sel}" 解析失败:`, e);
            }
        }
        return null;
    }

    // 依次尝试多个选择器，返回第一个有可见元素的结果 {els, sel}
    function tryQuerySelectorAll(selectors, context = document) {
        for (const sel of selectors) {
            try {
                const els = context.querySelectorAll(sel);
                const visibleEls = Array.from(els).filter(isVisible);
                if (visibleEls.length > 0) {
                    return { els: visibleEls, sel };
                }
            } catch (e) {
                log(`[选择器] 选择器 "${sel}" 解析失败:`, e);
            }
        }
        return null;
    }

    // 可见性判断：有 offsetParent（非 display:none）、样式可见、有实际尺寸
    function isVisible(element) {
        if (!element || !element.offsetParent) return false;
        const style = window.getComputedStyle(element);
        return style.display !== 'none' &&
               style.visibility !== 'hidden' &&
               element.offsetWidth > 0 &&
               element.offsetHeight > 0;
    }

    // 按文本内容查找第一个可见元素（exact 精确匹配 / tagName 限定标签 / caseSensitive 大小写）
    function findByText(text, context = document, options = {}) {
        const { exact = false, tagName = '*', caseSensitive = false } = options;
        const normalizedText = caseSensitive ? text : text.toLowerCase();
        
        const elements = context.querySelectorAll(tagName);
        for (const el of elements) {
            let elText = el.textContent || el.innerText || '';
            elText = caseSensitive ? elText : elText.toLowerCase();
            
            if ((exact && elText === normalizedText) ||
                (!exact && elText.includes(normalizedText))) {
                if (isVisible(el)) {
                    return el;
                }
            }
        }
        return null;
    }

    // 按文本查找所有可见匹配元素
    function findByTextAll(text, context = document, options = {}) {
        const { exact = false, tagName = '*', caseSensitive = false } = options;
        const normalizedText = caseSensitive ? text : text.toLowerCase();
        
        const elements = context.querySelectorAll(tagName);
        const results = [];
        
        for (const el of elements) {
            let elText = el.textContent || el.innerText || '';
            elText = caseSensitive ? elText : elText.toLowerCase();
            
            if ((exact && elText === normalizedText) ||
                (!exact && elText.includes(normalizedText))) {
                if (isVisible(el)) {
                    results.push(el);
                }
            }
        }
        return results;
    }

    // 按 label 文本找对应表单控件：优先 label[for] 关联，
    // 其次 label 相邻元素，再在 label 所在表单容器内查找 input/select
    function findFieldByLabel(labelText, context = document) {
        const label = findByText(labelText, context, { tagName: 'label' });
        if (label) {
            const fieldId = label.getAttribute('for');
            if (fieldId) {
                const field = context.getElementById(fieldId);
                if (field) return field;
            }
            
            const nextInput = label.nextElementSibling;
            if (nextInput && (nextInput.tagName === 'INPUT' || nextInput.tagName === 'SELECT')) {
                return nextInput;
            }
            
            const container = label.closest('.sell-catProp-item, .next-form-item, .form-item');
            if (container) {
                const input = container.querySelector('input, select, textarea');
                if (input) return input;
            }
        }

        // 兜底：遍历表单容器，容器内 label 文本匹配则取容器内控件
        const containers = context.querySelectorAll('.sell-catProp-item, .next-form-item, .form-item, [class*="form-item"]');
        for (const container of containers) {
            const labelEl = container.querySelector('.label, .oly-label-container, label, .next-form-item-label, [class*="label"]');
            if (labelEl && labelEl.textContent.includes(labelText)) {
                const input = container.querySelector('input, select, textarea');
                if (input && isVisible(input)) {
                    return input;
                }
                
                const select = container.querySelector('.next-select, [role="combobox"], [class*="select"]');
                if (select && isVisible(select)) {
                    return select;
                }
            }
        }

        return null;
    }

    // 按 label 文本返回整个表单容器（用于后续在容器内做多字段操作）
    function findContainerByLabel(labelText, context = document) {
        const containers = context.querySelectorAll('.sell-catProp-item, .next-form-item, .form-item, [class*="form-item"], [class*="FormItem"], [role="gridcell"]');
        for (const container of containers) {
            const labelEl = container.querySelector('.label, .oly-label-container, label, .next-form-item-label, [class*="label"]');
            if (labelEl && labelEl.textContent.includes(labelText)) {
                if (isVisible(container)) {
                    return container;
                }
            }
        }
        
        const label = findByText(labelText, context, { tagName: 'label' });
        if (label) {
            return label.closest('.sell-catProp-item, .next-form-item, .form-item');
        }
        
        return null;
    }

    // 轮询等待单个元素出现（应对异步渲染），超时返回 null
    async function waitAndFind(selectors, context = document, options = {}) {
        const { maxWait = 5000, interval = 200, checkVisible = true } = options;
        const startTime = Date.now();
        
        while (Date.now() - startTime < maxWait) {
            const result = tryQuerySelector(selectors, context);
            if (result && (!checkVisible || isVisible(result.el))) {
                return result.el;
            }
            await new Promise(resolve => setTimeout(resolve, interval));
        }
        
        log(`[选择器] 等待超时(${maxWait}ms)，选择器:`, selectors);
        return null;
    }

    // 轮询等待多个元素（minCount 控制最少数量）
    async function waitAndFindAll(selectors, context = document, options = {}) {
        const { maxWait = 5000, interval = 200, checkVisible = true, minCount = 1 } = options;
        const startTime = Date.now();
        
        while (Date.now() - startTime < maxWait) {
            const result = tryQuerySelectorAll(selectors, context);
            if (result && result.els.length >= minCount) {
                if (!checkVisible) {
                    return result.els;
                }
                const visibleEls = result.els.filter(isVisible);
                if (visibleEls.length >= minCount) {
                    return visibleEls;
                }
            }
            await new Promise(resolve => setTimeout(resolve, interval));
        }
        
        log(`[选择器] 等待超时(${maxWait}ms)，选择器:`, selectors);
        return [];
    }

    // 轮询等待按文本查找的元素
    async function waitAndFindByText(text, context = document, options = {}) {
        const { maxWait = 5000, interval = 200, exact = false } = options;
        const startTime = Date.now();
        
        while (Date.now() - startTime < maxWait) {
            const el = findByText(text, context, { exact });
            if (el && isVisible(el)) {
                return el;
            }
            await new Promise(resolve => setTimeout(resolve, interval));
        }
        
        log(`[选择器] 等待超时(${maxWait}ms)，文本: "${text}"`);
        return null;
    }

    // 在页面 iframe 中查找目标元素（iframeSelector 可选过滤目标 iframe）
    function findInIframe(iframeSelector, targetSelector) {
        const iframes = document.querySelectorAll('iframe');
        for (const iframe of iframes) {
            try {
                const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
                if (!iframeDoc) continue;
                
                if (iframeSelector) {
                    const iframeEl = iframeDoc.querySelector(iframeSelector);
                    if (!iframeEl) continue;
                }
                
                const target = iframeDoc.querySelector(targetSelector);
                if (target && isVisible(target)) {
                    return target;
                }
            } catch (e) {
                log(`[选择器] iframe访问失败:`, e);
            }
        }
        return null;
    }

    // 轮询等待 iframe 内元素出现
    async function waitAndFindInIframe(iframeSelector, targetSelector, options = {}) {
        const { maxWait = 5000, interval = 200 } = options;
        const startTime = Date.now();
        
        while (Date.now() - startTime < maxWait) {
            const result = findInIframe(iframeSelector, targetSelector);
            if (result) {
                return result;
            }
            await new Promise(resolve => setTimeout(resolve, interval));
        }
        
        log(`[选择器] iframe等待超时(${maxWait}ms)`);
        return null;
    }

    // 从 selectors.js 配置中取某页面某元素的选择器候选列表
    function getSelectorsFromConfig(page, element) {
        if (window.selectors && window.selectors.getList) {
            return window.selectors.getList(page, element);
        }
        log('[选择器] selectors配置未加载');
        return [];
    }

    // 配置驱动查找：匹配则返回元素
    function find(page, element, context = document) {
        const selectors = getSelectorsFromConfig(page, element);
        if (selectors.length === 0) {
            log(`[选择器] 未找到配置: ${page}.${element}`);
            return null;
        }
        
        const result = tryQuerySelector(selectors, context);
        if (result) {
            log(`[选择器] 成功匹配: ${page}.${element} -> "${result.sel}"`);
            return result.el;
        }
        
        log(`[选择器] 所有选择器均未匹配: ${page}.${element}`);
        return null;
    }

    // 配置驱动查找：返回所有匹配元素
    function findAll(page, element, context = document) {
        const selectors = getSelectorsFromConfig(page, element);
        if (selectors.length === 0) {
            log(`[选择器] 未找到配置: ${page}.${element}`);
            return [];
        }
        
        const result = tryQuerySelectorAll(selectors, context);
        if (result) {
            log(`[选择器] 成功匹配: ${page}.${element} -> "${result.sel}" (${result.els.length}个)`);
            return result.els;
        }
        
        log(`[选择器] 所有选择器均未匹配: ${page}.${element}`);
        return [];
    }

    // 配置驱动 + 轮询等待单个元素
    async function waitAndFindConfig(page, element, context = document, options = {}) {
        const selectors = getSelectorsFromConfig(page, element);
        if (selectors.length === 0) {
            log(`[选择器] 未找到配置: ${page}.${element}`);
            return null;
        }
        
        return await waitAndFind(selectors, context, options);
    }

    // 配置驱动 + 轮询等待多个元素
    async function waitAndFindAllConfig(page, element, context = document, options = {}) {
        const selectors = getSelectorsFromConfig(page, element);
        if (selectors.length === 0) {
            log(`[选择器] 未找到配置: ${page}.${element}`);
            return [];
        }
        
        return await waitAndFindAll(selectors, context, options);
    }

    // 多策略回退查找：主选择器失败后按 text/attr/closest/parent 四种策略依次尝试
    function findFallback(primarySelectors, fallbackStrategies, context = document) {
        const primaryResult = tryQuerySelector(primarySelectors, context);
        if (primaryResult) {
            log(`[选择器] 主选择器成功: "${primaryResult.sel}"`);
            return primaryResult.el;
        }
        
        for (const strategy of fallbackStrategies) {
            try {
                if (strategy.type === 'text') {
                    const el = findByText(strategy.text, context, strategy.options || {});
                    if (el) {
                        log(`[选择器] 回退策略成功(text): "${strategy.text}"`);
                        return el;
                    }
                } else if (strategy.type === 'attr') {
                    const selector = `[${strategy.attr}${strategy.operator || '='}"${strategy.value}"]`;
                    const el = context.querySelector(selector);
                    if (el && isVisible(el)) {
                        log(`[选择器] 回退策略成功(attr): "${selector}"`);
                        return el;
                    }
                } else if (strategy.type === 'closest') {
                    const anchor = context.querySelector(strategy.anchor);
                    if (anchor) {
                        const el = anchor.closest(strategy.closest);
                        if (el && isVisible(el)) {
                            log(`[选择器] 回退策略成功(closest): "${strategy.closest}"`);
                            return el;
                        }
                    }
                } else if (strategy.type === 'parent') {
                    const child = context.querySelector(strategy.child);
                    if (child) {
                        const el = child.parentElement;
                        if (el && isVisible(el)) {
                            log(`[选择器] 回退策略成功(parent)`);
                            return el;
                        }
                    }
                }
            } catch (e) {
                log(`[选择器] 回退策略失败:`, strategy, e);
            }
        }
        
        log(`[选择器] 所有策略均失败`);
        return null;
    }

    // 对外导出全部查找能力
    return {
        setLog,
        isVisible,
        tryQuerySelector,
        tryQuerySelectorAll,
        findByText,
        findByTextAll,
        findFieldByLabel,
        findContainerByLabel,
        waitAndFind,
        waitAndFindAll,
        waitAndFindByText,
        findInIframe,
        waitAndFindInIframe,
        getSelectorsFromConfig,
        find,
        findAll,
        waitAndFindConfig,
        waitAndFindAllConfig,
        findFallback
    };
})();

if (typeof window !== 'undefined') {
    window.smartFind = smartFind;
}
