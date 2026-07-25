const STORAGE_KEY = 'polo_product_data';
const IMAGE_DIR_KEY = 'polo_image_dir';

let IMAGE_DIR = '';
let currentProduct = null;

async function sendMessageRetry(message, maxRetries = 2, delayMs = 500) {
    let lastError = null;
    for (let i = 0; i <= maxRetries; i++) {
        try {
            const resp = await new Promise((resolve, reject) => {
                chrome.runtime.sendMessage(message, (response) => {
                    if (chrome.runtime.lastError) {
                        reject(new Error(chrome.runtime.lastError.message));
                    } else {
                        resolve(response);
                    }
                });
            });
            return resp;
        } catch (e) {
            lastError = e;
            if (i < maxRetries) {
                await new Promise(r => setTimeout(r, delayMs * (i + 1)));
            }
        }
    }
    throw lastError || new Error('消息发送失败');
}

function startHeartbeat(intervalMs = 15000) {
    const timer = setInterval(() => {
        try {
            chrome.runtime.sendMessage({ action: 'heartbeat' }, () => {
                if (chrome.runtime.lastError) {
                    console.log('[心跳] SW未响应，下次重试:', chrome.runtime.lastError.message);
                }
            });
        } catch (e) {}
    }, intervalMs);
    return () => clearInterval(timer);
}

function loadImageDir() {
    return new Promise((resolve) => {
        chrome.storage.local.get(IMAGE_DIR_KEY, (result) => {
            if (result[IMAGE_DIR_KEY]) {
                IMAGE_DIR = result[IMAGE_DIR_KEY];
            }
            resolve(IMAGE_DIR);
        });
    });
}

function log(msg, type = 'info') {
    const logArea = document.getElementById('polo-log');
    if (!logArea) return;
    const line = document.createElement('div');
    line.style.cssText = 'margin-bottom:2px;font-family:monospace;font-size:11px;line-height:1.5;';
    if (type === 'success') line.style.color = '#52c41a';
    else if (type === 'error') line.style.color = '#ff4d4f';
    else if (type === 'warn') line.style.color = '#faad14';
    else line.style.color = '#666';
    line.textContent = '[' + new Date().toLocaleTimeString() + '] ' + msg;
    logArea.appendChild(line);
    logArea.scrollTop = logArea.scrollHeight;
}

function setInputValue(el, val) {
    if (!el) return false;
    const proto = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), 'value');
    if (proto && proto.set) {
        proto.set.call(el, val);
    } else {
        el.value = val;
    }
    el.dispatchEvent(new Event('input', {bubbles:true, cancelable:true}));
    el.dispatchEvent(new Event('change', {bubbles:true, cancelable:true}));
    confirmInput(el);
    return true;
}

function confirmInput(el) {
    if (!el) return;
    el.dispatchEvent(new MouseEvent('mousedown', {bubbles:true, cancelable:true}));
    el.dispatchEvent(new MouseEvent('mouseup', {bubbles:true, cancelable:true}));
    el.dispatchEvent(new MouseEvent('click', {bubbles:true, cancelable:true}));
}

function pressEnter(el) {
    if (!el) return;
    el.focus();
    el.dispatchEvent(new KeyboardEvent('keydown', {key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true}));
    el.dispatchEvent(new KeyboardEvent('keypress', {key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true}));
    el.dispatchEvent(new KeyboardEvent('keyup', {key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true}));
    confirmInput(el);
}

function clickBlankNear(el) {
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = rect.left + rect.width + 50;
    const y = rect.top + rect.height / 2;
    const blank = document.elementFromPoint(x, y);
    if (blank && blank !== el) {
        blank.dispatchEvent(new MouseEvent('click', {bubbles:true, cancelable:true}));
    }
}

function nativeMouseClick(el) {
    if (!el) return false;
    const rect = el.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    el.dispatchEvent(new MouseEvent('mousedown', {bubbles: true, cancelable: true, clientX: x, clientY: y}));
    el.dispatchEvent(new MouseEvent('mouseup', {bubbles: true, cancelable: true, clientX: x, clientY: y}));
    el.dispatchEvent(new MouseEvent('click', {bubbles: true, cancelable: true, clientX: x, clientY: y}));
    el.focus?.();
    return true;
}

async function realClick(el) {
    if (!el) return false;
    const rect = el.getBoundingClientRect();
    const x = Math.round(rect.left + rect.width / 2);
    const y = Math.round(rect.top + rect.height / 2);
    try {
        const res = await chrome.runtime.sendMessage({ action: 'realMouseClick', x, y });
        if (res && res.ok) return true;
    } catch (e) {}
    nativeMouseClick(el);
    return true;
}

function findFieldContainer(containerId, labelHint) {
    let c = document.getElementById(containerId);
    if (c) return c;
    if (!labelHint) return null;
    
    if (window.smartFind && typeof window.smartFind.findContainerByLabel === 'function') {
        const smartResult = window.smartFind.findContainerByLabel(labelHint);
        if (smartResult) {
            return smartResult;
        }
    }
    
    const hintClean = labelHint.replace(/[：:\s*]/g, '').trim();
    
    const selectors = window.selectors && window.selectors.getList ? 
        window.selectors.getList('page3', 'fieldContainer') :
        ['.sell-catProp-item', 'div[id^="struct-p-"]', '.com-struct', '.next-form-item', '[class*="form-item"]', '[class*="FormItem"]', '[role="gridcell"]'];
    
    const allElements = document.querySelectorAll(selectors.join(','));
    
    let exactMatch = null;
    let prefixMatch = null;
    let includesMatch = null;
    
    const labelSelectors = window.selectors && window.selectors.getList ?
        window.selectors.getList('page3', 'fieldLabel') :
        ['.label', '.oly-label-container', 'label', '.next-form-item-label', '[class*="label"]'];
    
    for (const el of allElements) {
        const lbl = el.querySelector(labelSelectors.join(','));
        let text = (lbl?.textContent || el.textContent || '').replace(/[：:\s*]/g, '').trim();
        
        if (text === hintClean) {
            exactMatch = el;
            break;
        }
        if (!prefixMatch && text.startsWith(hintClean)) {
            prefixMatch = el;
        }
        if (!includesMatch && text.includes(hintClean)) {
            includesMatch = el;
        }
    }
    
    if (exactMatch) return exactMatch;
    if (prefixMatch) return prefixMatch;
    if (includesMatch) return includesMatch;
    
    for (const lbl of document.querySelectorAll('label, span, .field-label, .form-label')) {
        if (lbl.textContent.replace(/[：:\s*]/g, '').trim() === hintClean) {
            return lbl.closest('div[id^="struct"], .sell-catProp-item, .com-struct, .next-form-item, [class*="field"]') || lbl.parentElement;
        }
    }
    return null;
}

async function setAutoComplete(containerId, val, labelHint) {
    const c = findFieldContainer(containerId, labelHint);
    if (!c) return false;
    c.scrollIntoView({block: 'center'});
    await new Promise(r => setTimeout(r, 150));
    let inp = c.querySelector(
        'input[aria-autocomplete="list"]:not([readonly]), input[role="combobox"]:not([readonly]), .next-select-auto-complete input:not([readonly]), input[placeholder*="请输入"]:not([readonly])'
    );
    if (!inp) inp = c.querySelector('input:not([readonly]):not([type="hidden"])');
    if (!inp) return false;
    await realClick(inp);
    await new Promise(r => setTimeout(r, 200));
    inp.focus();
    document.execCommand('selectAll', false, null);
    await new Promise(r => setTimeout(r, 50));
    document.execCommand('insertText', false, '');
    await new Promise(r => setTimeout(r, 50));
    for (const ch of String(val)) {
        document.execCommand('insertText', false, ch);
        await new Promise(r => setTimeout(r, 15));
    }
    inp.dispatchEvent(new Event('input', {bubbles: true}));
    inp.dispatchEvent(new Event('change', {bubbles: true}));
    await new Promise(r => setTimeout(r, 400));

    const wLower = String(val).toLowerCase();
    for (let i = 0; i < 20; i++) {
        const allOpts = document.querySelectorAll('.next-menu-item, li[role="option"], .next-select-auto-complete li, .next-overlay-wrapper li[role="option"]');
        let found = false;
        for (const it of allOpts) {
            if (it.offsetHeight === 0) continue;
            const t = (it.innerText || '').trim().toLowerCase();
            if (!t || t === '请选择' || t.includes('暂无')) continue;
            if (t === wLower || t.includes(wLower) || wLower.includes(t)) {
                await realClick(it);
                confirmInput(it);
                await new Promise(r => setTimeout(r, 300));
                found = true;
                break;
            }
        }
        if (found) break;
        await new Promise(r => setTimeout(r, 200));
    }

    await new Promise(r => setTimeout(r, 200));
    inp.dispatchEvent(new FocusEvent('blur', {bubbles: true}));
    await new Promise(r => setTimeout(r, 300));
    return true;
}

async function closeOverlays() {
    document.body.dispatchEvent(new KeyboardEvent('keydown', {key: 'Escape', keyCode: 27, bubbles: true}));
    await new Promise(r => setTimeout(r, 80));
    document.body.dispatchEvent(new KeyboardEvent('keyup', {key: 'Escape', keyCode: 27, bubbles: true}));
    await new Promise(r => setTimeout(r, 120));
    const overlays = document.querySelectorAll('.next-overlay-wrapper, .next-overlay');
    for (const ov of overlays) {
        if (ov.offsetHeight > 0) {
            ov.style.display = 'none';
        }
    }
}

async function setSearchDropdown(containerId, val, labelHint) {
    if (!val) return false;
    await closeOverlays();
    const c = findFieldContainer(containerId, labelHint);
    if (!c) return false;
    c.scrollIntoView({block: 'center'});
    await new Promise(r => setTimeout(r, 120));
    const openEl = c.querySelector('.next-select-trigger, .next-select, [role="combobox"]')
      || c.querySelector('input:not([readonly]):not([type="hidden"])');
    if (!openEl) return false;
    await realClick(openEl);
    await new Promise(r => setTimeout(r, 900));
    let searchInp = null;
    for (const sel of [
        '.sell-o-select-options .options-search input',
        '.next-overlay-wrapper .options-search input',
        '.options-search input',
        '.next-overlay-wrapper input[type="text"]',
    ]) {
        const el = document.querySelector(sel);
        if (el && el.offsetHeight > 0 && !el.readOnly) { searchInp = el; break; }
    }
    if (searchInp) {
        await realClick(searchInp);
        await new Promise(r => setTimeout(r, 200));
        searchInp.focus();
        document.execCommand('selectAll', false, null);
        await new Promise(r => setTimeout(r, 50));
        document.execCommand('insertText', false, '');
        await new Promise(r => setTimeout(r, 60));
        for (const ch of String(val)) {
            document.execCommand('insertText', false, ch);
            await new Promise(r => setTimeout(r, 20));
        }
        searchInp.dispatchEvent(new Event('input', { bubbles: true }));
        searchInp.dispatchEvent(new Event('change', { bubbles: true }));
    }
    const vLower = String(val).toLowerCase();
    const roots = document.querySelectorAll('.sell-o-select-options, .next-overlay-wrapper, .next-overlay');
    const itemSelectors = '.options-item, .next-menu-item, li[role="option"], li';
    const findOption = async () => {
        for (const root of roots) {
            if (root.style.display === 'none' || root.offsetHeight === 0) continue;
            for (const it of root.querySelectorAll(itemSelectors)) {
                const t = (it.innerText || '').trim().toLowerCase();
                if (!t || t === '请选择' || t.includes('暂无')) continue;
                if (t === vLower || t.includes(vLower) || vLower.includes(t)) {
                    await realClick(it);
                    return true;
                }
            }
        }
        return false;
    };
    const startTime = Date.now();
    while (Date.now() - startTime < 3000) {
        if (await findOption()) {
            await new Promise(r => setTimeout(r, 300));
            await closeOverlays();
            return true;
        }
        await new Promise(r => setTimeout(r, 200));
    }
    await closeOverlays();
    return false;
}

async function setTagClick(containerId, values, labelHint) {
    await closeOverlays();
    const c = findFieldContainer(containerId, labelHint);
    if (!c) return false;
    c.scrollIntoView({block: 'center'});
    await new Promise(r => setTimeout(r, 120));
    let inp = c.querySelector(
        '.next-select-trigger-search input, .next-select-inner input, input[role="combobox"]:not([readonly]), .next-select-auto-complete input, .next-input input:not([readonly])'
    );
    if (!inp) inp = c.querySelector('input:not([readonly]):not([type="hidden"])');
    if (!inp) return false;
    const list = Array.isArray(values) ? values : [values];
    for (const v of list) {
        if (!v) continue;
        await realClick(inp);
        await new Promise(r => setTimeout(r, 200));
        inp.focus();
        document.execCommand('selectAll', false, null);
        await new Promise(r => setTimeout(r, 50));
        document.execCommand('insertText', false, '');
        await new Promise(r => setTimeout(r, 60));
        for (const ch of String(v)) {
            document.execCommand('insertText', false, ch);
            await new Promise(r => setTimeout(r, 20));
        }
        inp.dispatchEvent(new Event('input', { bubbles: true }));
        inp.dispatchEvent(new Event('change', { bubbles: true }));
        await new Promise(r => setTimeout(r, 350));
        const vLower = String(v).toLowerCase();
        let picked = false;
        for (const ov of document.querySelectorAll('.next-overlay-wrapper, .next-overlay, .sell-o-select-options')) {
            if (ov.offsetHeight === 0) continue;
            for (const item of ov.querySelectorAll('li[role="option"], .next-menu-item, .options-item, li')) {
                const t = (item.innerText || '').trim().toLowerCase();
                if (!t) continue;
                if (t === vLower || t.includes(vLower) || vLower.includes(t)) {
                    await realClick(item);
                    picked = true;
                    await new Promise(r => setTimeout(r, 180));
                    break;
                }
            }
            if (picked) break;
        }
        if (!picked) {
            inp.dispatchEvent(new KeyboardEvent('keydown', {key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true}));
            inp.dispatchEvent(new KeyboardEvent('keyup', {key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true}));
            await new Promise(r => setTimeout(r, 180));
        }
    }
    await closeOverlays();
    return true;
}

function getCategoryKeywords(category) {
    if (!category) return [];
    const cat = category.toLowerCase();
    const keywords = [];

    if (cat.includes('polo')) {
        keywords.push('男士Polo衫', 'Polo衫', 'POLO衫', 'polo衫', "Men's Polo Shirts");
    }
    if (cat.includes('t-shirt') || cat.includes('t shirt') || cat.includes('t恤') || cat.includes('t 恤')) {
        keywords.push('男士T恤', 'T恤', 'T 恤', "Men's T-Shirts");
    }
    if (cat.includes('shirt') && !cat.includes('polo') && !cat.includes('t-shirt') && !cat.includes('t shirt') && !cat.includes('hoodie') && !cat.includes('sweatshirt')) {
        keywords.push('男式衬衫', '男士衬衫', '衬衫', "Men's Shirts", "Men's Dress Shirts");
    }
    if (cat.includes('hoodie') || cat.includes('sweatshirt')) {
        keywords.push('男士卫衣及帽衫', '卫衣', "Men's Hoodies & Sweatshirts", "Hoodies & Sweatshirts");
    }

    if (keywords.length === 0) {
        keywords.push(category);
    }
    return keywords;
}

async function selectCategory(category) {
    try {
        const keywords = getCategoryKeywords(category);
        log('🔍 类目关键词: ' + keywords.join(', '));

        let favTab = null;
        
        const tabSelectors = window.selectors && window.selectors.getList ?
            window.selectors.getList('page2', 'categoryTab') :
            ['li[role="tab"]', '.next-tabs-tab'];
        
        const tabInnerSelectors = window.selectors && window.selectors.getList ?
            window.selectors.getList('page2', 'categoryTabInner') :
            ['.next-tabs-tab-inner', '[class*="tab-inner"]'];

        const tabItems = document.querySelectorAll(tabSelectors.join(','));
        for (const tab of tabItems) {
            const inner = tab.querySelector(tabInnerSelectors.join(','));
            const text = (inner ? inner.textContent : tab.textContent) || '';
            if (text.includes('您经常使用的类目') || text.includes('常用类目')) {
                favTab = tab;
                break;
            }
        }
        
        if (!favTab && window.smartFind) {
            favTab = window.smartFind.findByText('您经常使用的类目', document, { tagName: 'li' });
            if (!favTab) {
                favTab = window.smartFind.findByText('常用类目', document, { tagName: 'li' });
            }
        }
        
        if (favTab) {
            favTab.scrollIntoView({ block: 'center', behavior: 'instant' });
            await new Promise(r => setTimeout(r, 200));
            await realClick(favTab);
            await new Promise(r => setTimeout(r, 1500));
            log('📌 已切换到「您经常使用的类目」tab');
        } else {
            log('⚠️ 未找到「您经常使用的类目」tab，直接查找类目列表', 'warn');
        }

        const categoryItemSelectors = window.selectors && window.selectors.getList ?
            window.selectors.getList('page2', 'categoryItem') :
            ['ul.category-list li', 'li.next-tree-node', 'li'];

        for (const kw of keywords) {
            const catLi = Array.from(document.querySelectorAll(categoryItemSelectors.join(','))).find(el => {
                const text = el.textContent.trim();
                return text === kw || (text.includes(kw) && text.length < 30);
            });
            
            if (!catLi && window.smartFind) {
                const foundByText = window.smartFind.findByText(kw, document, { tagName: 'li' });
                if (foundByText && foundByText.textContent.trim().length < 30) {
                    catLi = foundByText;
                }
            }
            
            if (catLi) {
                catLi.scrollIntoView({ block: 'center', behavior: 'instant' });
                await new Promise(r => setTimeout(r, 300));
                await realClick(catLi);
                return { ok: true, name: catLi.textContent.trim() };
            }
        }

        return { ok: false, error: '未匹配到类目: ' + category };
    } catch (e) {
        return { ok: false, error: e.message };
    }
}

function generateKwFromProduct(p) {
    const words = [];
    const seen = new Set();
    function add(w) { if (w && !seen.has(w.toLowerCase())) { seen.add(w.toLowerCase()); words.push(w); } }

    const t = (p.category || p.title_en || '').toLowerCase();
    if (t.includes('polo')) add('Polo Shirt');
    else if (t.includes('t-shirt') || t.includes('t shirt')) add('T-Shirt');
    else if (t.includes('shirt')) add('Shirt');
    else if (p.category) add(p.category);

    if (p.material_en) {
        String(p.material_en).split(/[,，、]/).forEach(w => add(w.trim()));
    }
    if (p.style_en) add(p.style_en);
    if (p.technics_en) {
        String(p.technics_en).split(/[,，、]/).forEach(w => add(w.trim()));
    }
    if (p.features_en) {
        String(p.features_en).split(/[,，、]/).forEach(w => add(w.trim()));
    }
    if (p.sleeve_en) add(p.sleeve_en);
    if (p.design_en) add(p.design_en);
    if (p.fabric_en) add(p.fabric_en);
    add('Men');
    add('Casual');
    add('Summer');

    return words.slice(0, 10).join(',');
}

function updateProductInfo(product) {
    const info = document.getElementById('polo-product-info');
    if (!info) return;
    const titleEn = product.seo_title_en || product.seo_title || product.title_en || '无标题';
    const titleCn = product.seo_title_cn || product.title_cn || '';
    info.innerHTML = `
        <div style="color:#666;font-size:12px;margin-bottom:4px;">当前产品 (行${product.row})</div>
        <div style="font-weight:500;color:#333;line-height:1.4;word-break:break-all;">${titleEn}</div>
        ${titleCn ? `<div style="font-weight:500;color:#333;line-height:1.4;word-break:break-all;margin-top:4px;">${titleCn}</div>` : ''}
        <div style="color:#999;font-size:11px;margin-top:4px;">
            类目: ${product.category || '未设置'} | 主图: row${product.row}_main.png
        </div>
    `;
    const btn = document.getElementById('polo-autofill-btn');
    if (btn) {
        btn.disabled = false;
        btn.style.opacity = '1';
        btn.style.cursor = 'pointer';
    }
    const uploadBtn = document.getElementById('polo-upload-img-btn');
    if (uploadBtn) uploadBtn.disabled = false;
}

async function loadFromClipboard() {
    try {
        const text = await navigator.clipboard.readText();
        const data = JSON.parse(text);
        if (data && (data.title_en || data.seo_title_en)) {
            currentProduct = data;
            updateProductInfo(data);
            chrome.storage.local.set({ [STORAGE_KEY]: data });
            log('✓ 从剪贴板加载产品数据成功', 'success');
            return true;
        } else {
            log('✗ 剪贴板内容不是有效的产品数据', 'error');
            return false;
        }
    } catch (e) {
        log('✗ 读取剪贴板失败: ' + e.message, 'error');
        return false;
    }
}

function initStorageListener(isBatchMode = false) {
    chrome.storage.local.get([STORAGE_KEY, IMAGE_DIR_KEY], (result) => {
        if (!isBatchMode && result[STORAGE_KEY]) {
            currentProduct = result[STORAGE_KEY];
            updateProductInfo(currentProduct);
            log('✓ 检测到已保存的产品数据', 'success');
        }
        if (result[IMAGE_DIR_KEY]) {
            IMAGE_DIR = result[IMAGE_DIR_KEY];
            log('✓ 图片目录已加载', 'success');
        }
    });

    chrome.storage.onChanged.addListener((changes, area) => {
        if (area === 'local' && changes[IMAGE_DIR_KEY]) {
            IMAGE_DIR = changes[IMAGE_DIR_KEY].newValue;
            log('✓ 图片目录已更新: ' + IMAGE_DIR, 'success');
        }
    });
}
