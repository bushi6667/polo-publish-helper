let IMG_EXT = 'jpg';

function loadImgExt() {
    return new Promise((resolve) => {
        chrome.storage.local.get('img_ext', (result) => {
            IMG_EXT = result.img_ext || 'jpg';
            resolve(IMG_EXT);
        });
    });
}

function saveImgExt(ext) {
    IMG_EXT = ext;
    chrome.storage.local.set({ img_ext: ext });
}

function nativeKeyPress(key) {
    const keyCode = key === 'Enter' ? 13 : key === 'Tab' ? 9 : key === 'Escape' ? 27 : key === 'ArrowDown' ? 40 : key === 'ArrowUp' ? 38 : 0;
    document.activeElement?.dispatchEvent(new KeyboardEvent('keydown', {key, code: key, keyCode, which: keyCode, bubbles: true}));
    document.activeElement?.dispatchEvent(new KeyboardEvent('keyup', {key, code: key, keyCode, which: keyCode, bubbles: true}));
    document.activeElement?.dispatchEvent(new KeyboardEvent('keypress', {key, code: key, keyCode, which: keyCode, bubbles: true}));
}

function buildGroupCandidates(category) {
    const cands = [];
    const cat = (category || '').toLowerCase();

    const exactMap = {
        "men's polo shirts": ['Polo shirt', 'Polo shirts', 'Polo'],
        "men's t-shirts": ['T-Shirts', 'T-shirts', 'T Shirts', 'T Shirt'],
        "men's shirts": ['Shirts'],
        "men's hoodies & sweatshirts": ['Hoodies & Sweatshirts', 'Hoodies', 'Sweatshirts'],
        "men's jackets": ["Men's Jackets", 'Jackets'],
        "men's vest": ["Men's vest", 'Vest', 'Vests'],
        "men's pants": ['Mens Pants', "Men's Pants", 'Pants', 'Mens Pants'],
        "t-shirts": ['T-Shirts', 'T-shirts'],
        "shirts": ['Shirts'],
        "polo shirts": ['Polo shirt', 'Polo shirts'],
        "hoodies & sweatshirts": ['Hoodies & Sweatshirts'],
        "jackets": ["Men's Jackets"],
        "vest": ["Men's vest"],
        "pants": ['Mens Pants']
    };

    if (exactMap[cat]) cands.push(...exactMap[cat]);

    const numMatch = cat.match(/\((\d+)\)/);
    if (numMatch) {
        const num = parseInt(numMatch[1]);
        if (num === 1) cands.push('T-Shirts', 'T-shirts', 'T Shirts', 'T Shirt');
        else if (num === 2) cands.push('Polo shirt', 'Polo shirts', 'Polo');
        else if (num === 3) cands.push('Shirts');
        else if (num === 4 || num === 5) cands.push('Hoodies & Sweatshirts', 'Hoodies', 'Sweatshirts');
        if (cands.length > 0) return [...new Set(cands)];
    }

    if (cat.includes('polo')) cands.push('Polo shirt', 'Polo shirts', 'Polo');
    if (cat.includes('t-shirt') || cat.includes('t shirt') || cat.includes('tshirt') || cat.includes('t恤')) cands.push('T-Shirts', 'T-shirts');
    if (cat.includes('hoodie') || cat.includes('sweatshirt')) cands.push('Hoodies & Sweatshirts');
    if (cat.includes('jacket') || cat.includes('coat')) cands.push("Men's Jackets");
    if (cat.includes('vest')) cands.push("Men's vest");
    if (cat.includes('pant') || cat.includes('jean') || cat.includes('trouser')) cands.push('Mens Pants');
    if (cat.includes('shirt') && !cat.includes('polo') && !cat.includes('t-shirt') && !cat.includes('t shirt') && !cat.includes('tshirt') && !cat.includes('t恤') && !cat.includes('hoodie') && !cat.includes('sweatshirt')) cands.push('Shirts');

    if (category) cands.push(category);

    return [...new Set(cands)];
}

function buildAttributeFields(product) {
    const hasVal = (v) => v && String(v).trim() && String(v).toLowerCase() !== 'none';

    const printingVal = hasVal(product.printing_en) ? product.printing_en : 'Other';
    const styleVal = hasVal(product.style_en) ? product.style_en : '';

    const category = (product.category || '').toLowerCase();
    
    const numMatch = category.match(/\((\d+)\)/);
    let isPolo = false, isTshirt = false, isShirt = false, isHoodie = false, isSweatshirt = false;
    
    if (numMatch) {
        const num = parseInt(numMatch[1]);
        if (num === 1) isTshirt = true;
        else if (num === 2) isPolo = true;
        else if (num === 3) isShirt = true;
        else if (num === 4) isHoodie = true;
        else if (num === 5) isSweatshirt = true;
    } else {
        isHoodie = category.includes('hoodie');
        isSweatshirt = category.includes('sweatshirt') && !isHoodie;
        isPolo = category.includes('polo') && !isHoodie && !isSweatshirt;
        isTshirt = (category.includes("t-shirt") || category.includes("t shirt") || category.includes("tshirt") || category.includes("t恤") || (category.includes("tee") && !category.includes("sweat"))) && !isHoodie && !isSweatshirt && !isPolo;
        isShirt = category.includes("shirt") && !isPolo && !isTshirt && !isHoodie && !isSweatshirt;
    }
    
    const fabricVal = hasVal(product.fabric_en) ? product.fabric_en : (isShirt ? 'Poplin' : 'Knitted');
    
    log(`================================================`, 'info');
    log(`🎯 类目判定:`, 'info');
    log(`   原始类目: ${product.category}`, 'info');
    log(`   小写类目: ${category}`, 'info');
    log(`   isPolo: ${isPolo}`, 'info');
    log(`   isTshirt: ${isTshirt}`, 'info');
    log(`   isShirt: ${isShirt}`, 'info');
    log(`   isHoodie: ${isHoodie}`, 'info');
    log(`   isSweatshirt: ${isSweatshirt}`, 'info');
    log(`   判定结果: ${isHoodie ? '🧥 Hoodie' : isSweatshirt ? '🧥 Sweatshirt' : isShirt ? '👕 Shirt' : isTshirt ? '👕 T-Shirt' : isPolo ? '👕 Polo' : '❓ Unknown'}`, 'info');
    log(`================================================`, 'info');
    
    log(`📋 页面所有字段标签列表:`, 'info');
    const fieldContainerSelectors = window.selectors && window.selectors.getList ?
        window.selectors.getList('page3', 'fieldContainer') :
        ['div[id^="struct-p-"]', '.sell-catProp-item', '.com-struct', '.next-form-item', '[class*="form-item"]', '[class*="FormItem"]'];
    const fieldLabelSelectors = window.selectors && window.selectors.getList ?
        window.selectors.getList('page3', 'fieldLabel') :
        ['.label', '.oly-label-container', 'label', '.next-form-item-label', '[class*="label"]'];
    
    const containers = document.querySelectorAll(fieldContainerSelectors.join(','));
    for (const el of containers) {
        const lbl = el.querySelector(fieldLabelSelectors.join(','));
        const text = (lbl?.textContent || el.textContent || '').replace(/[：:\s*]/g, '').trim();
        if (text) {
            log(`   "${text}"`, 'info');
        }
    }
    log(`================================================`, 'info');

    let requiredFields = [];
    let optionalFields = [];

    if (isShirt) {
        const sleeveVal = hasVal(product.sleeve_en) ? product.sleeve_en : 'Full';
        const shirtTypeVal = hasVal(product.shirt_type_en) ? product.shirt_type_en : 'DRESS SHIRTS';
        requiredFields = [
            { lbl: '袖长(cm)', val: sleeveVal },
            { lbl: '材质', val: product.material_en || '', forceMode: 'direct' },
            { lbl: '工艺', val: product.technics_en || '', forceMode: 'direct' },
            { lbl: '印花方法', val: printingVal, forceMode: 'direct' },
            { lbl: '图案类型', val: product.pattern_en || '', forceMode: 'direct' },
            { lbl: '衬衫类型', val: shirtTypeVal },
            { lbl: '产品特性', val: product.features_en || '' },
            { lbl: '原产地', val: 'China', forceMode: 'direct' },
        ];
        optionalFields = [
            { lbl: '性别', val: 'Men', forceMode: 'direct' },
            { lbl: '产品类型', val: hasVal(product.product_type_en) ? product.product_type_en : 'Formal', fallback: 'Dress Shirt', forceMode: 'direct' },
            { lbl: '衣服门襟', val: hasVal(product.placket_en) ? product.placket_en : 'Fly Front', fallback: 'Single Breasted' },
            { lbl: '领型', val: hasVal(product.collar_en) ? product.collar_en : 'Spread', fallback: 'Spread Collar' },
            { lbl: '样式', val: styleVal, forceMode: 'direct' },
            { lbl: '面料克重', val: hasVal(product.fabric_weight_en) ? product.fabric_weight_en : '', forceMode: 'direct' },
            { lbl: '编织方法', val: hasVal(product.weaving_method_en) ? product.weaving_method_en : 'Woven', fallback: 'Knit', forceMode: 'direct' },
            { lbl: '徽标位置', val: ['Front', 'back', 'Left Sleeve', 'Right Sleeve', 'lower hem', 'back neck'], forceMode: 'tag' },
            { lbl: '面料类型', val: fabricVal, fallback: 'Poplin', forceMode: 'direct' },
            { lbl: '省份', val: 'Zhejiang' },
            { lbl: '季节', val: '' },
            { lbl: '适用年龄段', val: 'Adult', forceMode: 'auto' },
            { lbl: '品牌', val: '' },
            { lbl: '型号', val: '' },
        ];
    } else if (isTshirt) {
        const styleTshirtVal = hasVal(product.style_en) ? product.style_en : 'Casual';
        requiredFields = [
            { lbl: '材质', val: product.material_en || '' },
            { lbl: '面料克重', val: hasVal(product.fabric_weight_en) ? product.fabric_weight_en : '', forceMode: 'direct' },
            { lbl: '印花方法', val: printingVal, forceMode: 'direct' },
            { lbl: '工艺', val: product.technics_en || '', forceMode: 'direct' },
            { lbl: '长度', val: product.length_en || '', forceMode: 'direct' },
            { lbl: '图案类型', val: product.pattern_en || '', forceMode: 'direct' },
            { lbl: '样式', val: styleTshirtVal },
            { lbl: '产品特性', val: product.features_en || '' },
            { lbl: '原产地', val: 'China', forceMode: 'direct' },
        ];
        optionalFields = [
            { lbl: '徽标位置', val: hasVal(product.logo_position_en) ? product.logo_position_en : '', fallback: 'Front' },
            { lbl: '领子', val: hasVal(product.collar_en) ? product.collar_en : '', forceMode: 'direct' },
            { lbl: '袖子款式', val: hasVal(product.sleeve_en) ? product.sleeve_en : '', fallback: 'Short Sleeve' },
            { lbl: '板型', val: hasVal(product.fit_en) ? product.fit_en : '', forceMode: 'direct' },
            { lbl: '编织方法', val: 'Knitted', fallback: 'Knit' },
            { lbl: '面料类型', val: fabricVal, fallback: 'Knitted', forceMode: 'direct' },
            { lbl: '设计', val: product.design_en || '', forceMode: 'direct' },
            { lbl: '性别', val: 'Men', forceMode: 'direct' },
            { lbl: '省份', val: 'Zhejiang', fallback: 'Zhejiang Province' },
        ];
    } else if (isPolo) {
        const stylePoloVal = hasVal(product.style_en) ? product.style_en : 'Casual';
        requiredFields = [
            { lbl: '材质', val: product.material_en || '', forceMode: 'direct' },
            { lbl: '面料克重', val: hasVal(product.fabric_weight_en) ? product.fabric_weight_en : '', forceMode: 'direct' },
            { lbl: '印花方法', val: printingVal, forceMode: 'direct' },
            { lbl: '工艺', val: hasVal(product.technics_en) ? product.technics_en : '', forceMode: 'direct' },
            { lbl: '长度', val: hasVal(product.length_en) ? product.length_en : '', forceMode: 'direct' },
            { lbl: '图案类型', val: product.pattern_en || '', forceMode: 'direct' },
            { lbl: '样式', val: stylePoloVal, fallback: 'Formal', forceMode: 'select' },
            { lbl: '产品特性', val: product.features_en || '', forceMode: 'direct' },
            { lbl: '原产地', val: 'China', forceMode: 'direct' },
        ];
        optionalFields = [
            { lbl: '面料类型', val: fabricVal, fallback: 'Knitted', forceMode: 'select' },
            { lbl: '徽标位置', val: product.logo_position_en || 'Front', fallback: 'Front', forceMode: 'select' },
            { lbl: '省份', val: 'Zhejiang', fallback: 'Zhejiang Province', forceMode: 'select' },
            { lbl: '编织方法', val: 'Knitted', fallback: 'Knit', forceMode: 'direct' },
            { lbl: '设计', val: hasVal(product.design_en) ? product.design_en : '', forceMode: 'direct' },
            { lbl: '性别', val: 'Men', forceMode: 'direct' },
        ];
    } else if (isHoodie || isSweatshirt) {
        const styleHoodieVal = hasVal(product.style_en) ? product.style_en : 'Casual';
        requiredFields = [
            { lbl: '材质', val: product.material_en || '', forceMode: 'direct' },
            { lbl: '种类', val: hasVal(product.category_type_en || product._category_en || product.category_en) ? (product.category_type_en || product._category_en || product.category_en) : '', forceMode: 'direct' },
            { lbl: '款式', val: styleHoodieVal, forceMode: 'tag' },
            { lbl: '面料克重', val: hasVal(product.fabric_weight_en) ? product.fabric_weight_en : '', forceMode: 'tag' },
            { lbl: '面料类型', val: fabricVal, fallback: 'Knitted', forceMode: 'direct' },
            { lbl: '印花方法', val: printingVal, forceMode: 'tag' },
            { lbl: '工艺', val: product.technics_en || '', forceMode: 'tag' },
            { lbl: '图案类型', val: product.pattern_en || '', forceMode: 'direct' },
            { lbl: '原产地', val: 'China', forceMode: 'direct' },
        ];
        optionalFields = [
            { lbl: '省份', val: 'Zhejiang', fallback: 'Zhejiang Province', forceMode: 'select' },
            { lbl: '徽标位置', val: hasVal(product.logo_position_en) ? product.logo_position_en : '', fallback: 'Front', forceMode: 'select' },
            { lbl: '领型', val: hasVal(product.collar_en) ? product.collar_en : (isHoodie ? 'Hooded' : 'Crew Neck'), fallback: isHoodie ? 'Hooded' : 'Crew Neck', forceMode: 'select' },
            { lbl: '板型', val: hasVal(product.fit_en) ? product.fit_en : '', forceMode: 'direct' },
            { lbl: '设计', val: product.design_en || '', forceMode: 'direct' },
            { lbl: '长度', val: product.length_en || '', forceMode: 'direct' },
            { lbl: '袖型', val: hasVal(product.sleeve_en) ? product.sleeve_en : 'Long Sleeve', fallback: 'Long Sleeve', forceMode: 'select' },
            { lbl: '产品特性', val: product.features_en || '', forceMode: 'tag' },
            { lbl: '性别', val: 'Men', forceMode: 'direct' },
            { lbl: '编织方法', val: hasVal(product.weaving_method_en) ? product.weaving_method_en : 'Knitted', fallback: 'Knit', forceMode: 'direct' },
        ];
    } else {
        requiredFields = [
            { lbl: '材质', val: product.material_en || '' },
            { lbl: '工艺', val: product.technics_en || '' },
            { lbl: '设计', val: product.design_en || '' },
            { lbl: '产品特性', val: product.features_en || '' },
            { lbl: '原产地', val: 'China' },
        ];
        optionalFields = [
            { lbl: '样式', val: styleVal },
            { lbl: '徽标位置', val: 'Front', fallback: 'Chest' },
            { lbl: '编织方法', val: 'Knitted', fallback: 'Knit' },
            { lbl: '袖子款式', val: hasVal(product.sleeve_en) ? product.sleeve_en : '', fallback: 'Short Sleeve' },
            { lbl: '检针工艺', val: '', },
            { lbl: '面料克重', val: hasVal(product.fabric_weight_en) ? product.fabric_weight_en : '' },
            { lbl: '面料类型', val: fabricVal, fallback: 'Knitted' },
            { lbl: '性别', val: 'Men' },
            { lbl: '印花方法', val: printingVal },
            { lbl: '长度', val: product.length_en || '' },
            { lbl: '图案类型', val: product.pattern_en || '' },
            { lbl: '省份', val: 'Zhejiang', fallback: 'Zhejiang Province' },
        ];
    }

    const required = [];
    const optional = [];
    for (const f of requiredFields) { if (f.val) required.push(f); }
    for (const f of optionalFields) { if (f.val) optional.push(f); }

    return { required, optional };
}

function detectFieldMode(container) {
    if (!container) return 'search';
    
    const selectSelectors = window.selectors && window.selectors.getList ?
        window.selectors.getList('page3', 'selectComponent') :
        ['.next-select', '[role="combobox"]', '[class*="select"]'];
    
    const select = container.querySelector(selectSelectors.join(','));
    if (!select) {
        const inp = container.querySelector('input:not([type="hidden"])');
        if (inp) return 'input';
        return 'search';
    }
    
    if (select.classList.contains('next-select-tag') || select.classList.contains('next-select-tag-list')) return 'tag';
    if (select.classList.contains('next-no-search')) return 'select';
    if (select.classList.contains('next-select-auto-complete')) return 'auto';
    return 'search';
}

function normalizeCompare(a, b) {
    const norm = (s) => String(s || '').toLowerCase().replace(/[\s\-_/\\,，.。;；:：\(\)（）]/g, '').trim();
    const na = norm(a);
    const nb = norm(b);
    if (!na || !nb) return false;
    if (na === nb) return true;
    return na.includes(nb) || nb.includes(na);
}

function getFieldCurrentValue(container, mode) {
    if (!container) return '';
    if (mode === 'direct' || mode === 'input' || mode === 'auto') {
        const inp = container.querySelector('input:not([readonly]):not([type="hidden"])');
        if (inp) return inp.value || '';
        return '';
    }
    if (mode === 'select' || mode === 'search') {
        const trigger = container.querySelector('.next-select-trigger, .next-select-inner');
        if (trigger) {
            const valEl = trigger.querySelector('.next-select-value, .next-select-placeholder, [class*="value"], [class*="placeholder"], span');
            if (valEl) {
                const text = (valEl.innerText || valEl.textContent || '').trim();
                if (text && !text.includes('请选择') && !text.includes('请输入')) return text;
            }
        }
        const tagList = container.querySelector('.next-select-tag-list, [class*="tag-list"]');
        if (tagList) {
            const tags = tagList.querySelectorAll('.next-tag, [class*="tag"]');
            if (tags.length > 0) {
                return Array.from(tags).map(t => (t.innerText || t.textContent || '').trim()).filter(Boolean).join(', ');
            }
        }
        return '';
    }
    if (mode === 'tag') {
        const tags = container.querySelectorAll('.next-tag, [class*="tag"]');
        if (tags.length > 0) {
            return Array.from(tags).map(t => (t.innerText || t.textContent || '').replace(/×|✕|✕/g, '').trim()).filter(Boolean).join(', ');
        }
        return '';
    }
    return '';
}

function verifyFieldValue(container, expectedVal, mode) {
    const currentVal = getFieldCurrentValue(container, mode);
    if (!currentVal) return false;
    if (normalizeCompare(currentVal, expectedVal)) return true;
    const parts = String(expectedVal).split(/[,，]/).map(s => s.trim()).filter(Boolean);
    if (parts.length > 1) {
        let matchedCount = 0;
        for (const part of parts) {
            if (normalizeCompare(currentVal, part)) {
                matchedCount++;
            }
        }
        return matchedCount >= Math.ceil(parts.length * 0.5);
    }
    return false;
}

async function fillAttributeField(field, product) {
    if (!field.val) return null;
    log(`🔍 查找字段: ${field.lbl}`, 'info');
    let c = null;
    for (let retry = 0; retry < 3; retry++) {
        c = findFieldContainer('', field.lbl);
        if (c) break;
        const attrArea = document.querySelector('#icbuCatProp, .sell-catProp-ai-wrap, .com-struct');
        if (attrArea) attrArea.scrollIntoView({block: 'center'});
        await sleep3(150);
    }
    if (!c) {
        log(`❌ 字段 ${field.lbl} 未找到`, 'warn');
        return { ok: false, lbl: field.lbl, usedVal: field.val };
    }
    const foundLabel = c.querySelector('.label, .oly-label-container, label, .next-form-item-label, [class*="label"]');
    log(`✅ 找到字段 ${field.lbl} -> 实际标签: ${foundLabel?.textContent || c.textContent}`, 'info');

    let actualMode = detectFieldMode(c);
    if (field.forceMode) actualMode = field.forceMode;
    let ok = false;
    let usedVal = field.val;

    const MAX_ATTEMPTS = 3;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        if (attempt > 1) {
            log(`🔄 ${field.lbl} 第${attempt}次重试输入...`, 'warn');
            c = findFieldContainer('', field.lbl) || c;
        }

        ok = false;

        if (c) {
            await ensureTabActive();
            c.scrollIntoView({block: 'center', behavior: 'smooth'});
            await sleep3(100);
        }

        if (actualMode === 'search') {
            const res = await setSearchDropdownPage3(c, field.val, field.lbl, field.fallback);
            ok = res.ok;
            usedVal = res.used || field.val;
        } else if (actualMode === 'select') {
            const res = await setSimpleSelect(c, field.val, field.lbl, field.fallback);
            ok = res.ok;
            usedVal = res.used || field.val;
        } else if (actualMode === 'direct' || actualMode === 'auto') {
            const useDirect = field.forceMode === 'direct';
            const usePickFirst = field.forceMode === 'pickFirst';
            const inp = c.querySelector('input:not([readonly]):not([type="hidden"])');
            if (inp && field.val) {
                if (usePickFirst) {
                    c.scrollIntoView({block: 'center'});
                    await sleep3(50);
                    const c2 = findFieldContainer('', field.lbl);
                    if (!c2) {
                        log(`⚠️ pickFirst: 重新查找字段失败`, 'warn');
                    } else {
                        const inp2 = c2.querySelector('input:not([readonly]):not([type="hidden"])');
                        if (inp2) {
                            nativeMouseClick(inp2);
                            inp2.focus();
                        } else {
                            nativeMouseClick(c2);
                        }
                    }
                    await sleep3(250);
                    const allOpts = document.querySelectorAll(
                        '.next-overlay-wrapper li, .next-menu-item, .options-item, [role="option"], .next-option'
                    );
                    let firstOpt = null;
                    for (const opt of allOpts) {
                        if (opt.offsetHeight > 0 && opt.offsetWidth > 0) {
                            const t = (opt.innerText || opt.textContent || '').trim();
                            if (t && !t.includes('暂无') && !t.includes('没有')) {
                                firstOpt = opt;
                                break;
                            }
                        }
                    }
                    if (firstOpt) {
                        nativeMouseClick(firstOpt);
                        confirmInput(firstOpt);
                        log(`ℹ️ pickFirst选中: ${firstOpt.innerText?.trim()}`, 'info');
                        await sleep3(100);
                        if (inp) inp.dispatchEvent(new FocusEvent('blur', {bubbles: true}));
                        ok = true;
                        usedVal = firstOpt.innerText?.trim() || field.val;
                    } else {
                        log(`⚠️ pickFirst未找到选项`, 'warn');
                    }
                    await sleep3(50);
                } else if (useDirect) {
                    const inp2 = c.querySelector('input:not([readonly]):not([type="hidden"])') || inp;
                    if (inp2 && field.val) {
                        await realClick(inp2);
                        await sleep3(100);
                        inp2.focus();
                        document.execCommand('selectAll', false, null);
                        await sleep3(30);
                        document.execCommand('delete', false, null);
                        await sleep3(30);
                        const valStr = String(field.val);
                        for (const ch of valStr) {
                            document.execCommand('insertText', false, ch);
                            await sleep3(10);
                        }
                        inp2.dispatchEvent(new Event('input', {bubbles: true}));
                        inp2.dispatchEvent(new Event('change', {bubbles: true}));
                        await sleep3(100);
                        confirmInput(inp2);
                        pressEnter(inp2);
                        await sleep3(100);
                        inp2.dispatchEvent(new FocusEvent('blur', {bubbles: true}));
                        ok = true;
                        usedVal = field.val;
                    }
                } else {
                    ok = await setAutoComplete('', field.val, field.lbl);
                }
            }
        } else if (actualMode === 'input') {
            const inp = c.querySelector('input:not([readonly]):not([type="hidden"])');
            if (inp && field.val) {
                inp.focus();
                setInputValue(inp, '');
                inp.dispatchEvent(new Event('input', {bubbles: true}));
                await sleep3(20);
                setInputValue(inp, String(field.val));
                inp.dispatchEvent(new Event('input', {bubbles: true}));
                inp.dispatchEvent(new Event('change', {bubbles: true}));
                confirmInput(inp);
                await sleep3(50);
                inp.dispatchEvent(new FocusEvent('blur', {bubbles: true}));
                await sleep3(30);
                ok = true;
                usedVal = field.val;
            }
        } else if (actualMode === 'tag') {
            const inp = c.querySelector('input:not([readonly]):not([type="hidden"])');
            if (inp && field.val) {
                const closeBtns = c.querySelectorAll('.next-tag-close, [class*="tag-close"], .next-icon-close');
                for (let i = closeBtns.length - 1; i >= 0; i--) {
                    try {
                        closeBtns[i].click();
                        await sleep3(50);
                    } catch(e) {}
                }
                
                await realClick(inp);
                await sleep3(100);
                inp.focus();
                
                const values = Array.isArray(field.val) ? field.val : [field.val];
                const addedVals = [];
                
                for (const val of values) {
                    inp.focus();
                    document.execCommand('selectAll', false, null);
                    await sleep3(20);
                    document.execCommand('insertText', false, '');
                    await sleep3(20);
                    
                    const valStr = String(val).trim();
                    for (const ch of valStr) {
                        document.execCommand('insertText', false, ch);
                        await sleep3(10);
                    }
                    inp.dispatchEvent(new Event('input', {bubbles: true}));
                    await sleep3(180);
                    
                    const allOpts = document.querySelectorAll(
                        '.next-overlay-wrapper li, .next-menu-item, .options-item, [role="option"], .next-option, .next-select-option'
                    );
                    let matchedOpt = null;
                    for (const opt of allOpts) {
                        if (opt.offsetHeight > 0 && opt.offsetWidth > 0) {
                            const t = (opt.innerText || opt.textContent || '').trim();
                            if (t && normalizeCompare(t, valStr)) {
                                matchedOpt = opt;
                                break;
                            }
                        }
                    }
                    
                    if (matchedOpt) {
                        nativeMouseClick(matchedOpt);
                        addedVals.push(matchedOpt.innerText?.trim() || valStr);
                        await sleep3(120);
                    } else {
                        pressEnter(inp);
                        addedVals.push(valStr);
                        await sleep3(120);
                    }
                }
                
                ok = true;
                usedVal = addedVals.join(', ');
            }
        }

        if (ok) {
            await sleep3(80);
            c = findFieldContainer('', field.lbl) || c;
            const labelEl = c.querySelector('.label, .oly-label-container, label, .next-form-item-label, [class*="label"]');
            if (labelEl) {
                nativeMouseClick(labelEl);
            } else {
                c.click();
            }
            await sleep3(120);
            c = findFieldContainer('', field.lbl) || c;
            const verified = verifyFieldValue(c, usedVal, actualMode);
            if (verified) {
                log(`✅ ${field.lbl} 验证通过: "${usedVal}"`, 'success');
                break;
            } else {
                const currentVal = getFieldCurrentValue(c, actualMode);
                log(`⚠️ ${field.lbl} 验证失败，期望值: "${usedVal}"，实际值: "${currentVal}"`, 'warn');
                ok = false;
                if (attempt < MAX_ATTEMPTS) {
                    await sleep3(200);
                    continue;
                }
            }
        } else {
            if (attempt < MAX_ATTEMPTS) {
                await sleep3(200);
                continue;
            }
        }
    }

    if (!ok && c) {
        const checkboxes = c.querySelectorAll('.next-checkbox-wrapper .next-checkbox-label');
        if (checkboxes.length > 0) {
            const valParts = Array.isArray(field.val) ? field.val : [String(field.val)];
            for (const part of valParts) {
                for (const labelEl of checkboxes) {
                    const labelText = (labelEl.innerText || labelEl.textContent || '').trim();
                    if (normalizeCompare(labelText, part)) {
                        const wrapper = labelEl.closest('.next-checkbox-wrapper');
                        if (wrapper && !wrapper.classList.contains('checked')) {
                            nativeMouseClick(wrapper);
                            await sleep3(100);
                            log(`✅ ${field.lbl} 已选中复选框: "${labelText}"`, 'success');
                        }
                        ok = true;
                        break;
                    }
                }
            }
        }
        if (!ok) {
            const radioLabels = c.querySelectorAll('label');
            for (const labelEl of radioLabels) {
                const labelText = (labelEl.innerText || labelEl.textContent || '').trim();
                const radio = labelEl.querySelector('input[type="radio"]');
                if (radio && normalizeCompare(labelText, String(field.val))) {
                    nativeMouseClick(radio);
                    await sleep3(100);
                    log(`✅ ${field.lbl} 已选中单选框: "${labelText}"`, 'success');
                    ok = true;
                    break;
                }
            }
        }
    }

    return { ok, lbl: field.lbl, usedVal };
}

async function setSimpleSelect(c, val, labelHint, fallback) {
    if (!val && !fallback) return { ok: false, used: '' };
    c.scrollIntoView({block: 'center'});
    await sleep3(30);

    const trigger = c.querySelector('.next-select-trigger');
    if (!trigger) {
        log(`⚠️ setSimpleSelect: 未找到trigger - ${labelHint}`, 'warn');
        return { ok: false, used: '' };
    }
    nativeMouseClick(trigger);
    await sleep3(200);

    const normalize = (s) => String(s).toLowerCase().replace(/[\s\-_/\\]/g, '').trim();

    const findOption = (word) => {
        const wNorm = normalize(word);
        const allOpts = document.querySelectorAll(
            '.options-item, .next-menu-item, li[role="option"], li, .next-option, [role="option"], .next-select-menu-item, .next-menu-item-inner'
        );
        let bestMatch = null;
        let bestScore = 0;
        for (const it of allOpts) {
            if (it.offsetHeight === 0 || it.offsetWidth === 0) continue;
            const t = (it.innerText || it.textContent || '').trim();
            if (!t || t === '请选择' || t.includes('暂无') || t.includes('没有')) continue;
            const tNorm = normalize(t);
            if (!tNorm) continue;
            if (tNorm === wNorm) return it;
            if (tNorm.includes(wNorm) || wNorm.includes(tNorm)) {
                const score = Math.min(tNorm.length, wNorm.length) / Math.max(tNorm.length, wNorm.length);
                if (score > bestScore) { bestScore = score; bestMatch = it; }
            }
        }
        return bestMatch;
    };

    const findPopupSearchInput = () => {
        const popups = document.querySelectorAll('.next-overlay-wrapper, .next-select-popup, .next-menu, .options-list, [class*="popup"], [class*="dropdown"]');
        for (const p of popups) {
            if (p.offsetHeight === 0) continue;
            const inp = p.querySelector('input:not([readonly]):not([type="hidden"])');
            if (inp && inp.offsetHeight > 0) return inp;
        }
        return null;
    };

    const pickOption = (opt) => {
        if (!opt) return false;
        opt.scrollIntoView({block: 'center'});
        nativeMouseClick(opt);
        confirmInput(opt);
        return true;
    };

    const tryPick = async (word, maxRounds = 5) => {
        for (let i = 0; i < maxRounds; i++) {
            const opt = findOption(word);
            if (opt) {
                pickOption(opt);
                log(`✅ setSimpleSelect: 选中 "${opt.innerText?.trim()}" for "${word}"`, 'info');
                await sleep3(80);
                document.body.dispatchEvent(new KeyboardEvent('keydown', {key: 'Escape', keyCode: 27, bubbles: true}));
                document.body.dispatchEvent(new KeyboardEvent('keyup', {key: 'Escape', keyCode: 27, bubbles: true}));
                await sleep3(80);
                trigger.dispatchEvent(new FocusEvent('blur', {bubbles: true}));
                return true;
            }
            await sleep3(100);
        }
        return false;
    };

    const trySearchAndPick = async (word) => {
        const searchInp = findPopupSearchInput();
        if (!searchInp) return false;
        log(`ℹ️ 找到下拉搜索框，搜索 "${word}"`, 'info');
        searchInp.focus();
        setInputValue(searchInp, String(word));
        searchInp.dispatchEvent(new Event('input', {bubbles: true}));
        searchInp.dispatchEvent(new Event('change', {bubbles: true}));
        confirmInput(searchInp);
        await sleep3(200);
        return await tryPick(word, 5);
    };

    let ok = false;
    let used = '';

    const fill = async (word) => {
        // 1. 先直接找
        if (await tryPick(word, 3)) return true;
        // 2. 找搜索框搜索
        if (await trySearchAndPick(word)) return true;
        // 3. 滚动查找
        const dropdown = document.querySelector('.next-overlay-wrapper, .next-select-popup, .options-list, .next-menu');
        if (dropdown) {
            for (let s = 0; s < 12; s++) {
                const opt = findOption(word);
                if (opt && pickOption(opt)) {
                    log(`✅ setSimpleSelect: 滚动后选中 "${opt.innerText?.trim()}"`, 'info');
                    await sleep3(80);
                    document.body.dispatchEvent(new KeyboardEvent('keydown', {key: 'Escape', keyCode: 27, bubbles: true}));
                    document.body.dispatchEvent(new KeyboardEvent('keyup', {key: 'Escape', keyCode: 27, bubbles: true}));
                    await sleep3(80);
                    trigger.dispatchEvent(new FocusEvent('blur', {bubbles: true}));
                    return true;
                }
                dropdown.scrollTop += 200;
                await sleep3(80);
            }
        }
        return false;
    };

    if (val) { ok = await fill(val); if (ok) used = val; }
    if (!ok && fallback) {
        log(`🔄 ${labelHint} 原值 "${val}" 未找到，尝试 fallback "${fallback}"`, 'warn');
        const searchInp = findPopupSearchInput();
        if (searchInp) {
            searchInp.focus();
            document.execCommand('selectAll', false, null);
            document.execCommand('delete', false, null);
            searchInp.value = '';
            searchInp.dispatchEvent(new Event('input', {bubbles: true}));
            searchInp.dispatchEvent(new Event('change', {bubbles: true}));
            await sleep3(100);
        } else {
            nativeMouseClick(trigger);
            await sleep3(150);
        }
        ok = await fill(fallback);
        if (ok) used = fallback;
    }

    if (!ok) {
        log(`⚠️ setSimpleSelect: 未找到选项 "${val}" (fallback: ${fallback})`, 'warn');
        document.body.dispatchEvent(new KeyboardEvent('keydown', {key: 'Escape', keyCode: 27, bubbles: true}));
        document.body.dispatchEvent(new KeyboardEvent('keyup', {key: 'Escape', keyCode: 27, bubbles: true}));
    }
    return { ok, used };
}

async function setSearchDropdownPage3(containerId, val, labelHint, fallback) {
    if (!val && !fallback) return { ok: false, used: '' };
    const c = containerId ? (typeof containerId === 'object' ? containerId : null) : findFieldContainer('', labelHint);
    if (!c) return { ok: false, used: '' };
    c.scrollIntoView({block: 'center'});
    await sleep3(50);

    const trigger = c.querySelector('.next-select-trigger');
    if (!trigger) return { ok: false, used: '' };
    nativeMouseClick(trigger);
    await sleep3(150);

    const normalize = (s) => String(s).toLowerCase().replace(/[\s\-_/\\]/g, '').trim();

    const findOptionInList = () => {
        const wNorm = normalize(val);
        const allOpts = document.querySelectorAll('.options-item, .next-menu-item, li[role="option"], li');
        for (const it of allOpts) {
            if (it.offsetHeight === 0) continue;
            const t = (it.innerText || '').trim();
            if (!t || t === '请选择' || t.includes('暂无')) continue;
            const tNorm = normalize(t);
            if (tNorm === wNorm || tNorm.includes(wNorm) || wNorm.includes(tNorm)) return it;
        }
        return null;
    };

    const pickOption = async (opt) => {
        if (!opt) return false;
        opt.scrollIntoView({block: 'center'});
        await sleep3(50);
        nativeMouseClick(opt);
        confirmInput(opt);
        await sleep3(30);
        document.body.dispatchEvent(new KeyboardEvent('keydown', {key: 'Escape', keyCode: 27, bubbles: true}));
        document.body.dispatchEvent(new KeyboardEvent('keyup', {key: 'Escape', keyCode: 27, bubbles: true}));
        await sleep3(50);
        trigger.dispatchEvent(new FocusEvent('blur', {bubbles: true}));
        return true;
    };

    // 先在第一屏找
    for (let i = 0; i < 3; i++) {
        const opt = findOptionInList();
        if (opt && await pickOption(opt)) return { ok: true, used: val };
        await sleep3(50);
    }

    // 找搜索框，有就搜索
    let searchInp = null;
    for (let i = 0; i < 5; i++) {
        const all = document.querySelectorAll('.next-select-search input, .options-search input, .next-select-popup input, .next-overlay-wrapper input, .next-menu input, input[placeholder*="搜索"], input[placeholder*="输入"]');
        for (const el of all) {
            if (el.offsetHeight > 0 && !el.readOnly) { searchInp = el; break; }
        }
        if (searchInp) break;
        await sleep3(80);
    }

    if (searchInp) {
        searchInp.focus();
        setInputValue(searchInp, String(val));
        searchInp.dispatchEvent(new Event('input', { bubbles: true }));
        searchInp.dispatchEvent(new Event('change', { bubbles: true }));
        confirmInput(searchInp);
        await sleep3(200);
        for (let i = 0; i < 5; i++) {
            const opt = findOptionInList();
            if (opt && await pickOption(opt)) return { ok: true, used: val };
            await sleep3(100);
        }
    } else {
        // 无搜索框，滚动下拉列表查找
        const dropdown = document.querySelector('.next-overlay-wrapper, .next-select-dropdown, .options-list, [class*="dropdown"]');
        if (dropdown) {
            for (let scrollAttempt = 0; scrollAttempt < 10; scrollAttempt++) {
                const opt = findOptionInList();
                if (opt && await pickOption(opt)) return { ok: true, used: val };
                dropdown.scrollTop += 200;
                await sleep3(100);
            }
        }
    }

    // fallback
    if (fallback) {
        log(`🔄 ${labelHint} 原值 "${val}" 未找到，尝试 fallback "${fallback}"`, 'warn');
        if (searchInp) {
            searchInp.focus();
            document.execCommand('selectAll', false, null);
            document.execCommand('delete', false, null);
            searchInp.value = '';
            searchInp.dispatchEvent(new Event('input', {bubbles: true}));
            searchInp.dispatchEvent(new Event('change', {bubbles: true}));
            await sleep3(100);
            setInputValue(searchInp, String(fallback));
            searchInp.dispatchEvent(new Event('input', { bubbles: true }));
            searchInp.dispatchEvent(new Event('change', { bubbles: true }));
            confirmInput(searchInp);
            await sleep3(200);
        } else {
            nativeMouseClick(trigger);
            await sleep3(150);
        }
        const fNorm = normalize(fallback);
        const allOpts = document.querySelectorAll('.options-item, .next-menu-item, li[role="option"], li');
        for (const it of allOpts) {
            if (it.offsetHeight === 0) continue;
            const t = (it.innerText || '').trim();
            if (!t || t === '请选择') continue;
            const tNorm = normalize(t);
            if (tNorm === fNorm || tNorm.includes(fNorm) || fNorm.includes(tNorm)) {
                if (await pickOption(it)) return { ok: true, used: fallback };
            }
        }
    }

    document.body.dispatchEvent(new KeyboardEvent('keydown', {key: 'Escape', keyCode: 27, bubbles: true}));
    document.body.dispatchEvent(new KeyboardEvent('keyup', {key: 'Escape', keyCode: 27, bubbles: true}));
    return { ok: false, used: '' };
}

function sleep3(ms) { return new Promise(r => setTimeout(r, ms)); }

async function ensureTabActive() {
    if (document.visibilityState === 'visible') return true;
    try {
        await chrome.runtime.sendMessage({ action: 'activateTab' });
        for (let i = 0; i < 20; i++) {
            await sleep3(50);
            if (document.visibilityState === 'visible') return true;
        }
    } catch (e) {
        console.warn('activateTab failed:', e);
    }
    return document.visibilityState === 'visible';
}

async function scrollAndFind(findFn, maxAttempts = 6, scrollStep = 400) {
    for (let i = 0; i < maxAttempts; i++) {
        const el = findFn();
        if (el) {
            if (el.scrollIntoView) {
                el.scrollIntoView({block: 'center'});
                await sleep3(200);
                const el2 = findFn();
                if (el2) return el2;
            } else {
                return el;
            }
        }
        window.scrollBy(0, scrollStep);
        await sleep3(200);
    }
    const el = findFn();
    if (el && el.scrollIntoView) {
        el.scrollIntoView({block: 'center'});
        await sleep3(200);
    }
    return el;
}

async function scrollToSection(sectionText, maxAttempts = 6) {
    return scrollAndFind(() => {
        const sections = document.querySelectorAll('[role="all"]');
        for (const sec of sections) {
            const text = (sec.textContent || '').replace(/\s+/g, ' ').trim();
            if (text.includes(sectionText)) return sec;
        }
        return null;
    }, maxAttempts);
}

async function waitForProvinceField() {
    const maxWait = 5000;
    const interval = 200;
    let elapsed = 0;
    while (elapsed < maxWait) {
        const provinceContainer = findFieldContainer('', '省份');
        if (provinceContainer) {
            log('ℹ️ 省份字段已渲染', 'info');
            return true;
        }
        await sleep3(interval);
        elapsed += interval;
    }
    log('⚠️ 省份字段未在5秒内渲染', 'warn');
    return false;
}

// ============================================================
// 🖼️ 上传主图 fillImagesPage3
// 输入方式: CDP DOM.setFileInputFiles 直接操作文件选择器
// 遇到的问题:
//   1. 页面有隐藏的file input，直接选容易选错
//   2. 换电脑后本地文件路径失效
//   3. React文件上传组件需要正确触发change事件
//   4. 上传是异步操作，菜单项同步判断会误判"未完成"
// 解决方案:
//   1. 通过 background.js 调用 Chrome DevTools Protocol
//   2. 使用 DOM.getDocument + DOM.querySelector 精确定位 nodeId
//   3. 三种降级路径: CDP本地路径 → Blob+DataTransfer → 直接URL上传
//   4. 上传后等待2-3秒检测结果
//   5. 监听 uploadResult 消息等待最终结果，菜单项可正确判断成功/失败
// ============================================================
async function fillImagesPage3(product) {
    const results = [];
    let imgSection = null;
    
    if (window.smartFind && typeof window.smartFind.find === 'function') {
        imgSection = window.smartFind.find('page3', 'mainImageSection');
    }
    
    if (!imgSection) {
        const mainImageSelectors = window.selectors && window.selectors.getList ?
            window.selectors.getList('page3', 'mainImageSection') :
            ['.sell-card', '#struct-image', '[class*="main-image"]', '[class*="image-section"]'];
        imgSection = await scrollAndFind(() => document.querySelector(mainImageSelectors.join(',')), 5);
    }
    
    if (imgSection) {
        imgSection.scrollIntoView({block: 'center'});
        await sleep3(300);
    }

    let imagePath;
    if (IMAGE_DIR && product.row) {
        const sep = IMAGE_DIR.includes('/') ? '/' : '\\';
        imagePath = IMAGE_DIR + sep + 'row' + product.row + '_main.' + IMG_EXT;
    } else {
        imagePath = product.imagePath;
    }

    if (imagePath) {
        results.push('⏳ 主图上传中，请稍候...');
        chrome.runtime.sendMessage({ action: 'uploadMainImage', imagePath, pageType: 'page3' }, () => {});

        const uploadResult = await new Promise((resolve) => {
            const listener = (request) => {
                if (request.action === 'uploadResult') {
                    chrome.runtime.onMessage.removeListener(listener);
                    resolve(request.result);
                }
            };
            chrome.runtime.onMessage.addListener(listener);
        });

        if (uploadResult && uploadResult.ok) {
            results.push('✅ 主图上传成功');
        } else {
            results.push('❌ 主图上传失败: ' + (uploadResult?.error || '未知错误'));
        }
    } else {
        results.push('⚠️ 主图: 无图片路径');
    }
    return results;
}

// ============================================================
// 📌 填入商品名称 fillTitlePage3
// 输入方式: setInputValue (React value setter + input/change事件)
// 遇到的问题:
//   1. 直接修改input.value React不识别，值会被重置
//   2. 页面未滚动到对应区域时input可能未渲染
// 解决方案:
//   1. 使用 Object.getOwnPropertyDescriptor 获取原型链上的value setter
//   2. 通过 desc.set.call() 调用原生setter触发React更新
//   3. 使用 scrollAndFind 滚动查找确保元素已渲染
// ============================================================
async function fillTitlePage3(product) {
    const results = [];
    const titleVal = product.title || product.title_en || product.seo_title || product.seo_title_en || '';
    if (titleVal) {
        let ti = null;
        
        if (window.smartFind && typeof window.smartFind.find === 'function') {
            ti = window.smartFind.find('page2', 'titleInput');
        }
        
        if (!ti) {
            const titleSelectors = window.selectors && window.selectors.getList ?
                window.selectors.getList('page2', 'titleInput') :
                ['input#productTitle', 'input[name="title"]', '.title-input input'];
            ti = await scrollAndFind(() => document.querySelector(titleSelectors.join(',')), 4);
        }
        
        if (ti) {
            await realClick(ti);
            await sleep3(200);
            ti.focus();
            document.execCommand('selectAll', false, null);
            await sleep3(50);
            for (const ch of String(titleVal)) {
                document.execCommand('insertText', false, ch);
                await sleep3(8);
            }
            ti.dispatchEvent(new Event('input', {bubbles: true}));
            ti.dispatchEvent(new Event('change', {bubbles: true}));
            await sleep3(100);
            pressEnter(ti);
            await sleep3(200);
        }
        results.push('✅ 标题');
    }
    return results;
}

// ============================================================
// 📁 选择商品分组 fillGroupPage3
// 输入方式: 点击下拉 → 遍历选项 → nativeMouseClick选中
// 遇到的问题:
//   1. 分组树结构层级深，选项懒加载
//   2. 类目不同分组名称不同，不能硬编码
// 解决方案:
//   1. 点击输入框展开下拉树，等待1秒加载
//   2. 遍历 .next-tree-node-label 匹配类目关键词
//   3. 使用 buildGroupCandidates 根据类目生成候选词
//   4. 模糊匹配（大小写不敏感、包含匹配）
// ============================================================
async function fillGroupPage3(product) {
    const results = [];
    let pg = null;
    
    if (window.smartFind && typeof window.smartFind.find === 'function') {
        pg = window.smartFind.find('page3', 'groupInput');
    }
    
    if (!pg) {
        const groupSelectors = window.selectors && window.selectors.getList ?
            window.selectors.getList('page3', 'groupInput') :
            ['input[placeholder="请选择分组"]', 'input[placeholder*="分组"]', '[class*="group"] input'];
        pg = await scrollAndFind(() => document.querySelector(groupSelectors.join(',')), 4);
    }
    if (!pg) {
        results.push('⚠️ 商品分组: 未找到分组输入框');
        return results;
    }
    
    await realClick(pg);
    await sleep3(1000);
    
    const candidates = buildGroupCandidates(product.category);
    log(`📋 分组候选词: ${candidates.join(', ')}`, 'info');
    
    let foundOption = null;
    let foundName = '';

    for (const target of candidates) {
        if (!target) continue;
        const tLower = String(target).toLowerCase();
        
        const optionSelectors = [
            '.next-tree-node-label-selectable',
            '.next-tree-node-label',
            '.next-select-option',
            '.next-menu-item',
            '[role="treeitem"]',
            '[role="option"]',
        ];
        
        for (const sel of optionSelectors) {
            const opts = document.querySelectorAll(sel);
            for (const opt of opts) {
                if (opt.offsetHeight === 0) continue;
                const t = (opt.textContent || '').trim();
                if (!t) continue;
                if (t.toLowerCase() === tLower || t.toLowerCase().includes(tLower)) {
                    foundOption = opt;
                    foundName = t;
                    log(`🔍 匹配到分组选项: "${t}" (通过"${target}")`, 'info');
                    break;
                }
            }
            if (foundOption) break;
        }
        if (foundOption) break;
    }
    
    if (foundOption) {
        foundOption.scrollIntoView({block: 'center'});
        await sleep3(300);

        // 先直接点击可交互的 label 元素（nativeMouseClick 触发 DOM 事件，对 React 更可靠）
        const labelEl = foundOption.closest('.next-tree-node-label-selectable, .next-tree-node-label') || foundOption;
        let treeItem = labelEl.closest('.next-tree-node-inner');
        let isSelected = false;

        // 方案1: nativeMouseClick 直接触发 DOM 事件（绕过 CDP 坐标偏差）
        log(`🖱️ 方案1: nativeMouseClick 点击标签: ${foundName}`, 'info');
        nativeMouseClick(labelEl);
        await sleep3(800);

        if (treeItem) {
            isSelected = treeItem.getAttribute('aria-selected') === 'true';
        }
        if (!isSelected) {
            log(`🔄 方案1 未生效，尝试方案2: realClick(treeItem)`, 'warn');
            await realClick(treeItem || labelEl);
            await sleep3(800);
            if (treeItem) {
                isSelected = treeItem.getAttribute('aria-selected') === 'true';
            }
        }
        // 方案3: 如果 aria-selected 仍未更新，直接点击 treeItem 自身
        if (!isSelected && treeItem) {
            log(`🔄 方案3: 直接 nativeMouseClick treeItem`, 'warn');
            nativeMouseClick(treeItem);
            await sleep3(800);
            isSelected = treeItem.getAttribute('aria-selected') === 'true';
        }
        // 方案4: 强制设置 aria-selected + 派发事件
        if (!isSelected && treeItem) {
            log(`🔄 方案4: 强制触发选中事件`, 'warn');
            treeItem.setAttribute('aria-selected', 'true');
            treeItem.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
            await sleep3(300);
            isSelected = treeItem.getAttribute('aria-selected') === 'true';
        }

        // 关闭下拉菜单
        document.body.click();
        await sleep3(500);

        if (isSelected) {
            log(`✅ 商品分组 = ${foundName} (已选中)`, 'success');
            results.push('✅ 商品分组 = ' + foundName);
        } else {
            log(`⚠️ 商品分组 = ${foundName} (选择状态未知，可能未生效)`, 'warn');
            results.push('⚠️ 商品分组 = ' + foundName + ' (选择状态未知)');
        }
    } else {
        document.body.click();
        results.push('⚠️ 商品分组: 未找到匹配选项');
    }
    return results;
}

// ============================================================
// 📋 填入商品属性 fillAttributesPage3
// 输入方式: 按label动态匹配 → 区分直接输入框 / 搜索下拉框
// 遇到的问题:
//   1. 属性字段ID是动态的(struct-p-xxxx)，不能硬编码
//   2. 有两种输入类型: 直接输入框 和 搜索下拉框
//   3. 原产地填完后省份字段才渲染，需要等待
//   4. 材质字段是特殊的auto模式，不能按逗号拆分
//   5. 搜索下拉框搜索一次可能找不到，需要备用值重试
// 解决方案:
//   1. 按label文字动态匹配，不依赖固定ID
//   2. placeholder含'输入'→直接输入，否则→搜索下拉框（打开→搜索→选中）
//   3. 搜索下拉框两次搜索: 目标值 + 备用值，间隔500ms，输入后等800ms
//   4. 材质字段特殊处理: 整串输入不拆分(如'95% Pima Cotton, 5% Spandex')
//   5. 填入顺序: 填到原产地后立即等待省份字段渲染，继续填其他属性
//   6. 移除了供应类型、7天快速打样、型号、品牌等不需要的字段
// ============================================================
async function fillAttributesPage3(product) {
    const results = [];
    const attrSection = await scrollAndFind(() => {
        const sections = document.querySelectorAll('[role="all"]');
        for (const sec of sections) {
            const text = (sec.textContent || '').replace(/\s+/g, ' ').trim();
            if (text.includes('商品属性') || text.includes('产品属性')) return sec;
        }
        return document.querySelector('.sell-card, #struct-attribute, [class*="attribute"]');
    }, 5);
    if (attrSection) {
        attrSection.scrollIntoView({block: 'center'});
        await sleep3(150);
    }

    let clearBtn = null;
    
    if (window.smartFind && typeof window.smartFind.find === 'function') {
        const btns = window.smartFind.findAll('page3', 'clearPredictButton');
        clearBtn = btns.find(el => el.offsetWidth > 0 && el.offsetHeight > 0);
        if (clearBtn) {
            log(`🧹 通过智能查找找到清除按钮`, 'info');
        }
    }
    
    if (!clearBtn) {
        const clearSelectors = window.selectors && window.selectors.getList ?
            window.selectors.getList('page3', 'clearPredictButton') :
            ['.predict-click-clear button', '.catProp-predict-click-clear button', '.sell-catProp-ai-top button', '.sell-catProp-ai-top .next-btn'];
        for (const sel of clearSelectors) {
            const el = document.querySelector(sel);
            if (el && el.offsetWidth > 0 && el.offsetHeight > 0) {
                clearBtn = el;
                log(`🧹 通过选择器找到清除按钮: ${sel}`, 'info');
                break;
            }
        }
    }
    if (!clearBtn) {
        clearBtn = Array.from(document.querySelectorAll('button')).find(el => {
            const t = (el.textContent || '').replace(/\s/g, '');
            return t.includes('一键清除') && t.includes('智能预填');
        });
        if (clearBtn && clearBtn.offsetWidth === 0) clearBtn = null;
    }
    if (clearBtn) {
        log('🧹 点击一键清除智能预填...', 'info');
        clearBtn.scrollIntoView({block: 'center'});
        await sleep3(100);
        await realClick(clearBtn);
        await sleep3(800);
    } else {
        log('⚠️ 未找到一键清除智能预填按钮', 'warn');
    }

    const { required, optional } = buildAttributeFields(product);

    log('📝 填入必填项...', 'info');
    for (const field of required) {
        try {
            const res = await fillAttributeField(field, product);
            if (!res) continue;
            results.push(res.ok ? `✅ ${res.lbl} = ${res.usedVal}` : `⚠️ ${res.lbl}: 未找到`);
        } catch (e) {
            log(`❌ ${field.lbl} 填入异常: ${e.message}`, 'error');
            results.push(`⚠️ ${field.lbl}: 异常`);
        }
    }

    log('📝 填入其他属性...', 'info');
    let expandBtn = null;
    
    if (window.smartFind && typeof window.smartFind.find === 'function') {
        expandBtn = window.smartFind.find('page3', 'expandOtherButton');
    }
    
    if (!expandBtn) {
        const expandSelectors = window.selectors && window.selectors.getList ?
            window.selectors.getList('page3', 'expandOtherButton') :
            ['.sell-catProp-ai-other-expand', '.catProp-ai-other-expand', '[class*="other-expand"]'];
        expandBtn = document.querySelector(expandSelectors.join(','));
    }
    
    if (expandBtn) {
        const btnText = (expandBtn.textContent || '').trim();
        if (btnText.includes('展开') || btnText.includes('更多')) {
            log('ℹ️ 展开其他属性面板', 'info');
            nativeMouseClick(expandBtn);
            await sleep3(500);
        }
    }
    let otherSection = null;
    
    if (window.smartFind && typeof window.smartFind.find === 'function') {
        otherSection = window.smartFind.find('page3', 'otherAttributeSection');
    }
    
    if (!otherSection) {
        const otherSelectors = window.selectors && window.selectors.getList ?
            window.selectors.getList('page3', 'otherAttributeSection') :
            ['.sell-catProp-ai-other', '[class*="ai-other"]'];
        otherSection = document.querySelector(otherSelectors.join(','));
    }
    
    if (otherSection) {
        otherSection.scrollIntoView({block: 'start'});
        await sleep3(200);
    }
    for (const field of optional) {
        try {
            const res = await fillAttributeField(field, product);
            if (!res) continue;
            results.push(res.ok ? `✅ ${res.lbl} = ${res.usedVal}` : `⚠️ ${res.lbl}: 未找到`);
        } catch (e) {
            log(`❌ ${field.lbl} 填入异常: ${e.message}`, 'error');
            results.push(`⚠️ ${field.lbl}: 异常`);
        }
    }

    const genderField = optional.find(f => f.lbl === '性别');
    if (genderField && genderField.val) {
        log('🔄 补填性别...', 'info');
        const genderC = findFieldContainer('', '性别');
        if (genderC) {
            const genderInp = genderC.querySelector('input:not([readonly]):not([type="hidden"])');
            if (genderInp) {
                genderC.scrollIntoView({block: 'center'});
                await sleep3(100);
                genderInp.focus();
                await sleep3(30);
                document.execCommand('selectAll', false, null);
                document.execCommand('delete', false, null);
                await sleep3(20);
                for (const ch of String(genderField.val)) {
                    document.execCommand('insertText', false, ch);
                    await sleep3(5);
                }
                genderInp.dispatchEvent(new Event('input', {bubbles: true}));
                genderInp.dispatchEvent(new Event('change', {bubbles: true}));
                confirmInput(genderInp);
                await sleep3(200);
                pressEnter(genderInp);
                await sleep3(150);
                genderInp.dispatchEvent(new FocusEvent('blur', {bubbles: true}));
                log('✅ 性别补填完成', 'success');
                results.push('✅ 性别(补填) = ' + genderField.val);
            }
        }
    }

    const collarField = optional.find(f => f.lbl === '领子' || f.lbl === '领型' || f.lbl === '领子/领型');
    if (collarField && collarField.val) {
        log('🔄 补填领子...', 'info');
        const collarLabels = ['领子', '领型'];
        let collarC = null;
        for (const lbl of collarLabels) {
            collarC = findFieldContainer('', lbl);
            if (collarC) {
                log(`🔍 领子字段匹配标签: ${lbl}`, 'info');
                break;
            }
        }
        if (collarC) {
            const collarInp = collarC.querySelector('input:not([readonly]):not([type="hidden"])');
            if (collarInp) {
                collarC.scrollIntoView({block: 'center'});
                await sleep3(100);
                collarInp.focus();
                await sleep3(30);
                document.execCommand('selectAll', false, null);
                document.execCommand('delete', false, null);
                await sleep3(20);
                for (const ch of String(collarField.val)) {
                    document.execCommand('insertText', false, ch);
                    await sleep3(5);
                }
                collarInp.dispatchEvent(new Event('input', {bubbles: true}));
                collarInp.dispatchEvent(new Event('change', {bubbles: true}));
                confirmInput(collarInp);
                await sleep3(200);
                pressEnter(collarInp);
                await sleep3(150);
                collarInp.dispatchEvent(new FocusEvent('blur', {bubbles: true}));
                log('✅ 领子补填完成', 'success');
                results.push('✅ 领子(补填) = ' + collarField.val);
            }
        }
    }

    const cat = (product.category || '').toLowerCase();
    const numMatch = cat.match(/\((\d+)\)/);
    const isPolo = numMatch ? parseInt(numMatch[1]) === 2 : (
        cat.includes("polo") ||
        cat.includes("polo衫") ||
        cat.includes("polo shirt") ||
        cat.includes("men's polo")
    );
    const _hasVal = (v) => v && String(v).trim() && String(v).toLowerCase() !== 'none';
    const sleeveVal = _hasVal(product.sleeve_en) ? product.sleeve_en : 'Short Sleeve';
    if (isPolo && sleeveVal) {
        log('🔄 最后填袖子款式...', 'info');
        const sleeveLabels = ['袖子款式', '袖长', '袖型'];
        let sleeveC = null;
        for (const lbl of sleeveLabels) {
            sleeveC = findFieldContainer('', lbl);
            if (sleeveC) {
                log(`🔍 袖子款式字段匹配标签: ${lbl}`, 'info');
                break;
            }
        }
        if (sleeveC) {
            const mode = detectFieldMode(sleeveC);
            log(`ℹ️ 袖子款式字段模式: ${mode}`, 'info');
            let ok = false;
            let usedVal = sleeveVal;

            const sleeveInp = sleeveC.querySelector('input:not([readonly]):not([type="hidden"])');
            if (sleeveInp) {
                sleeveC.scrollIntoView({block: 'center'});
                await sleep3(150);
                sleeveInp.focus();
                await sleep3(50);
                document.execCommand('selectAll', false, null);
                document.execCommand('delete', false, null);
                await sleep3(30);
                for (const ch of String(sleeveVal)) {
                    document.execCommand('insertText', false, ch);
                    await sleep3(8);
                }
                sleeveInp.dispatchEvent(new Event('input', {bubbles: true}));
                sleeveInp.dispatchEvent(new Event('change', {bubbles: true}));
                confirmInput(sleeveInp);
                await sleep3(200);
                pressEnter(sleeveInp);
                await sleep3(200);
                sleeveInp.dispatchEvent(new FocusEvent('blur', {bubbles: true}));
                ok = true;
            }

            if (ok) {
                const labelEl = sleeveC.querySelector('.label, .oly-label-container, label, .next-form-item-label, [class*="label"]');
                if (labelEl) {
                    nativeMouseClick(labelEl);
                }
                await sleep3(150);

                const verifyVal = getFieldCurrentValue(sleeveC, mode);
                if (verifyVal && normalizeCompare(verifyVal, usedVal)) {
                    log('✅ 袖子款式补填完成: ' + verifyVal, 'success');
                    results.push('✅ 袖子款式(最后填) = ' + verifyVal);
                } else {
                    log(`⚠️ 袖子款式补填验证失败，期望: ${usedVal}, 实际: ${verifyVal}`, 'warn');
                    results.push('⚠️ 袖子款式(最后填): 验证失败');
                }
            } else {
                log('⚠️ 袖子款式输入失败', 'warn');
                results.push('⚠️ 袖子款式(最后填): 输入失败');
            }
        } else {
            log('⚠️ 袖子款式字段未找到', 'warn');
            results.push('⚠️ 袖子款式: 字段未找到');
        }
    }

    await finalAttributeAudit(required, optional, product);

    return results;
}

async function finalAttributeAudit(requiredFields, optionalFields, product) {
    log('🔍 最终属性审查：检查所有属性是否填入...', 'info');
    await sleep3(300);

    const allFields = [...requiredFields, ...optionalFields];
    const emptyFields = [];
    const filledFields = [];

    for (const field of allFields) {
        if (!field.val) continue;
        const c = findFieldContainer('', field.lbl);
        if (!c) {
            emptyFields.push({ ...field, reason: '字段未找到' });
            continue;
        }
        const mode = field.forceMode || detectFieldMode(c);
        const currentVal = getFieldCurrentValue(c, mode);
        if (!currentVal || currentVal.trim() === '') {
            emptyFields.push({ ...field, reason: '值为空' });
        } else {
            const match = normalizeCompare(currentVal, field.val);
            if (match) {
                filledFields.push(field.lbl);
            } else {
                emptyFields.push({ ...field, reason: '值不匹配', actual: currentVal });
            }
        }
    }

    if (emptyFields.length === 0) {
        log(`✅ 最终审查通过：所有 ${filledFields.length} 个属性均已填入`, 'success');
        return { filled: filledFields, empty: [] };
    }

    log(`⚠️ 最终审查发现 ${emptyFields.length} 个属性未填入/不匹配，开始补填...`, 'warn');
    for (const f of emptyFields) {
        log(`   ❌ ${f.lbl} - ${f.reason} (期望: ${f.val}${f.actual ? ', 实际: ' + f.actual : ''})`, 'warn');
    }

    let refilled = 0;
    let stillEmpty = [];

    for (const field of emptyFields) {
        log(`🔧 补填 ${field.lbl}...`, 'info');
        const res = await fillAttributeField(field, product);
        if (res && res.ok) {
            refilled++;
            filledFields.push(field.lbl);
            log(`✅ ${field.lbl} 补填成功`, 'success');
        } else if (field.fallback && field.fallback !== field.val) {
            log(`🔄 ${field.lbl} 原值失败，用fallback "${field.fallback}" 再试...`, 'warn');
            const fallbackField = { ...field, val: field.fallback };
            const res2 = await fillAttributeField(fallbackField, product);
            if (res2 && res2.ok) {
                refilled++;
                filledFields.push(field.lbl);
                log(`✅ ${field.lbl} 补填成功(fallback)`, 'success');
            } else {
                stillEmpty.push(field);
                log(`❌ ${field.lbl} 补填失败`, 'error');
            }
        } else {
            stillEmpty.push(field);
            log(`❌ ${field.lbl} 补填失败`, 'error');
        }
    }

    if (stillEmpty.length === 0) {
        log(`✅ 补填完成：新增 ${refilled} 个，所有 ${filledFields.length} 个属性均已填入`, 'success');
    } else {
        log(`📊 补填结果：新增 ${refilled} 个，仍失败 ${stillEmpty.length} 个：`, 'warn');
        for (const f of stillEmpty) {
            log(`   ❌ ${f.lbl} - ${f.reason} (期望: ${f.val})`, 'warn');
        }
        log(`📊 总计：已填入 ${filledFields.length} 个，未填入 ${stillEmpty.length} 个`, 'warn');
    }

    return { filled: filledFields, empty: stillEmpty };
}

async function uploadColorImageViaBlob(colorKey, colorLabel, itemIndex, imageUrl) {
    try {
        log(`📥 下载 ${colorLabel} 图片...`);
        const resp = await fetch(imageUrl, {
            headers: { 'Referer': 'https://www.doubao.com/' }
        });
        if (!resp.ok) throw new Error('HTTP ' + resp.status);
        
        const blob = await resp.blob();
        const file = new File([blob], `row_color_${colorKey}.png`, { type: 'image/png' });
        log(`✅ 下载完成: ${Math.round(blob.size / 1024)}KB`, 'success');

        const items = document.querySelectorAll('.posting-field-color .item, .item[role="item"], .posting-field-color-select .item');
        const item = items[itemIndex];
        if (!item) throw new Error('找不到颜色项');

        let fileInput = item.querySelector('input[type="file"]');
        if (!fileInput) {
            fileInput = document.querySelectorAll('.posting-field-color input[type="file"], .item input[type="file"]')[itemIndex];
        }
        if (!fileInput) throw new Error('找不到 file input');

        const dt = new DataTransfer();
        dt.items.add(file);
        
        const proto = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(fileInput), 'files');
        if (proto && proto.set) {
            proto.set.call(fileInput, dt.files);
        } else {
            fileInput.files = dt.files;
        }
        
        fileInput.dispatchEvent(new Event('change', { bubbles: true }));
        fileInput.dispatchEvent(new Event('input', { bubbles: true }));

        await sleep3(2000);

        return { ok: true };
    } catch (e) {
        log(`❌ Blob上传失败: ${e.message}`, 'error');
        return { ok: false, error: e.message };
    }
}

// ============================================================
// 🎨 填入商品颜色 fillColorsPage3
// 输入方式: 逐字输入颜色名 → 回车确认 → CDP/Blob上传颜色图
// 遇到的问题:
//   1. 颜色规格图开关默认关闭，需要先开启
//   2. 颜色输入框是combobox模式，需要逐字输入触发搜索
//   3. 换电脑后本地文件路径失效，颜色图上传失败
//   4. 上传图标需要hover后才显示file input
//   5. CDP方式依赖Chrome DevTools Protocol，不同环境可能不稳定
// 解决方案:
//   1. 先检测并开启"添加规格图"开关
//   2. 颜色名逐字输入(8ms/字)，触发input事件，点击空白确认
//   3. 颜色图上传三条路径:
//      - CDP DOM.setFileInputFiles (本地路径优先)
//      - Blob + DataTransfer (CDP失败时降级)
//      - 直接URL转Blob上传 (无本地路径时)
//   4. 上传前先hover上传图标500ms，等待file input出现
//   5. 上传后等待3秒检测结果
//   6. 颜色图从扩展存储获取，优先image_raw无水印URL
// ============================================================
async function fillColorsPage3(product) {
    const results = [];
    const colorList = [
        { key: 'white', label: 'White', labelAlt: '白色' },
        { key: 'black', label: 'Black', labelAlt: '黑色' },
        { key: 'gray', label: 'Gray', labelAlt: '灰色' },
        { key: 'navy', label: 'Navy', labelAlt: '军蓝色' }
    ];

    const colorSelect = await scrollAndFind(() => document.querySelector('.posting-field-color-select input[role="colorCombobox"]'), 4);
    if (!colorSelect) {
        results.push('❌ 未找到颜色输入框');
        return results;
    }

    const colorSection = colorSelect.closest('#struct-saleProp, .sell-o-addon, .posting-field-color') || document;
    colorSection.scrollIntoView({ block: 'center' });
    await sleep3(300);

    const specToggle = document.querySelector('.upload-image-switch .next-switch, .sell-o-addon-label .next-switch');
    if (specToggle) {
        if (specToggle.classList.contains('next-switch-off')) {
            specToggle.click();
            await sleep3(800);
            log('✅ 已开启添加规格图', 'success');
        } else {
            log('ℹ️ 添加规格图已开启');
        }
    } else {
        log('⚠️ 未找到规格图开关');
    }

    let uploadedCount = 0;

    for (let i = 0; i < colorList.length; i++) {
        const color = colorList[i];

        const allInputs = document.querySelectorAll('.posting-field-color-select input[role="colorCombobox"]');
        let targetInput = null;
        let targetItem = null;

        if (allInputs[i]) {
            targetInput = allInputs[i];
            targetItem = allInputs[i].closest('.item, [role="item"]');
        } else if (allInputs.length > 0) {
            targetInput = allInputs[allInputs.length - 1];
            targetItem = allInputs[allInputs.length - 1].closest('.item, [role="item"]');
        }

        if (!targetInput) {
            results.push(`⚠️ ${color.label}: 未找到输入框`);
            continue;
        }

        targetInput.scrollIntoView({ block: 'center' });
        await sleep3(200);
        await realClick(targetInput);
        await sleep3(300);
        targetInput.focus();
        document.execCommand('selectAll', false, null);
        await sleep3(50);
        document.execCommand('insertText', false, '');
        await sleep3(100);
        for (const ch of String(color.label)) {
            document.execCommand('insertText', false, ch);
            await sleep3(15);
        }
        targetInput.dispatchEvent(new Event('input', {bubbles: true}));
        targetInput.dispatchEvent(new Event('change', {bubbles: true}));
        await sleep3(200);
        confirmInput(targetInput);
        pressEnter(targetInput);
        await sleep3(500);

        const colorSection = document.querySelector('.posting-field-color, #struct-saleProp');
        if (colorSection) {
            const sectionRect = colorSection.getBoundingClientRect();
            const blankX = Math.round(sectionRect.left - 50);
            const blankY = Math.round(sectionRect.top + 50);
            const blankEl = document.elementFromPoint(blankX, blankY);
            if (blankEl && blankEl !== targetInput && !targetInput.contains(blankEl)) {
                blankEl.click();
            }
        }
        targetInput.blur();
        await sleep3(600);

        if (targetInput.value !== color.label) {
            log(`⚠️ ${color.label} 输入可能未成功，当前值: ${targetInput.value}`);
        }

        const pathResult = await new Promise((resolve) => {
            chrome.runtime.sendMessage({
                action: 'getColorImagePath',
                rowNum: product.row,
                color: color.key
            }, (resp) => {
                if (chrome.runtime.lastError) {
                    log(`❌ 获取颜色图失败: ${chrome.runtime.lastError.message}`, 'error');
                    resolve({ ok: false });
                } else {
                    log(`🔍 颜色图查询: row=${product.row}, color=${color.key}, resp类型=${typeof resp}, resp=${JSON.stringify(resp)}`, 'warn');
                    log(`🔍 颜色图查询: path=${resp?.path || '无'}, url=${resp?.url ? '有' : '无'}, _debug=${JSON.stringify(resp?._debug || {})}`, 'warn');
                    resolve(resp || { ok: false });
                }
            });
        });

        let imagePath = pathResult?.path;
        
        if (!imagePath && pathResult?.url) {
            log(`� ${color.label} 无本地路径，直接用Blob方式上传...`, 'warn');
            const blobRes = await uploadColorImageViaBlob(color.key, color.label, i, pathResult.url);
            if (blobRes?.ok) {
                uploadedCount++;
                log(`✅ ${color.label} 图上传成功（Blob方式）`, 'success');
            } else {
                results.push(`⚠️ ${color.label} 图上传失败: ${blobRes?.error || '未知错误'}`);
            }
            if (i < colorList.length - 1) {
                const addBtn = document.querySelector('.add-color-btn, [role="btn-add"]');
                if (addBtn) {
                    addBtn.click();
                    await sleep3(700);
                }
            }
            continue;
        }

        if (imagePath) {
            log(`📤 上传 ${color.label} 颜色图...`);

            const inputRect = targetInput.getBoundingClientRect();
            const wrapper = targetInput.closest('.next-select, .posting-field-color-select, .next-input');
            const container = targetItem || wrapper || targetInput.parentElement;

            let iconX = 0, iconY = 0;
            let foundIcon = false;

            const candidates = container.querySelectorAll('svg, [class*="upload"], [class*="image"], [class*="img"], [class*="picture"], i, .next-icon');
            for (const el of candidates) {
                const rect = el.getBoundingClientRect();
                if (rect.width > 0 && rect.height > 0 &&
                    rect.left > inputRect.right - 20 &&
                    Math.abs(rect.top + rect.height/2 - (inputRect.top + inputRect.height/2)) < 30) {
                    iconX = Math.round(rect.left + rect.width / 2);
                    iconY = Math.round(rect.top + rect.height / 2);
                    foundIcon = true;
                    break;
                }
            }

            if (!foundIcon) {
                const allVisible = container.querySelectorAll('*');
                for (const el of allVisible) {
                    const rect = el.getBoundingClientRect();
                    if (rect.width > 10 && rect.height > 10 &&
                        rect.left > inputRect.right - 10 &&
                        rect.left < inputRect.right + 80 &&
                        Math.abs(rect.top + rect.height/2 - (inputRect.top + inputRect.height/2)) < 30) {
                        iconX = Math.round(rect.left + rect.width / 2);
                        iconY = Math.round(rect.top + rect.height / 2);
                        foundIcon = true;
                        break;
                    }
                }
            }

            if (!foundIcon) {
                iconX = Math.round(inputRect.right + 30);
                iconY = Math.round(inputRect.top + inputRect.height / 2);
            }

            log(`📍 上传图标位置: (${iconX}, ${iconY})`);

            const uploadPromise = new Promise((resolve) => {
                const handler = (request, sender, sendResponse) => {
                    if (request.action === 'skuColorUploadResult') {
                        chrome.runtime.onMessage.removeListener(handler);
                        resolve(request.result || { ok: false });
                    }
                };
                chrome.runtime.onMessage.addListener(handler);

                chrome.runtime.sendMessage({
                    action: 'uploadSkuColorImage',
                    colorLabel: color.label,
                    imagePath: imagePath,
                    iconX,
                    iconY,
                    itemIndex: i
                }, (resp) => {
                    if (chrome.runtime.lastError) {
                        chrome.runtime.onMessage.removeListener(handler);
                        resolve({ ok: false, error: chrome.runtime.lastError.message });
                    }
                });

                setTimeout(() => {
                    chrome.runtime.onMessage.removeListener(handler);
                    resolve({ ok: false, error: '上传超时' });
                }, 30000);
            });

            const uploadRes = await uploadPromise;
            if (uploadRes?.ok) {
                uploadedCount++;
                log(`✅ ${color.label} 图上传成功`, 'success');
            } else {
                // CDP上传失败，尝试Blob方式兜底
                if (pathResult?.url) {
                    log(`🔄 ${color.label} CDP上传失败，尝试Blob方式上传...`, 'warn');
                    const blobRes = await uploadColorImageViaBlob(color.key, color.label, i, pathResult.url);
                    if (blobRes?.ok) {
                        uploadedCount++;
                        log(`✅ ${color.label} 图上传成功（Blob方式）`, 'success');
                    } else {
                        results.push(`⚠️ ${color.label} 图上传失败: ${blobRes?.error || uploadRes?.error || '未知错误'}`);
                    }
                } else {
                    results.push(`⚠️ ${color.label} 图上传失败: ${uploadRes?.error || '未知错误'}`);
                }
            }
        } else if (pathResult?.url) {
            results.push(`ℹ️ ${color.label} 下载失败，跳过上传`);
        } else {
            results.push(`ℹ️ ${color.label} 无图片，跳过上传`);
        }

        if (i < colorList.length - 1) {
            const addBtn = document.querySelector('.add-color-btn, [role="btn-add"]');
            if (addBtn) {
                addBtn.click();
                await sleep3(700);
            } else {
                results.push('⚠️ 未找到「+ 添加」按钮');
            }
        }
    }

    results.push(`✅ 颜色规格: 已添加 ${colorList.length} 个颜色，上传 ${uploadedCount} 张图`);
    return results;
}

// ============================================================
// 📏 填入商品尺码 fillSizesPage3
// 输入方式: 遍历复选框label文字匹配 → 点击wrapper选中
// 遇到的问题:
//   1. 尺码label显示文字和value可能不一致(如'2 XL' vs '2XL')
//   2. 复选框组有多个，需要定位到正确的尺码区域
// 解决方案:
//   1. 建立尺码映射表 szMap: S→S, M→M, L→L, XL→Xl, 2XL→2 XL, 3XL→3 XL
//   2. 遍历 .next-checkbox-label 精确匹配文字
//   3. 通过 .next-checkbox-wrapper 判断是否已选中，避免重复点击
// ============================================================
async function fillSizesPage3(product) {
    const results = [];
    const defaultSizes = ['S', 'M', 'L', 'XL', '2XL', '3XL'];
    const sizeSection = await scrollAndFind(() => document.querySelector('[class*="size"] .next-checkbox-group, [class*="spec"] .next-checkbox-group, .next-checkbox-group'), 5);
    if (sizeSection) {
        await sleep3(300);
    }
    const szMap = {'S':'S','M':'M','L':'L','XL':'Xl','2XL':'2 XL','3XL':'3 XL'};
    defaultSizes.forEach(s => {
        const cb = szMap[s] || s;
        document.querySelectorAll('.next-checkbox-wrapper .next-checkbox-label').forEach(l => {
            if ((l.innerText || '').trim() === cb) {
                const wrapper = l.closest('.next-checkbox-wrapper');
                if (wrapper && !wrapper.classList.contains('checked')) wrapper.click();
            }
        });
    });
    results.push(`✅ 尺码: ${defaultSizes.join(', ')}`);
    return results;
}

// ============================================================
// 📐 选择尺码模板 fillSizeTemplate
// 输入方式: 点击下拉 → 轮询选项 → nativeMouseClick选中
// 遇到的问题:
//   1. 模板选择器有多种DOM结构，选择器不固定
//   2. 下拉选项懒加载，需要轮询等待
//   3. 根据类目不同需要选不同模板(如Polo选商务正装)
//   4. 选择模板后会弹出"清除尺码表数据"确认对话框
// 解决方案:
//   1. 多选择器降级尝试: .size-chart-select-template-container → .select-template → 等
//   2. 10轮轮询等待下拉选项渲染，每轮200ms
//   3. 根据类目关键词匹配: polo/商务/正装 → 男士商务正装通用，默认 → 男士T恤通用
//   4. 选择后自动检测确认对话框(role=alertdialog)，点击"确定"按钮
//   5. 确认对话框检测: 150ms间隔，最多3秒
// ============================================================
async function fillSizeTemplate(product) {
    const results = [];
    
    const sizeSection = await scrollAndFind(() => document.querySelector('.size-chart-table-main, .country-size-chart-container, .size-chart-qiankun'), 5);
    if (sizeSection) {
        await sleep3(300);
    }
    
    // 尝试多种选择器找到模板下拉框
    let templateSelect = null;
    const selectCandidates = [
        '.size-chart-select-template-container .next-select-trigger',
        '.select-template .next-select-trigger',
        '.size-chart-table-main .next-select-trigger',
        '#template-select .next-select-trigger',
    ];
    
    for (const sel of selectCandidates) {
        const el = document.querySelector(sel);
        if (el && el.offsetHeight > 0) {
            templateSelect = el;
            log(`🔍 找到模板选择器: ${sel}`, 'info');
            break;
        }
    }
    
    if (!templateSelect) {
        // 再试：找包含"模板"文字的下拉框
        const allTriggers = document.querySelectorAll('.next-select-trigger');
        for (const t of allTriggers) {
            const label = t.querySelector('.next-input-label');
            if (label && (label.innerText || '').includes('模板')) {
                templateSelect = t;
                log('🔍 通过文字找到模板选择器', 'info');
                break;
            }
        }
    }
    
    if (!templateSelect) {
        results.push('⚠️ 未找到尺码模板选择器');
        return results;
    }
    
    templateSelect.scrollIntoView({block: 'center'});
    await sleep3(300);
    await realClick(templateSelect);
    await sleep3(1000);
    
    // 根据类目确定要选择的模板
    const category = (product.category || '').toLowerCase();
    const numMatch = category.match(/\((\d+)\)/);
    
    let isPolo = false, isTshirt = false, isShirt = false, isHoodie = false, isSweatshirt = false;
    if (numMatch) {
        const num = parseInt(numMatch[1]);
        isTshirt = num === 1;
        isPolo = num === 2;
        isShirt = num === 3;
        isHoodie = num === 4;
        isSweatshirt = num === 5;
    } else {
        isHoodie = category.includes('hoodie');
        isSweatshirt = category.includes('sweatshirt') && !isHoodie;
        isPolo = category.includes('polo');
        isTshirt = category.includes("t-shirt") || category.includes("t shirt") || category.includes("tshirt") || category.includes("t恤") || category.includes("tee");
        isShirt = category.includes("shirt") && !isPolo && !isTshirt && !isHoodie && !isSweatshirt;
    }
    
    let targetTemplate = '男士T恤通用';
    if (isHoodie || isSweatshirt) {
        targetTemplate = '男士卫衣通用版';
    } else if (isShirt || isPolo || category.includes('商务') || category.includes('正装')) {
        targetTemplate = '男士商务正装通用';
    }

    log(`📋 查找模板: ${targetTemplate} (类目: ${category}, isShirt=${isShirt}, isPolo=${isPolo}, isTshirt=${isTshirt})`, 'info');
    
    // 等待下拉选项出现 - 尝试多种选择器
    let dropdownOptions = [];
    const optionSelectors = [
        '.next-select-menu .next-menu-item',
        '.next-overlay-wrapper .next-menu-item',
        '.options-item',
        '.next-select-dropdown li',
        'li[role="option"]',
    ];
    
    for (let i = 0; i < 15; i++) {
        for (const sel of optionSelectors) {
            const opts = document.querySelectorAll(sel);
            if (opts.length > 0) {
                // 过滤出可见的
                const visible = Array.from(opts).filter(o => o.offsetHeight > 0);
                if (visible.length > 0) {
                    dropdownOptions = visible;
                    log(`🔍 找到 ${visible.length} 个下拉选项 (选择器: ${sel})`, 'info');
                    break;
                }
            }
        }
        if (dropdownOptions.length > 0) break;
        await sleep3(200);
    }
    
    if (dropdownOptions.length === 0) {
        results.push('⚠️ 未找到模板下拉选项');
        document.body.click();
        return results;
    }
    
    // 打印所有选项方便调试
    const allTexts = dropdownOptions.map(o => (o.innerText || '').trim()).filter(t => t);
    log(`📋 所有选项: ${allTexts.join(', ')}`, 'info');
    
    // 查找匹配的模板
    let found = false;
    let selectedText = '';
    
    // 精确匹配优先
    for (const option of dropdownOptions) {
        const text = (option.innerText || '').trim();
        if (text === targetTemplate) {
            option.scrollIntoView({block: 'center'});
            await sleep3(200);
            await realClick(option);
            found = true;
            selectedText = text;
            break;
        }
    }
    
    // 模糊匹配
    if (!found) {
        const searchKeywords = targetTemplate.replace('男士', '').replace('通用', '');
        for (const option of dropdownOptions) {
            const text = (option.innerText || '').trim();
            if (text && text.includes(searchKeywords)) {
                option.scrollIntoView({block: 'center'});
                await sleep3(200);
                await realClick(option);
                found = true;
                selectedText = text;
                break;
            }
        }
    }
    
    // 再放宽：只要包含"男士"和"通用"
    if (!found) {
        for (const option of dropdownOptions) {
            const text = (option.innerText || '').trim();
            if (text && text.includes('男士') && text.includes('通用')) {
                option.scrollIntoView({block: 'center'});
                await sleep3(200);
                await realClick(option);
                found = true;
                selectedText = text;
                break;
            }
        }
    }
    
    await sleep3(200);
    
    // 处理确认弹窗（清除尺码表数据）- 最多等待3秒
    for (let i = 0; i < 20; i++) {
        const confirmDialog = document.querySelector('.size-chart-dialog-confirm, .next-dialog-quick, [role="alertdialog"]');
        if (confirmDialog && confirmDialog.offsetHeight > 0) {
            log('⚠️ 检测到确认弹窗，点击确定...', 'warn');
            // 找"确定"按钮（中英文都支持）
            let confirmBtn = null;
            const btns = confirmDialog.querySelectorAll('.next-btn');
            for (const btn of btns) {
                const helper = btn.querySelector('.next-btn-helper');
                const text = helper ? helper.innerText.trim() : btn.innerText.trim();
                if (text === '确定' || text === '确认' || text === 'Confirm' || text === 'OK') {
                    confirmBtn = btn;
                    break;
                }
            }
            if (!confirmBtn) {
                confirmBtn = confirmDialog.querySelector('.next-btn-primary');
            }
            if (confirmBtn) {
                await realClick(confirmBtn);
                await sleep3(800);
                break;
            }
        }
        await sleep3(150);
    }
    
    await sleep3(800);
    
    if (found) {
        log(`✅ 已选择模板: ${selectedText}`, 'success');
        results.push(`✅ 尺码模板: ${selectedText}`);
        
        // 等待尺码表加载完成
        await sleep3(1500);
        
        // 重新勾选尺码（因为选择模板后可能会重置）
        const defaultSizes = ['S', 'M', 'L', 'XL', '2XL', '3XL'];
        const szMap = {'S':'S','M':'M','L':'L','XL':'Xl','2XL':'2 XL','3XL':'3 XL'};
        
        for (const s of defaultSizes) {
            const cb = szMap[s] || s;
            document.querySelectorAll('.next-checkbox-wrapper .next-checkbox-label').forEach(l => {
                if ((l.innerText || '').trim() === cb) {
                    const wrapper = l.closest('.next-checkbox-wrapper');
                    if (wrapper && !wrapper.classList.contains('checked')) {
                        wrapper.click();
                    }
                }
            });
        }
        
        results.push(`✅ 尺码: ${defaultSizes.join(', ')}`);
    } else {
        results.push(`⚠️ 未找到模板「${targetTemplate}」`);
    }
    
    return results;
}

// ============================================================
// 💲 计量单位 fillPriceUnitPage3
// 输入方式: 点击下拉 → 搜索框输入 → 点击选项
// 遇到的问题:
//   1. 下拉选项多，直接找起来慢
//   2. 下拉面板在overlay中，需要定位正确的overlay wrapper
// 解决方案:
//   1. 点击 #priceUnit .next-select-trigger 展开下拉
//   2. 在 .options-search input 输入'
//   3. 8ms/字 逐字输入触发搜索
//   4. 遍历 .options-item 找到包含'piece'的选项点击
// ============================================================
async function fillPriceUnitPage3(product) {
    const results = [];
    let ok = false;
    const pu = await scrollAndFind(() => document.querySelector('#priceUnit .next-select-trigger'), 5);
    if (pu) {
        await sleep3(200);
        await realClick(pu);
        await sleep3(500);
        const ovs = document.querySelectorAll('.next-overlay-wrapper');
        for (const ov of ovs) {
            if (ov.style.display === 'none') continue;
            let searchInp = ov.querySelector('.options-search input');
            if (searchInp) {
                await realClick(searchInp);
                await sleep3(200);
                searchInp.focus();
                document.execCommand('selectAll', false, null);
                await sleep3(50);
                document.execCommand('insertText', false, '');
                await sleep3(60);
                for (const ch of 'Piece') {
                    document.execCommand('insertText', false, ch);
                    await sleep3(15);
                }
                searchInp.dispatchEvent(new Event('input', {bubbles: true}));
                searchInp.dispatchEvent(new Event('change', {bubbles: true}));
                await sleep3(450);
            }
            const its = ov.querySelectorAll('.options-item, li, .next-menu-item');
            for (const it of its) {
                const t = (it.innerText || '').trim().toLowerCase();
                if (t && t.includes('piece')) {
                    await realClick(it);
                    ok = true;
                    break;
                }
            }
            if (ok) break;
        }
    }
    results.push(ok ? '✅ 单位: Piece/Pieces' : '⚠️ 单位: 未找到');
    return results;
}

// ============================================================
// 💰 阶梯价 fillLadderPricePage3
// 输入方式: 点击添加按钮增加行 → setInputValue填入数量和价格
// 遇到的问题:
//   1. 价格计算规则复杂: x×6.5向上取整×0.5=z，再÷6.5÷系数
//   2. 阶梯行需要先添加，默认只有1行
//   3. 每行列数可能不同，需要按行匹配输入框
// 解决方案:
//   1. 价格计算: Math.ceil(basePrice × 6.5) × 0.5 = z
//      0.5系数价 = z / 6.5 / 0.5 (50件档)
//      0.7系数价 = z / 6.5 / 0.7 (500件档)
//      0.8系数价 = z / 6.5 / 0.8 (2000件档)
//      0.9系数价 = z / 6.5 / 0.9 (5000件档)
//   2. 点击 ladder-price-more [role="btn-add"] 增加行，直到4行
//   3. 按行索引匹配 input[role="input-quantity"] 和 input[role="input-price"]
// ============================================================
async function fillLadderPricePage3(product) {
    const results = [];
    if (!product.price) return results;
    const priceStr = String(product.price);
    const match = priceStr.match(/[\d.]+/);
    const basePrice = match ? parseFloat(match[0]) : 0;
    if (basePrice > 0) {
        const z = Math.ceil(basePrice * 6.5) * 0.5;
        const price05 = (z / 6.5 / 0.5).toFixed(2);
        const price07 = (z / 6.5 / 0.7).toFixed(2);
        const price08 = (z / 6.5 / 0.8).toFixed(2);
        const price09 = (z / 6.5 / 0.9).toFixed(2);
        
        const ladder = [
            { qty: 50, price: price05 },
            { qty: 500, price: price07 },
            { qty: 2000, price: price08 },
            { qty: 5000, price: price09 },
        ];
        const ladderSection = await scrollAndFind(() => document.querySelector('#ladderPrice, #struct-ladderPrice, .ladder-price-wrapper'), 5);
        const addBtn = ladderSection ? ladderSection.querySelector('button[role="btn-add"]') : null;
        const getLadderRows = () => {
            if (!ladderSection) return [];
            const tables = ladderSection.querySelectorAll('table');
            for (const t of tables) {
                const rows = t.querySelectorAll('tbody tr');
                if (rows.length > 0) {
                    const firstCell = rows[0].querySelector('td, th');
                    if (firstCell && firstCell.textContent.trim().includes('≥')) {
                        return Array.from(rows);
                    }
                }
            }
            return [];
        };
        let rows = getLadderRows().length;
        let addCount = 0;
        while (rows < ladder.length && addBtn && !addBtn.disabled && addCount < 5) {
            addBtn.scrollIntoView({block: 'center'});
            await sleep3(100);
            await realClick(addBtn);
            await sleep3(800);
            const newRows = getLadderRows().length;
            if (newRows <= rows) {
                await sleep3(500);
            }
            rows = getLadderRows().length;
            addCount++;
        }
        log(`ℹ️ 阶梯价当前行数: ${rows}`, 'info');
        await sleep3(300);
        const trs = getLadderRows();
        for (let i = 0; i < ladder.length && i < trs.length; i++) {
            const qtyInp = trs[i].querySelector('input[role="input-quantity"]');
            const priceInp = trs[i].querySelector('input[role="input-price"]');
            if (qtyInp) {
                await realClick(qtyInp);
                await sleep3(150);
                qtyInp.focus();
                document.execCommand('selectAll', false, null);
                await sleep3(50);
                for (const ch of String(ladder[i].qty)) {
                    document.execCommand('insertText', false, ch);
                    await sleep3(10);
                }
                qtyInp.dispatchEvent(new Event('input', {bubbles: true}));
                qtyInp.dispatchEvent(new Event('change', {bubbles: true}));
                await sleep3(50);
                pressEnter(qtyInp);
                await sleep3(150);
            }
            if (priceInp) {
                await realClick(priceInp);
                await sleep3(150);
                priceInp.focus();
                document.execCommand('selectAll', false, null);
                await sleep3(50);
                for (const ch of String(ladder[i].price)) {
                    document.execCommand('insertText', false, ch);
                    await sleep3(10);
                }
                priceInp.dispatchEvent(new Event('input', {bubbles: true}));
                priceInp.dispatchEvent(new Event('change', {bubbles: true}));
                await sleep3(50);
                pressEnter(priceInp);
                await sleep3(150);
            }
        }
        results.push(`✅ 阶梯价: ${ladder.length} 档 (50/500/2000/5000)`);
    } else {
        results.push('⚠️ 阶梯价: 无法解析价格');
    }
    return results;
}

// ============================================================
// 🔢 批量编辑10000 fillBatchQtyPage3
// 输入方式: 表头批量编辑框输入 → 点击空白/表格触发映射
// 遇到的问题:
//   1. 输入值后需要触发批量映射到所有SKU
//   2. 不同页面结构触发方式不同
//   3. 只输入不触发的话值不会应用到SKU行
// 解决方案:
//   1. 在表头 .th-skuStock-input 的批量编辑框逐字输入10000
//   2. 多种触发方式降级尝试:
//      - 点击表格body空白区域
//      - 点击输入框右侧空白
//      - 按Tab键
//      - 按Enter键
//   3. 每次触发后等待500ms检测是否生效
// ============================================================
async function fillBatchQtyPage3(product) {
    const results = [];
    const targetQty = '10000';
    
    const skuSection = await scrollAndFind(() => document.querySelector('#struct-sku, .sku-wrapper, .sku-container'), 5);
    if (skuSection) {
        skuSection.scrollIntoView({block: 'center'});
        await sleep3(300);
    }
    
    // 找到批量编辑输入框（表头里的那个）
    let batchInput = null;
    
    // 尝试多种选择器
    const batchSelectors = [
        '.th-skuStock-input input[placeholder*="批量编辑"]',
        '.sku-batch-header input[placeholder*="批量"]',
        'input[placeholder*="批量编辑"]',
        '.th-skuStock-input-content input',
    ];
    
    for (const sel of batchSelectors) {
        const el = document.querySelector(sel);
        if (el && el.offsetHeight > 0) {
            batchInput = el;
            log(`🔍 找到批量编辑输入框: ${sel}`, 'info');
            break;
        }
    }
    
    if (!batchInput) {
        results.push('⚠️ 未找到批量编辑输入框');
        return results;
    }
    
    // 确保输入框可见
    batchInput.scrollIntoView({block: 'center'});
    await sleep3(300);
    
    // 点击获取焦点
    batchInput.focus();
    await sleep3(200);
    
    // 清空现有值
    batchInput.value = '';
    batchInput.dispatchEvent(new Event('input', { bubbles: true }));
    await sleep3(100);
    
    // 逐字输入数量
    for (const ch of targetQty) {
        batchInput.value += ch;
        batchInput.dispatchEvent(new Event('input', { bubbles: true }));
        await sleep3(8);
    }
    batchInput.dispatchEvent(new Event('change', { bubbles: true }));
    
    await sleep3(200);
    
    // 点击空白处确认输入并触发批量映射
    // 点击表格下方或旁边的空白区域
    const rect = batchInput.getBoundingClientRect();
    // 尝试点击表格body区域
    const tableBody = document.querySelector('.virtualized-table-body, .sku .virtualized-table-body');
    if (tableBody) {
        const bodyRect = tableBody.getBoundingClientRect();
        // 点击表格body的空白处（第一行的左侧）
        const clickX = bodyRect.left + 50;
        const clickY = bodyRect.top + 50;
        const el = document.elementFromPoint(clickX, clickY);
        if (el) {
            log('🖱️ 点击表格空白处触发映射...', 'info');
            await realClick(el);
            await sleep3(500);
        }
    }
    
    // 如果上面没成功，尝试点击批量编辑输入框右边的空白
    if (!tableBody || !document.querySelector('.cell-skuStock input[value="10000"]')) {
        // 点击输入框右边的区域
        const rightX = rect.right + 100;
        const rightY = rect.top + rect.height / 2;
        const rightEl = document.elementFromPoint(rightX, rightY);
        if (rightEl && rightEl !== batchInput && !batchInput.contains(rightEl)) {
            log('🖱️ 点击输入框右侧触发映射...', 'info');
            await realClick(rightEl);
            await sleep3(500);
        }
    }
    
    // 尝试按Tab键
    batchInput.focus();
    await sleep3(100);
    nativeKeyPress('Tab');
    await sleep3(300);
    
    // 尝试按Enter键
    pressEnter(batchInput);
    confirmInput(batchInput);
    await sleep3(300);
    
    // 最后blur
    batchInput.blur();
    await sleep3(500);
    
    // 检查是否映射成功
    const mappedInputs = document.querySelectorAll('.cell-skuStock input[value="10000"]');
    if (mappedInputs.length > 0) {
        log(`✅ 批量映射成功: ${mappedInputs.length} 个尺码已设置`, 'success');
        results.push(`✅ 可售数量 = ${targetQty} (${mappedInputs.length}个尺码)`);
    } else {
        // 再检查一下值是否设置上了
        const allStockInputs = document.querySelectorAll('.cell-skuStock input');
        let mappedCount = 0;
        for (const inp of allStockInputs) {
            if (inp.value === targetQty) mappedCount++;
        }
        if (mappedCount > 0) {
            log(`✅ 批量映射成功: ${mappedCount} 个尺码`, 'success');
            results.push(`✅ 可售数量 = ${targetQty} (${mappedCount}个尺码)`);
        } else {
            results.push(`⚠️ 请手动检查可售数量是否映射成功`);
        }
    }
    
    return results;
}



// ============================================================
// 📦 物流信息 fillLogisticsPage3
async function fillLogisticsPage3(product) {
    const results = [];

    async function fastFillInput(inputEl, value, label) {
        if (!inputEl) {
            results.push('⚠️ 未找到' + label + '输入框');
            return false;
        }
        inputEl.scrollIntoView({block: 'center'});
        await sleep3(50);
        inputEl.focus();
        setInputValue(inputEl, '');
        inputEl.dispatchEvent(new Event('input', {bubbles: true}));
        await sleep3(15);
        setInputValue(inputEl, String(value));
        inputEl.dispatchEvent(new Event('input', {bubbles: true}));
        inputEl.dispatchEvent(new Event('change', {bubbles: true}));
        confirmInput(inputEl);
        await sleep3(50);
        pressEnter(inputEl);
        await sleep3(50);
        inputEl.dispatchEvent(new FocusEvent('blur', {bubbles: true}));
        await sleep3(30);
        log('✅ ' + label + ': ' + value, 'success');
        return true;
    }

    const ladderPeriod = await scrollAndFind(() => document.querySelector('#struct-ladderPeriod, #ladderPeriod'), 5);
    if (ladderPeriod) {
        ladderPeriod.scrollIntoView({block: 'center'});
        await sleep3(100);
    }

    const qtyInput = document.querySelector('#struct-ladderPeriod input[role="input-quantity"], #ladderPeriod input[role="input-quantity"]');
    await fastFillInput(qtyInput, '50', '发货期数量');

    const dayInput = document.querySelector('#struct-ladderPeriod input[role="input-day"], #ladderPeriod input[role="input-day"]');
    await fastFillInput(dayInput, '31', '发货期预计时间');

    const pkgSection = await scrollAndFind(() => document.querySelector('#struct-pkgWeight, #pkgWeight'), 5);
    if (pkgSection) {
        pkgSection.scrollIntoView({block: 'center'});
        await sleep3(100);
    }

    const weightInput = document.querySelector('input#pkgWeight, input[name="pkgWeight"]');
    await fastFillInput(weightInput, '0.48', '毛重');

    function findVisibleMeasureSection() {
        const candidates = document.querySelectorAll('#pkgMeasure, .component-pkgMeasure');
        for (const el of candidates) {
            if (el.offsetParent !== null && el.offsetWidth > 0 && el.offsetHeight > 0) {
                return el;
            }
        }
        return null;
    }

    const measureSection = await scrollAndFind(findVisibleMeasureSection, 4);
    if (measureSection) {

        function findMeasureItemByLabel(labelText) {
            const col8s = measureSection.querySelectorAll('.next-col-8');
            for (const col of col8s) {
                const labelEl = col.querySelector('.next-row:first-child');
                if (labelEl && labelEl.textContent.trim().includes(labelText)) {
                    const inp = col.querySelector('input');
                    if (inp && inp.offsetParent !== null) {
                        return { label: labelEl, input: inp, col: col };
                    }
                }
            }
            return null;
        }

        const lengthItem = findMeasureItemByLabel('长');
        await fastFillInput(lengthItem?.input, '50', '长');

        const widthItem = findMeasureItemByLabel('宽');
        await fastFillInput(widthItem?.input, '40', '宽');

        const heightItem = findMeasureItemByLabel('高');
        await fastFillInput(heightItem?.input, '30', '高');
    } else {
        results.push('⚠️ 未找到尺寸区域');
    }

    results.push('✅ 物流信息: 发货期50/31天 / 毛重0.48kg / 尺寸50×40×30');

    async function clickLogisticsProperty() {
        const propertyResults = [];
        
        await sleep3(500);
        
        const logisticsPropertyEl = document.querySelector('#logisticsProperty, .component-logisticsProperty');
        if (!logisticsPropertyEl) {
            propertyResults.push('⚠️ 未找到物流属性区域');
            return propertyResults;
        }

        logisticsPropertyEl.scrollIntoView({block: 'center'});
        await sleep3(300);

        const contentEl = logisticsPropertyEl.querySelector('.logistics-property-content');
        if (contentEl && contentEl.textContent.trim().includes('普货')) {
            log('✅ 物流属性已为普货，无需操作', 'success');
            propertyResults.push('✅ 物流属性已为普货');
        } else {
            const addBtn = logisticsPropertyEl.querySelector('button, .logistics-property-edit-btn, [class*="edit-btn"]');
            if (addBtn) {
                log('📦 点击添加物流属性', 'info');
                addBtn.scrollIntoView({block: 'center'});
                await sleep3(100);
                await realClick(addBtn);
                await sleep3(2000);

                log('🔍 开始查找物流属性弹窗...', 'info');
                let foundDialog = false;
                
                await sleep3(1500);
                
                const dialog = document.querySelector('.product-attr-dialog');
                if (dialog) {
                    log('✅ 找到物流属性弹窗(.product-attr-dialog)', 'success');
                    foundDialog = true;
                    
                    const allTags = dialog.querySelectorAll('.tag');
                    log(`   - 找到${allTags.length}个标签`, 'info');
                    
                    let foundPureGoods = false;
                    for (const tag of allTags) {
                        const tagText = tag.textContent.trim();
                        log(`   - 标签: "${tagText}"`, 'info');
                        if (tagText.includes('普货')) {
                            log('✅ 找到普货标签，点击', 'success');
                            tag.scrollIntoView({block: 'center'});
                            await sleep3(200);
                            tag.click();
                            await sleep3(500);
                            foundPureGoods = true;
                            break;
                        }
                    }
                    
                    if (!foundPureGoods) {
                        log('⚠️ 未找到普货标签', 'warn');
                    }

                    const confirmBtn = dialog.querySelector('.next-dialog-footer .next-btn-primary');
                    if (confirmBtn) {
                        const btnText = confirmBtn.textContent.trim();
                        log(`✅ 找到确认按钮: "${btnText}"，点击`, 'success');
                        confirmBtn.scrollIntoView({block: 'center'});
                        await sleep3(200);
                        confirmBtn.click();
                        await sleep3(800);
                        propertyResults.push('✅ 物流属性: 普货');
                    } else {
                        log('⚠️ 未找到确认按钮，尝试全局查找', 'warn');
                        const allPrimaryBtns = dialog.querySelectorAll('.next-btn-primary');
                        if (allPrimaryBtns.length > 0) {
                            log(`✅ 找到${allPrimaryBtns.length}个主按钮，点击第一个`, 'success');
                            allPrimaryBtns[0].scrollIntoView({block: 'center'});
                            await sleep3(200);
                            allPrimaryBtns[0].click();
                            await sleep3(800);
                            propertyResults.push('✅ 物流属性: 普货');
                        }
                    }
                } else {
                    log('⚠️ 未找到.product-attr-dialog，尝试查找所有弹窗', 'warn');
                    const allDialogs = document.querySelectorAll('.next-dialog, [role="dialog"]');
                    log(`   - 找到${allDialogs.length}个弹窗`, 'info');
                    for (const d of allDialogs) {
                        const hasPlaceholder = d.querySelector('#product-attr-dialog-placeholder');
                        const hasTag = d.querySelector('.tag');
                        log(`   - class: "${(d.className || '').slice(0, 60)}", hasPlaceholder: ${!!hasPlaceholder}, hasTag: ${!!hasTag}`, 'info');
                        if (hasPlaceholder || (hasTag && d.textContent.includes('普货'))) {
                            log('✅ 通过备选方式找到物流属性弹窗', 'success');
                            foundDialog = true;
                            
                            const tags = d.querySelectorAll('.tag');
                            for (const tag of tags) {
                                if (tag.textContent.trim().includes('普货')) {
                                    log('✅ 找到普货标签，点击', 'success');
                                    tag.scrollIntoView({block: 'center'});
                                    await sleep3(200);
                                    tag.click();
                                    await sleep3(500);
                                    break;
                                }
                            }
                            
                            const confirmBtns = d.querySelectorAll('.next-btn-primary');
                            if (confirmBtns.length > 0) {
                                log('✅ 点击确认按钮', 'success');
                                confirmBtns[0].scrollIntoView({block: 'center'});
                                await sleep3(200);
                                confirmBtns[0].click();
                                await sleep3(800);
                                propertyResults.push('✅ 物流属性: 普货');
                            }
                            break;
                        }
                    }
                }
                
                if (!foundDialog) {
                    log('⚠️ 未找到物流属性弹窗', 'warn');
                    propertyResults.push('⚠️ 未找到物流属性弹窗');
                }
            } else {
                propertyResults.push('⚠️ 未找到添加物流属性按钮');
            }
        }

        return propertyResults;
    }

    const propertyResults = await clickLogisticsProperty();
    results.push(...propertyResults);

    return results;
}

// ============================================================
// 📦 箱规关联 fillBoxRule (混合方案)
// 方式: 1)background CDP方式 2)postMessage+直接DOM操作iframe
// ============================================================
async function fillBoxRule(product) {
    const results = [];

    const section = await scrollAndFind(() => {
        const s = document.getElementById('logisticsProperty')?.parentElement?.parentElement;
        if (s) return s;
        const sections = document.querySelectorAll('[role="all"]');
        for (const sec of sections) {
            const text = (sec.textContent || '').replace(/\s+/g, ' ').trim();
            if (text.includes('箱规') && text.includes('体积与重量')) return sec;
        }
        return null;
    }, 5);
    if (!section) {
        results.push('⚠️ 箱规: 未找到物流信息区域');
        return results;
    }
    section.scrollIntoView({block: 'center'});
    await sleep3(300);

    let addBtn = null;
    const allBtns = section.querySelectorAll('button, [role="button"], span.add-btn-text');
    log(`🔍 在区域内找到 ${allBtns.length} 个按钮元素`, 'info');
    for (let i = 0; i < allBtns.length; i++) {
        const b = allBtns[i];
        const t = (b.innerText || b.textContent || '').trim();
        const className = b.className || '';
        log(`   按钮[${i}]: text="${t}", class="${className.substring(0, 50)}", offsetParent=${b.offsetParent !== null}`, 'info');
        if (t.includes('添加或关联箱规')) {
            addBtn = b;
            break;
        }
    }

    if (!addBtn) {
        const boxContainer = document.getElementById('boxPackaging');
        if (boxContainer) {
            log('🔍 找到boxPackaging容器，尝试直接查找按钮', 'info');
            addBtn = boxContainer.querySelector('button.add-btn, span.add-btn-text');
        }
    }

    if (!addBtn) {
        results.push('⚠️ 箱规: 未找到添加或关联箱规按钮');
        return results;
    }

    log('🖱️ 准备点击按钮: ' + (addBtn.tagName || '') + ', className=' + (addBtn.className || '').substring(0, 50), 'info');
    addBtn.scrollIntoView({block: 'center'});
    await sleep3(200);

    if (addBtn.tagName === 'SPAN') {
        const parentBtn = addBtn.closest('button');
        if (parentBtn) {
            log('🔄 span找到父button，点击父元素', 'info');
            addBtn = parentBtn;
        }
    }

    const rect = addBtn.getBoundingClientRect();
    const clickX = Math.round(rect.left + rect.width / 2);
    const clickY = Math.round(rect.top + rect.height / 2);
    log(`🎯 点击坐标: (${clickX}, ${clickY})`, 'info');

    const rectBefore = addBtn.getBoundingClientRect();
    log(`📐 点击前按钮尺寸: width=${rectBefore.width}, height=${rectBefore.height}`, 'info');

    log('🔹 尝试方式1: element.click()', 'info');
    try {
        addBtn.click();
        log('✅ 方式1执行完成', 'info');
    } catch (e) {
        log('❌ 方式1失败: ' + e.message, 'warn');
    }
    await sleep3(300);

    let isHidden = addBtn.offsetHeight === 0 || addBtn.style.display === 'none';
    if (!isHidden) {
        log('🔹 尝试方式2: CDP坐标点击', 'info');
        try {
            const res = await chrome.runtime.sendMessage({ action: 'realMouseClick', x: clickX, y: clickY });
            log(`📊 CDP点击结果: ${JSON.stringify(res)}`, 'info');
        } catch (e) {
            log('❌ 方式2失败: ' + e.message, 'warn');
        }
        await sleep3(500);
    }

    isHidden = addBtn.offsetHeight === 0 || addBtn.style.display === 'none';
    if (!isHidden) {
        log('🔹 尝试方式3: CDP注入click脚本', 'info');
        try {
            const res = await chrome.runtime.sendMessage({ action: 'runClickScript', selector: 'button.next-btn-primary.add-btn' });
            log(`📊 脚本点击结果: ${JSON.stringify(res)}`, 'info');
        } catch (e) {
            log('❌ 方式3失败: ' + e.message, 'warn');
        }
        await sleep3(500);
    }

    isHidden = addBtn.offsetHeight === 0 || addBtn.style.display === 'none';
    log(`📊 最终按钮状态: hidden=${isHidden}`, 'info');

    const rectAfter = addBtn.getBoundingClientRect();
    log(`📐 点击后按钮尺寸: width=${rectAfter.width}, height=${rectAfter.height}`, 'info');

    const boxContainer = document.getElementById('boxPackaging');
    if (boxContainer) {
        const associatedDiv = boxContainer.querySelector('.already-associated-rules');
        log(`📦 关联区域内容: ${associatedDiv?.innerHTML?.substring(0, 200) || '空'}`, 'info');
    }

    await sleep3(1500);

    let iframeEl = null;
    for (let i = 0; i < 40; i++) {
        const allIframes = document.querySelectorAll('iframe');
        log(`🔍 第${i+1}次检查: 页面共有 ${allIframes.length} 个iframe`, 'info');
        for (const iframe of allIframes) {
            const hasHeight = iframe.offsetHeight > 0;
            const hasSrc = !!iframe.src;
            log(`   - height=${iframe.offsetHeight}, hasSrc=${hasSrc}, src=${hasSrc ? iframe.src : '(empty)'}`);
            if (hasHeight && hasSrc) {
                if (iframe.src.includes('scm.alibaba.com') || 
                    iframe.src.includes('template_relate_package') ||
                    iframe.src.includes('package') ||
                    iframe.src.includes('box') ||
                    iframe.src.includes('cargo') ||
                    iframe.src.includes('logistics') ||
                    iframe.src.includes('freight')) {
                    iframeEl = iframe;
                    break;
                }
            }
        }
        if (iframeEl) {
            log(`✅ 找到目标iframe: ${iframeEl.src}`, 'info');
            break;
        }
        await sleep3(200);
    }

    if (!iframeEl) {
        const allIframes = document.querySelectorAll('iframe');
        if (allIframes.length > 0) {
            log('⚠️ 未找到匹配的箱规iframe，所有iframe信息:', 'warn');
            for (let j = 0; j < allIframes.length; j++) {
                const iframe = allIframes[j];
                log(`   iframe[${j}]: height=${iframe.offsetHeight}, src=${iframe.src || '(empty)'}, id=${iframe.id || '(no id)'}, className=${iframe.className || '(no class)'}`);
            }
        }
        results.push('⚠️ 箱规: iframe未加载');
        return results;
    }

    log('✅ iframe已加载，等待内部渲染...', 'info');
    await sleep3(2000);

    // 通过background处理CDP，content script直接执行iframe内部DOM操作
    log('🔄 通过扩展执行箱规关联...', 'info');

    return new Promise((resolve) => {
        const handler = (msg) => {
            if (msg.action === 'fillBoxRuleResult') {
                chrome.runtime.onMessage.removeListener(handler);
                const r = msg.result || {};
                if (r.ok) {
                    log('✅ 箱规关联完成', 'success');
                    results.push('✅ 箱规关联完成');
                } else {
                    const err = r.error || '未知错误';
                    log(`⚠️ 箱规关联失败: ${err}`, 'warn');
                    if (r.frames) {
                        log(`🔍 可用frames: ${(r.frames || []).join(', ')}`, 'info');
                    }
                    results.push(`⚠️ 箱规关联失败: ${err}`);
                }
                resolve(results);
            }
        };
        chrome.runtime.onMessage.addListener(handler);

        chrome.runtime.sendMessage({ action: 'fillBoxRule' }, (resp) => {
            if (!resp || !resp.ok) {
                chrome.runtime.onMessage.removeListener(handler);
                const err = resp?.error || '启动失败';
                log(`⚠️ 箱规关联启动失败: ${err}`, 'warn');
                results.push(`⚠️ 箱规关联启动失败: ${err}`);
                resolve(results);
            }
        });

        setTimeout(() => {
            chrome.runtime.onMessage.removeListener(handler);
            log('⚠️ 箱规关联超时', 'warn');
            results.push('⚠️ 箱规关联超时');
            resolve(results);
        }, 60000);
    });
}

// ============================================================
// 📑 选择物流模板 (定制服务) fillLogisticsTemplate
// 输入方式: 定位"定制服务"区域 → 点击下拉 → 按类目匹配选项
// 遇到的问题:
//   1. 页面有多个模板选择器(物流/详情/公司介绍/交易信息)，容易选错
//   2. 模板选择器在页面下方，未滚动到的话不渲染
//   3. 选项DOM结构有多种，选择器不稳定
//   4. 不同类目需要选不同模板，不能硬编码
// 解决方案:
//   1. 先通过 scrollToSection('定制服务') 定位到正确区域
//      - 遍历 [role="all"] sections，匹配文字开头
//   2. 在该区域内找 .select-template / .next-select，避免选到其他模板
//   3. 多选择器降级查找下拉选项:
//      .component-template-select-custom-options → .select-custom-options-label
//      → .next-select-menu .next-menu-item → li[role="option"]
//   4. 10轮轮询等待选项渲染，每轮200ms
//   5. 根据类目关键词匹配模板 (buildLogisticsTemplate)
// ============================================================
async function fillLogisticsTemplate(product) {
    const results = [];

    const section = await scrollToSection('定制服务', 5);
    let templateWrap = null;
    if (section) {
        const secText = (section.textContent || '').replace(/\s+/g, ' ').trim();
        if (!secText.includes('物流属性') && !secText.includes('普货')) {
            const sel = section.querySelector('.select-template, .next-select');
            if (sel) templateWrap = sel;
        }
    }

    if (!templateWrap) {
        const alt = await scrollAndFind(() => {
            const sections = document.querySelectorAll('[role="all"]');
            for (const sec of sections) {
                const text = (sec.textContent || '').replace(/\s+/g, ' ').trim();
                if (text.includes('定制服务') && !text.includes('物流属性') && !text.includes('普货')) {
                    const sel = sec.querySelector('.select-template, .next-select');
                    if (sel) return sel;
                }
            }
            return null;
        }, 5);
        if (alt) templateWrap = alt;
    }

    if (!templateWrap) {
        results.push('⚠️ 未找到定制服务模板选择器');
        log('⚠️ 未找到定制服务模板', 'error');
        return results;
    }

    log('✅ 找到定制服务模板选择器: ' + (templateWrap.className || '').slice(0, 60), 'success');

    const trigger = templateWrap.querySelector('.next-select-trigger') || templateWrap;
    if (!trigger) {
        results.push('⚠️ 未找到模板下拉触发按钮');
        return results;
    }

    trigger.scrollIntoView({block: 'center'});
    await sleep3(200);

    await realClick(trigger);
    log('✅ 点击了模板下拉框', 'success');
    await sleep3(800);

    let options = [];
    const optionSelectors = [
        '.component-template-select-custom-options',
        '.select-custom-options-label',
        '.next-select-menu .next-menu-item',
        '.next-overlay-wrapper .next-menu-item',
        'li[role="option"]',
    ];

    for (let i = 0; i < 10; i++) {
        for (const sel of optionSelectors) {
            const opts = document.querySelectorAll(sel);
            const visible = Array.from(opts).filter(o => o.offsetHeight > 0);
            if (visible.length > 0) {
                options = visible;
                log('🔍 找到 ' + visible.length + ' 个模板选项 (选择器: ' + sel + ')', 'info');
                break;
            }
        }
        if (options.length > 0) break;
        await sleep3(200);
    }

    if (options.length === 0) {
        results.push('⚠️ 未找到模板下拉选项');
        document.body.click();
        return results;
    }

    const allTexts = options.map(o => (o.innerText || o.textContent || '').trim()).filter(t => t);
    log('📋 所有选项: ' + allTexts.join(', '), 'info');

    let found = false;
    let selectedText = '';
    const target = '通用';

    for (const opt of options) {
        const text = (opt.innerText || opt.textContent || '').trim();
        if (text === target || text.includes(target)) {
            opt.scrollIntoView({block: 'center'});
            await sleep3(200);
            await realClick(opt);
            found = true;
            selectedText = text;
            break;
        }
    }

    if (!found && options.length > 0) {
        const first = options[0];
        const text = (first.innerText || first.textContent || '').trim();
        await realClick(first);
        found = true;
        selectedText = text;
        log('⚠️ 未找到「通用」，选择第一个: ' + text, 'warn');
    }

    await sleep3(300);

    for (let i = 0; i < 20; i++) {
        const dialog = document.querySelector('[role="alertdialog"], .component-dialog-confirm, .next-dialog-quick');
        if (dialog && dialog.offsetHeight > 0) {
            log('⚠️ 检测到确认弹窗，点击确认...', 'warn');
            let confirmBtn = null;
            const btns = dialog.querySelectorAll('.next-btn');
            for (const btn of btns) {
                const helper = btn.querySelector('.next-btn-helper');
                const text = helper ? helper.innerText.trim() : btn.innerText.trim();
                if (text === '确认' || text === 'Confirm' || text === '确定' || text === 'OK') {
                    confirmBtn = btn;
                    break;
                }
            }
            if (!confirmBtn) {
                confirmBtn = dialog.querySelector('.next-btn-primary');
            }
            if (confirmBtn) {
                await realClick(confirmBtn);
                await sleep3(800);
                break;
            }
        }
        await sleep3(150);
    }

    await sleep3(500);

    if (found) {
        log('✅ 已选择物流模板: ' + selectedText, 'success');
        results.push('✅ 物流模板: ' + selectedText);
    } else {
        results.push('⚠️ 物流模板选择失败');
    }

    return results;
}

function hasChinese(s) { return /[\u4e00-\u9fa5]/.test(s); }
function hasEnglish(s) { return /[a-zA-Z]/.test(s); }

function parseHighlights(text) {
    if (!text) return [];
    const results = [];
    const lines = String(text).split('\n').map(l => l.trim()).filter(l => l);

    const blocks = [];
    let curBlock = null;
    for (const line of lines) {
        const numMatch = line.match(/^(\d+)[.\u3001)\uff09\u2460-\u2473]\s*/);
        if (numMatch) {
            if (curBlock) blocks.push(curBlock);
            curBlock = { num: numMatch[1], lines: [line.substring(numMatch[0].length).trim()] };
        } else {
            if (curBlock) curBlock.lines.push(line);
            else blocks.push({ num: '', lines: [line] });
        }
    }
    if (curBlock) blocks.push(curBlock);

    for (const block of blocks) {
        let label_en = '', desc_en = '', label_cn = '', desc_cn = '';

        for (let raw of block.lines) {
            let s = raw.trim();
            if (!s) continue;
            s = s.replace(/[\*_]{1,3}/g, '').trim();

            let isCnBracketLine = false;
            const obMatch = s.match(/^[\uff08(](.+)[\uff09)]\s*$/);
            const obMatch2 = s.match(/^[\[\uff3b\u3010\u300a](.+)[\]\uff3d\u3011\u300b]\s*$/);
            if (obMatch && hasChinese(obMatch[1])) { s = obMatch[1].trim(); isCnBracketLine = true; }
            else if (obMatch2 && hasChinese(obMatch2[1])) { s = obMatch2[1].trim(); isCnBracketLine = true; }

            const inlineCn = s.match(/[\[\uff3b\u3010\u300a]([\u4e00-\u9fa5\u3001\uff0c\s]+?)[\]\uff3d\u3011\u300b][\uff1a:]\s*(.+?)\s*$/);
            let cnPart = '';
            if (inlineCn && hasChinese(inlineCn[1])) {
                cnPart = inlineCn[1].trim() + '：' + inlineCn[2].trim();
                s = s.substring(0, s.length - inlineCn[0].length).trim();
            }

            const colonIdx = s.search(/[\uff1a:]/);
            let labelPart = '';
            let descPart = '';
            let hasColon = colonIdx !== -1;
            if (hasColon) {
                labelPart = s.substring(0, colonIdx).trim();
                descPart = s.substring(colonIdx + 1).trim();
            } else {
                descPart = s;
            }

            const labelHasCn = hasChinese(labelPart);
            const isCnLine = isCnBracketLine || labelHasCn;

            if (s) {
                if (isCnLine) {
                    if (labelPart && !label_cn) label_cn = labelPart;
                    if (descPart) {
                        if (!desc_cn) desc_cn = descPart;
                        else desc_cn += ' ' + descPart;
                    }
                } else if (hasChinese(s) && hasEnglish(s)) {
                    if (hasColon) {
                        const labelSplit = splitMixedText(labelPart);
                        const descSplit = splitMixedText(descPart);
                        if (labelSplit.en && !label_en) label_en = labelSplit.en;
                        if (labelSplit.cn && !label_cn) label_cn = labelSplit.cn;
                        if (descSplit.en) {
                            if (!desc_en) desc_en = descSplit.en;
                            else desc_en += ' ' + descSplit.en;
                        }
                        if (descSplit.cn) {
                            if (!desc_cn) desc_cn = descSplit.cn;
                            else desc_cn += ' ' + descSplit.cn;
                        }
                    } else {
                        const split = splitMixedText(s);
                        if (split.en) {
                            if (!desc_en) desc_en = split.en;
                            else desc_en += ' ' + split.en;
                        }
                        if (split.cn) {
                            if (!desc_cn) desc_cn = split.cn;
                            else desc_cn += ' ' + split.cn;
                        }
                    }
                } else {
                    if (hasColon) {
                        if (labelPart && !label_en) label_en = labelPart;
                        if (descPart) {
                            if (!desc_en) desc_en = descPart;
                            else desc_en += ' ' + descPart;
                        }
                    } else {
                        if (!desc_en) desc_en = s;
                        else desc_en += ' ' + s;
                    }
                }
            }

            if (cnPart) {
                const cm = cnPart.match(/^(.+?)[\uff1a:]\s*(.+)$/);
                if (cm) {
                    if (!label_cn) label_cn = cm[1].trim();
                    if (!desc_cn) desc_cn = cm[2].trim();
                } else {
                    if (!desc_cn) desc_cn = cnPart;
                }
            }
        }

        results.push({ num: block.num, label_en, desc_en, label_cn, desc_cn, raw: block.lines.join('\n') });
    }

    return results;
}

function splitMixedText(s) {
    if (!s) return { en: '', cn: '' };
    if (!hasChinese(s)) return { en: s.trim(), cn: '' };
    if (!hasEnglish(s)) return { en: '', cn: s.trim() };

    const chars = [...s];
    let enParts = [];
    let cnParts = [];
    let curEn = [];
    let curCn = [];
    let lastType = null;

    function flush() {
        if (curEn.length) { enParts.push(curEn.join('')); curEn = []; }
        if (curCn.length) { cnParts.push(curCn.join('')); curCn = []; }
    }

    for (const ch of chars) {
        const isCnChar = /[\u4e00-\u9fa5\u3000-\u303f\uff00-\uffef]/.test(ch);
        const isEnChar = /[a-zA-Z]/.test(ch);
        const isPunctSpace = /[\s,.\-;:!?()\[\]{}'"，。、；：！？（）【】《》""'']/.test(ch);

        if (isCnChar) {
            if (lastType === 'en' && curEn.length) { enParts.push(curEn.join('')); curEn = []; }
            curCn.push(ch);
            lastType = 'cn';
        } else if (isEnChar) {
            if (lastType === 'cn' && curCn.length) { cnParts.push(curCn.join('')); curCn = []; }
            curEn.push(ch);
            lastType = 'en';
        } else if (isPunctSpace) {
            if (lastType === 'en') curEn.push(ch);
            else if (lastType === 'cn') curCn.push(ch);
            else enParts.push(ch);
        } else {
            if (lastType === 'en') curEn.push(ch);
            else if (lastType === 'cn') curCn.push(ch);
            else enParts.push(ch);
        }
    }
    flush();

    return {
        en: enParts.join(' ').replace(/\s+/g, ' ').trim(),
        cn: cnParts.join(' ').replace(/\s+/g, ' ').trim()
    };
}

// ============================================================
// ✨ 填入商品卖点 fillHighlightsPage3
// 输入方式: 解析卖点数据 → 创建ul/li DOM → 插入contenteditable编辑器
// 遇到的问题:
//   1. 编辑器是contenteditable富文本，不是普通input
//   2. 卖点可能有多个，需要动态生成列表
//   3. 直接设置innerHTML可能不触发React更新
// 解决方案:
//   1. parseHighlights() 从xlsx数据解析卖点（按换行/符号拆分）
//   2. 创建 <ul> + 多个 <li> DOM元素
//   3. 清空编辑器innerHTML后appendChild插入ul
//   4. 触发 input/change/blur 事件确保React捕获更新
// ============================================================
async function fillHighlightsPage3(product, mode) {
    if (!mode) mode = window.__polo_fill_mode || 'overwrite';
    const results = [];

    let descList = [];
    if (Array.isArray(product?._highlightDescs) && product._highlightDescs.length > 0) {
        descList = product._highlightDescs.map(s => String(s || '').trim()).filter(Boolean);
        log('ℹ️ 使用页1预解析的 _highlightDescs: ' + descList.length + ' 条', 'info');
    }

    if (descList.length === 0) {
        const highlights = parseHighlights(product.highlights || '');
        descList = highlights.map(h => (h.desc_en || '').trim()).filter(Boolean);
        log('ℹ️ 本地解析 highlights: ' + descList.length + ' 条', 'info');
    }

    if (descList.length === 0) {
        results.push('⚠️ 商品卖点: 无数据');
        return results;
    }

    const editor = await scrollAndFind(() => document.querySelector('#struct-textDesc .text-area-list-editor[contenteditable="true"]'), 5);

    if (!editor) {
        results.push('⚠️ 商品卖点: 未找到编辑器');
        return results;
    }

    let ul = editor.querySelector('ul');
    if (!ul) {
        ul = document.createElement('ul');
        editor.appendChild(ul);
    }

    if (mode === 'overwrite') {
        ul.innerHTML = '';
        for (const desc of descList) {
            const li = document.createElement('li');
            li.textContent = desc;
            ul.appendChild(li);
        }
        log('✅ 商品卖点: 覆盖填入 ' + descList.length + ' 条', 'success');
        results.push('✅ 商品卖点: 覆盖填入 ' + descList.length + ' 条');
    } else {
        const beforeCount = ul.children.length;
        for (const desc of descList) {
            const li = document.createElement('li');
            li.textContent = desc;
            ul.appendChild(li);
        }
        const addedCount = ul.children.length - beforeCount;
        log('✅ 商品卖点: 追加 ' + addedCount + ' 条（原有 ' + beforeCount + ' 条）', 'success');
        results.push('✅ 商品卖点: 追加 ' + addedCount + ' 条');
    }

    editor.dispatchEvent(new Event('input', {bubbles: true}));
    editor.dispatchEvent(new Event('change', {bubbles: true}));
    editor.dispatchEvent(new MouseEvent('mousedown', {bubbles: true}));
    editor.dispatchEvent(new MouseEvent('mouseup', {bubbles: true}));
    editor.dispatchEvent(new MouseEvent('click', {bubbles: true}));

    await sleep3(200);

    return results;
}

// ============================================================
// 🖼️ 选择详情模板 (商品介绍) fillDetailTemplate
// 输入方式: 定位"1. 商品介绍"区域 → 点击下拉 → 按类目匹配选项
// 遇到的问题:
//   1. 和定制服务模板选择器结构相似，容易混淆
//   2. 区域文字带编号前缀"1. 商品介绍"
//   3. 不同类目对应不同详情模板
// 解决方案:
//   1. scrollToSection('商品介绍') 或匹配 startsWith('1. 商品介绍')
//   2. 在该区域内查找模板选择器，避免与其他模板冲突
//   3. 多选择器降级查找选项，10轮轮询等待渲染
//   4. pickDetailTemplate() 根据类目匹配模板关键词
// ============================================================
async function fillDetailTemplate(product) {
    const results = [];

    const section = await scrollToSection('商品介绍', 6);
    let templateWrap = null;
    if (section) {
        const secText = (section.textContent || '').replace(/\s+/g, ' ').trim();
        if (secText.includes('商品介绍') && !secText.includes('物流属性') && !secText.includes('普货')) {
            const sel = section.querySelector('.select-template, .next-select');
            if (sel) templateWrap = sel;
        }
    }

    if (!templateWrap) {
        const alt = await scrollAndFind(() => {
            const sections = document.querySelectorAll('[role="all"]');
            for (const sec of sections) {
                const text = (sec.textContent || '').replace(/\s+/g, ' ').trim();
                if (text.includes('商品介绍') && text.includes('模板') && !text.includes('物流属性') && !text.includes('普货')) {
                    const sel = sec.querySelector('.select-template, .next-select');
                    if (sel) return sel;
                }
            }
            return null;
        }, 6);
        if (alt) templateWrap = alt;
    }

    if (!templateWrap) {
        results.push('⚠️ 未找到商品详情模板选择器');
        log('⚠️ 未找到商品详情模板', 'error');
        return results;
    }

    log('✅ 找到商品详情模板选择器: ' + (templateWrap.className || '').slice(0, 60), 'success');

    const trigger = templateWrap.querySelector('.next-select-trigger') || templateWrap;
    if (!trigger) {
        results.push('⚠️ 未找到模板下拉触发按钮');
        return results;
    }

    trigger.scrollIntoView({block: 'center'});
    await sleep3(200);

    await realClick(trigger);
    log('✅ 点击了商品详情模板下拉框', 'success');
    await sleep3(800);

    let options = [];
    const optionSelectors = [
        '.component-template-select-custom-options',
        '.select-custom-options-label',
        '.next-select-menu .next-menu-item',
        '.next-overlay-wrapper .next-menu-item',
        'li[role="option"]',
    ];

    for (let i = 0; i < 10; i++) {
        for (const sel of optionSelectors) {
            const opts = document.querySelectorAll(sel);
            const visible = Array.from(opts).filter(o => o.offsetHeight > 0);
            if (visible.length > 0) {
                options = visible;
                log('🔍 找到 ' + visible.length + ' 个模板选项 (选择器: ' + sel + ')', 'info');
                break;
            }
        }
        if (options.length > 0) break;
        await sleep3(200);
    }

    if (options.length === 0) {
        results.push('⚠️ 未找到模板下拉选项');
        document.body.click();
        return results;
    }

    const allTexts = options.map(o => (o.innerText || o.textContent || '').trim()).filter(t => t);
    log('📋 所有选项: ' + allTexts.join(', '), 'info');

    let found = false;
    let selectedText = '';
    const target = '通用';

    log(`🎯 详情模板匹配: 目标模板=${target}`, 'info');

    for (const opt of options) {
        const text = (opt.innerText || opt.textContent || '').trim();
        if (text === target || text.includes(target)) {
            opt.scrollIntoView({block: 'center'});
            await sleep3(200);
            await realClick(opt);
            found = true;
            selectedText = text;
            break;
        }
    }

    if (!found && options.length > 0) {
        const first = options[0];
        const text = (first.innerText || first.textContent || '').trim();
        await realClick(first);
        found = true;
        selectedText = text;
        log('⚠️ 未找到「' + target + '」，选择第一个: ' + text, 'warn');
    }

    await sleep3(300);

    for (let i = 0; i < 20; i++) {
        const dialog = document.querySelector('[role="alertdialog"], .component-dialog-confirm, .next-dialog-quick');
        if (dialog && dialog.offsetHeight > 0) {
            log('⚠️ 检测到确认弹窗，点击确认...', 'warn');
            let confirmBtn = null;
            const btns = dialog.querySelectorAll('.next-btn');
            for (const btn of btns) {
                const helper = btn.querySelector('.next-btn-helper');
                const text = helper ? helper.innerText.trim() : btn.innerText.trim();
                if (text === '确认' || text === 'Confirm' || text === '确定' || text === 'OK') {
                    confirmBtn = btn;
                    break;
                }
            }
            if (!confirmBtn) {
                confirmBtn = dialog.querySelector('.next-btn-primary');
            }
            if (confirmBtn) {
                await realClick(confirmBtn);
                await sleep3(800);
                break;
            }
        }
        await sleep3(150);
    }

    await sleep3(500);

    if (found) {
        log('✅ 已选择商品详情模板: ' + selectedText, 'success');
        results.push('✅ 商品详情模板: ' + selectedText);
    } else {
        results.push('⚠️ 商品详情模板选择失败');
    }

    const hlRes = await fillHighlightsPage3(product);
    results.push(...hlRes);

    return results;
}

function pickCompanyIntroTemplate(product) {
    const cat = (product.category || '').toLowerCase();
    
    const numMatch = cat.match(/\((\d+)\)/);
    if (numMatch) {
        const num = parseInt(numMatch[1]);
        if (num === 1) return 'T恤';
        if (num === 2) return 'Polo衫';
        if (num === 3) return 'Shirt';
        if (num === 4) return '卫衣有帽';
        if (num === 5) return '卫衣无帽';
    }
    
    if (cat.includes('hoodie')) return '卫衣有帽';
    if (cat.includes('sweatshirt') && !cat.includes('hoodie')) return '卫衣无帽';
    if (cat.includes('polo') || cat.includes('polo衫')) return 'Polo衫';
    if (cat.includes('t-shirt') || cat.includes('t shirt') || cat.includes('tshirt') || cat.includes('t恤')) return 'T恤';
    if (cat.includes('shirt') || cat.includes('衬衫') || cat.includes('衬衣')) return 'Shirt';
    return 'Polo衫';
}

function parseFaqs(text) {
    if (!text) return [];
    const faqs = [];
    const lines = String(text).split('\n').filter(l => l.trim());
    for (const line of lines) {
        const str = line.trim();
        if (!str.startsWith('Q:')) continue;
        const qIdx = str.indexOf('Q:');
        const aIdx = str.indexOf('A:');
        if (qIdx === -1 || aIdx === -1) continue;
        const q = str.substring(qIdx + 2, aIdx).trim();
        let a = str.substring(aIdx + 2).trim();
        const cnIdx = a.search(/\[?问[：:]/);
        if (cnIdx !== -1) a = a.substring(0, cnIdx).trim();
        if (q && a) faqs.push({ q, a });
    }
    return faqs;
}

// ============================================================
// ❓ 填入FAQs fillFaqsPage3
// 输入方式: 两轮策略 → 先填所有Q → 等500ms → 再填所有A
// 输入方法: execCommand('insertText') 逐字输入 (8ms/字)
// 遇到的问题:
//   1. Q输入后触发React重渲染，A的DOM元素失效
//   2. 按Q-A顺序逐个填，A的值会消失
//   3. 直接设置value是"假填入"，点击后值会消失
//   4. FAQ数量不固定，需要动态添加条目
// 解决方案:
//   1. 先点"添加"按钮增加足够数量的FAQ条目
//      - 轮询等待条目数增加，最多20×100ms
//   2. 两轮填入策略:
//      - 第一轮: 遍历所有FAQ，只填Question
//      - 等待500ms让DOM稳定
//      - 第二轮: 重新获取DOM，再填所有Answer
//   3. 输入方式:
//      - setSelectionRange全选 → delete删除
//      - execCommand('insertText')逐字输入，模拟真实键盘
//      - 触发input/change事件，blur失焦
//   4. parseFaqs() 动态解析FAQ数量，不硬编码
// ============================================================
async function fillFaqsPage3(product, mode) {
    if (!mode) mode = window.__polo_fill_mode || 'overwrite';
    const results = [];
    const faqs = parseFaqs(product.faq || '');
    log('📋 解析到 ' + faqs.length + ' 条FAQ', 'info');
    if (faqs.length === 0) {
        results.push('⚠️ FAQs: 无数据');
        return results;
    }

    const container = await scrollAndFind(() => document.querySelector('#struct-companyFaqDesc .company-faq-desc'), 6);
    if (!container) {
        results.push('⚠️ FAQs: 未找到容器');
        return results;
    }

    container.scrollIntoView({block: 'center'});
    await sleep3(300);

    let startIdx = 0;
    let existingItems = container.querySelectorAll('.item');
    if (mode === 'overwrite') {
        startIdx = 0;
        while (existingItems.length > faqs.length) {
            existingItems[existingItems.length - 1].remove();
            existingItems = container.querySelectorAll('.item');
        }
        log('📋 FAQ条目数调整为 ' + Math.min(faqs.length, existingItems.length) + ' 条', 'info');
    } else {
        startIdx = existingItems.length;
    }
    const targetCount = Math.max(startIdx + faqs.length, existingItems.length);

    while (container.querySelectorAll('.item').length < targetCount) {
        const addBtn = container.querySelector('.add-items');
        if (!addBtn) break;
        const beforeCount = container.querySelectorAll('.item').length;
        addBtn.scrollIntoView({block: 'center'});
        await sleep3(50);
        await realClick(addBtn);
        for (let t = 0; t < 20; t++) {
            await sleep3(100);
            if (container.querySelectorAll('.item').length > beforeCount) break;
        }
    }

    await sleep3(300);

    let filled = 0;

    for (let i = 0; i < faqs.length; i++) {
        const itemIdx = startIdx + i;
        const items = container.querySelectorAll('.item');
        if (itemIdx >= items.length) break;
        const qInput = items[itemIdx].querySelector('.question input');
        if (!qInput) continue;

        qInput.scrollIntoView({block: 'center'});
        await sleep3(100);
        await realClick(qInput);
        await sleep3(100);
        qInput.focus();
        await sleep3(50);
        qInput.setSelectionRange(0, qInput.value.length);
        await sleep3(30);
        for (const ch of faqs[i].q) {
            document.execCommand('insertText', false, ch);
            await sleep3(8);
        }
        qInput.dispatchEvent(new Event('input', {bubbles: true}));
        qInput.dispatchEvent(new Event('change', {bubbles: true}));
        confirmInput(qInput);
        pressEnter(qInput);
        await sleep3(150);
    }

    await sleep3(500);

    for (let i = 0; i < faqs.length; i++) {
        const itemIdx = startIdx + i;
        const items = container.querySelectorAll('.item');
        if (itemIdx >= items.length) break;
        const aTextarea = items[itemIdx].querySelector('.answers textarea[data-real="true"]');
        if (!aTextarea) continue;

        aTextarea.scrollIntoView({block: 'center'});
        await sleep3(100);
        await realClick(aTextarea);
        await sleep3(100);
        aTextarea.focus();
        await sleep3(50);
        aTextarea.setSelectionRange(0, aTextarea.value.length);
        await sleep3(30);
        for (const ch of faqs[i].a) {
            document.execCommand('insertText', false, ch);
            await sleep3(8);
        }
        aTextarea.dispatchEvent(new Event('input', {bubbles: true}));
        aTextarea.dispatchEvent(new Event('change', {bubbles: true}));
        confirmInput(aTextarea);
        pressEnter(aTextarea);
        await sleep3(150);
    }

    filled = faqs.length;

    log('✅ FAQs: 已追加 ' + filled + ' 条（原有 ' + startIdx + ' 条）', 'success');
    results.push('✅ FAQs: 追加 ' + filled + ' 条');
    return results;
}

async function saveDraft(product) {
    const results = [];
    log('🖱️ 查找保存按钮...', 'info');
    let saveBtn = null;
    const allBtns = document.querySelectorAll('button');
    for (const btn of allBtns) {
        const text = (btn.innerText || btn.textContent || '').trim();
        if (text === '保存' && btn.offsetHeight > 0) {
            saveBtn = btn;
            break;
        }
    }
    if (saveBtn) {
        saveBtn.scrollIntoView({ block: 'center' });
        await sleep3(300);
        log('🖱️ 点击保存按钮...', 'info');
        await realClick(saveBtn);
        await sleep3(1000);
        log('✅ 已点击保存', 'success');
        results.push('✅ 已点击保存');
        if (product && product.row) {
                chrome.runtime.sendMessage({ action: 'markUploaded', row: product.row }, () => {});
            }
    } else {
        log('⚠️ 未找到保存按钮', 'warn');
        results.push('⚠️ 未找到保存按钮');
    }
    return results;
}

// ============================================================
// 🏢 选择公司介绍模板 fillCompanyIntroTemplate
// 输入方式: 定位"2. 公司介绍"区域 → 点击下拉 → 按类目匹配选项
// 遇到的问题:
//   1. 和其他两个模板选择器结构完全一样，必须准确定位区域
//   2. 区域文字带编号前缀"2. 公司介绍"
//   3. 不同类目对应不同公司介绍模板
// 解决方案:
//   1. scrollToSection('公司介绍') 或匹配 startsWith('2. 公司介绍')
//   2. 在该区域内查找模板选择器，避免与其他模板冲突
//   3. 多选择器降级查找选项，10轮轮询等待渲染
//   4. pickCompanyIntroTemplate() 根据类目匹配模板关键词
// ============================================================
async function fillCompanyIntroTemplate(product) {
    const results = [];

    const section = await scrollToSection('公司介绍', 6);
    let templateWrap = null;
    if (section) {
        const secText = (section.textContent || '').replace(/\s+/g, ' ').trim();
        if (!secText.includes('物流属性') && !secText.includes('普货')) {
            const sel = section.querySelector('.select-template, .next-select');
            if (sel) templateWrap = sel;
        }
    }

    if (!templateWrap) {
        const alt = await scrollAndFind(() => {
            const sections = document.querySelectorAll('[role="all"]');
            for (const sec of sections) {
                const text = (sec.textContent || '').replace(/\s+/g, ' ').trim();
                if (text.includes('公司介绍') && text.includes('模板') && !text.includes('物流属性') && !text.includes('普货')) {
                    const sel = sec.querySelector('.select-template, .next-select');
                    if (sel) return sel;
                }
            }
            return null;
        }, 6);
        if (alt) templateWrap = alt;
    }

    if (!templateWrap) {
        results.push('⚠️ 未找到公司介绍模板选择器');
        log('⚠️ 未找到公司介绍模板', 'error');
        return results;
    }

    log('✅ 找到公司介绍模板选择器: ' + (templateWrap.className || '').slice(0, 60), 'success');

    const trigger = templateWrap.querySelector('.next-select-trigger') || templateWrap;
    if (!trigger) {
        results.push('⚠️ 未找到模板下拉触发按钮');
        return results;
    }

    trigger.scrollIntoView({block: 'center'});
    await sleep3(200);

    await realClick(trigger);
    log('✅ 点击了公司介绍模板下拉框', 'success');
    await sleep3(800);

    let options = [];
    const optionSelectors = [
        '.component-template-select-custom-options',
        '.select-custom-options-label',
        '.next-select-menu .next-menu-item',
        '.next-overlay-wrapper .next-menu-item',
        'li[role="option"]',
    ];

    for (let i = 0; i < 10; i++) {
        for (const sel of optionSelectors) {
            const opts = document.querySelectorAll(sel);
            const visible = Array.from(opts).filter(o => o.offsetHeight > 0);
            if (visible.length > 0) {
                options = visible;
                log('🔍 找到 ' + visible.length + ' 个模板选项 (选择器: ' + sel + ')', 'info');
                break;
            }
        }
        if (options.length > 0) break;
        await sleep3(200);
    }

    if (options.length === 0) {
        results.push('⚠️ 未找到模板下拉选项');
        document.body.click();
        return results;
    }

    const allTexts = options.map(o => (o.innerText || o.textContent || '').trim()).filter(t => t);
    log('📋 所有选项: ' + allTexts.join(', '), 'info');

    const target = pickCompanyIntroTemplate(product);
    log('🎯 根据类目选择模板: ' + target + ' (类目: ' + (product.category || '') + ')', 'info');

    let found = false;
    let selectedText = '';

    for (const opt of options) {
        const text = (opt.innerText || opt.textContent || '').trim();
        if (text === target || text.includes(target) || text.toLowerCase().includes(target.toLowerCase())) {
            opt.scrollIntoView({block: 'center'});
            await sleep3(200);
            await realClick(opt);
            found = true;
            selectedText = text;
            break;
        }
    }

    if (!found && options.length > 0) {
        const first = options[0];
        const text = (first.innerText || first.textContent || '').trim();
        await realClick(first);
        found = true;
        selectedText = text;
        log('⚠️ 未找到「' + target + '」，选择第一个: ' + text, 'warn');
    }

    await sleep3(300);

    for (let i = 0; i < 20; i++) {
        const dialog = document.querySelector('[role="alertdialog"], .component-dialog-confirm, .next-dialog-quick');
        if (dialog && dialog.offsetHeight > 0) {
            log('⚠️ 检测到确认弹窗，点击确认...', 'warn');
            let confirmBtn = null;
            const btns = dialog.querySelectorAll('.next-btn');
            for (const btn of btns) {
                const helper = btn.querySelector('.next-btn-helper');
                const text = helper ? helper.innerText.trim() : btn.innerText.trim();
                if (text === '确认' || text === 'Confirm' || text === '确定' || text === 'OK') {
                    confirmBtn = btn;
                    break;
                }
            }
            if (!confirmBtn) {
                confirmBtn = dialog.querySelector('.next-btn-primary');
            }
            if (confirmBtn) {
                await realClick(confirmBtn);
                await sleep3(800);
                break;
            }
        }
        await sleep3(150);
    }

    await sleep3(500);

    if (found) {
        log('✅ 已选择公司介绍模板: ' + selectedText, 'success');
        results.push('✅ 公司介绍模板: ' + selectedText);
    } else {
        results.push('⚠️ 公司介绍模板选择失败');
    }

    const faqRes = await fillFaqsPage3(product);
    results.push(...faqRes);

    return results;
}

// ============================================================
// 🔑 填入商品关键词 fillKeywordsPage3
// 输入方式: setInputValue (React value setter + input/change事件)
// 遇到的问题:
//   1. 关键词输入框位置不固定，可能在商品属性区域
//   2. 关键词需要从产品数据动态生成
//   3. 找不到时需要提示用户手动填写
// 解决方案:
//   1. 用多种选择器尝试查找: #__keywords__ / name=keywords
//   2. 使用 generateKwFromProduct 从标题/类目自动生成关键词
//   3. 找不到时提示用户在"自定义属性→关键词"栏目手动填
// ============================================================
async function fillKeywordsPage3(product) {
    const results = [];
    const kwStr = generateKwFromProduct(product);
    if (kwStr) {
        const kwInput = await scrollAndFind(() => document.querySelector('input#__keywords__, input[name="keywords"], textarea[name="keywords"]'), 5);
        if (kwInput) {
            await realClick(kwInput);
            await sleep3(200);
            kwInput.focus();
            document.execCommand('selectAll', false, null);
            await sleep3(50);
            for (const ch of String(kwStr)) {
                document.execCommand('insertText', false, ch);
                await sleep3(8);
            }
            kwInput.dispatchEvent(new Event('input', {bubbles: true}));
            kwInput.dispatchEvent(new Event('change', {bubbles: true}));
            await sleep3(100);
            pressEnter(kwInput);
            await sleep3(200);
            results.push(`✅ 关键词已填入 (${kwStr.split(',').length}个)`);
        } else {
            results.push('⚠️ 关键词: 未找到输入框（自定义属性→关键词栏目手动填）');
        }
    }
    return results;
}

async function scrollToRenderAll() {
    const totalHeight = document.documentElement.scrollHeight;
    window.scrollTo(0, totalHeight);
    await sleep3(200);
}

// ============================================================
// 🚀 一键填入 fillAllPage3
// 输入方式: 按顺序依次调用所有填充分函数
// 遇到的问题:
//   1. 各个模块之间有依赖关系，顺序不对会导致部分失败
//   2. 模板选择和长宽高输入需要等待DOM渲染
//   3. 全部一次性填入可能耗时过长
// 解决方案:
//   1. 按页面从上到下的顺序依次执行:
//      商品名称 → 商品分组 → 商品属性 → 商品颜色 → 商品尺码
//      → 尺码模板 → 计量单位 → 阶梯价 → 批量编辑 → 物流信息
//      → 物流模板 → 详情模板 → 公司介绍模板
//   2. 支持 step 参数单独执行某一步，方便调试
//   3. 每个函数内部自己处理滚动查找，确保元素已渲染
//   4. 模板相关函数先执行，长宽高输入最后执行
// ============================================================
async function fillAllPage3(product, step) {
    const results = [];
    const run = (s) => !step || step === s || step === 'fill_all';

    if (run('fill_title')) results.push(...await fillTitlePage3(product));
    if (run('fill_group')) results.push(...await fillGroupPage3(product));
    if (run('fill_attributes')) results.push(...await fillAttributesPage3(product));
    if (run('fill_colors')) results.push(...await fillColorsPage3(product));
    if (run('fill_sizes')) results.push(...await fillSizesPage3(product));
    if (run('fill_size_template')) results.push(...await fillSizeTemplate(product));
    if (run('fill_price_unit')) results.push(...await fillPriceUnitPage3(product));
    if (run('fill_ladder_price')) results.push(...await fillLadderPricePage3(product));
    if (run('fill_batch_qty')) results.push(...await fillBatchQtyPage3(product));
    if (run('fill_logistics_template')) results.push(...await fillLogisticsTemplate(product));
    if (run('fill_logistics')) results.push(...await fillLogisticsPage3(product));
    if (run('fill_box_rule')) results.push(...await fillBoxRule(product));
    if (run('fill_detail_template')) results.push(...await fillDetailTemplate(product));
    if (run('fill_company_intro_template')) results.push(...await fillCompanyIntroTemplate(product));

    if (!step) results.push('✅ 全部字段处理完毕');
    return results;
}

function createPage3Panel() {
    if (document.getElementById('polo-helper-panel')) return;

    const panel = document.createElement('div');
    panel.id = 'polo-helper-panel';
    panel.style.cssText = `
        position:fixed;top:60px;left:0;z-index:99999;
        background:#fff;border-radius:14px;box-shadow:0 8px 40px rgba(0,0,0,0.18);
        width:380px;max-height:85vh;overflow-y:auto;
        font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;font-size:14px;
    `;

    panel.innerHTML = `
        <div id="polo-panel-header" style="background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);color:white;padding:12px 16px;display:flex;justify-content:space-between;align-items:center;cursor:pointer;">
            <h3 style="margin:0;font-size:15px;font-weight:600;">📦 Polo发品助手 (页3)</h3>
            <div style="display:flex;align-items:center;gap:8px;">
                <span id="polo-collapse" style="cursor:pointer;opacity:0.8;font-size:16px;padding:0 4px;line-height:1;">−</span>
                <span id="polo-close" style="cursor:pointer;opacity:0.8;font-size:18px;padding:0 4px;">×</span>
            </div>
        </div>
        <div id="polo-panel-content" style="padding:12px 16px;">
            <button id="polo-paste-btn" style="display:block;width:100%;padding:12px;border:none;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer;margin-bottom:10px;background:linear-gradient(135deg,#52c41a 0%,#389e0d 100%);color:white;box-shadow:0 2px 8px rgba(82,196,26,0.3);">
                📥 从剪贴板加载产品数据
            </button>
            <div id="polo-product-info" style="background:#f7f8fa;border-radius:8px;padding:10px;margin-bottom:12px;">
                <div style="color:#666;font-size:12px;margin-bottom:4px;">暂无产品数据</div>
                <div style="font-weight:500;color:#333;font-size:12px;">点击上方绿色按钮加载</div>
            </div>
            <div style="display:flex;gap:6px;margin-bottom:8px;">
                <div style="flex:1;font-size:12px;color:#666;line-height:28px;">图片格式:</div>
                <button id="polo-ext-jpg" style="flex:1;padding:6px 8px;border:1px solid #52c41a;border-radius:6px;font-size:12px;font-weight:500;cursor:pointer;background:#52c41a;color:white;">JPG</button>
                <button id="polo-ext-png" style="flex:1;padding:6px 8px;border:1px solid #d9d9d9;border-radius:6px;font-size:12px;font-weight:500;cursor:pointer;background:white;color:#666;">PNG</button>
            </div>
            <button id="polo-autofill-btn" disabled style="display:block;width:100%;padding:10px;border:none;border-radius:8px;font-size:14px;font-weight:500;cursor:pointer;margin-bottom:8px;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);color:white;opacity:0.5;cursor:not-allowed;">
                ⚡ 一键填入
            </button>
            <div style="position:relative;display:flex;gap:4px;padding:4px;margin-bottom:8px;background:#f1f5f9;border-radius:12px;border:1px solid #e2e8f0;">
                <div style="position:absolute;top:4px;left:4px;height:28px;border-radius:10px;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);box-shadow:0 2px 8px rgba(102,126,234,0.3);transition:transform 0.4s cubic-bezier(0.34,1.56,0.64,1),width 0.3s cubic-bezier(0.34,1.56,0.64,1);z-index:1;pointer-events:none;" id="polo-mode-glider"></div>
                <button id="polo-mode-overwrite" class="mode-tab active" style="position:relative;z-index:2;flex:1;height:28px;border:none;background:transparent;color:#64748b;font-size:12px;font-weight:500;cursor:pointer;border-radius:10px;display:flex;align-items:center;justify-content:center;user-select:none;transition:color 0.35s ease;">
                    覆盖填入
                </button>
                <button id="polo-mode-append" class="mode-tab" style="position:relative;z-index:2;flex:1;height:28px;border:none;background:transparent;color:#64748b;font-size:12px;font-weight:500;cursor:pointer;border-radius:10px;display:flex;align-items:center;justify-content:center;user-select:none;transition:color 0.35s ease;">
                    追加填入
                </button>
            </div>
            <div style="position:relative;margin-bottom:8px;">
                <div id="polo-action-dropdown-btn" style="background:#475569;color:white;text-align:center;padding:10px 0;border-radius:8px;cursor:pointer;font-weight:600;font-size:14px;user-select:none;">
                    📋 填入消息属性 ▾
                </div>
                <div id="polo-action-menu" style="position:absolute;top:100%;left:0;right:0;z-index:100000;background:#fff;border-radius:10px;box-shadow:0 8px 32px rgba(0,0,0,0.2);padding:6px;display:none;margin-top:4px;">
                </div>
            </div>
            <div id="polo-log" style="background:#1e1e2e;color:#a6e3a1;padding:10px;border-radius:6px;font-family:monospace;font-size:11px;line-height:1.5;max-height:200px;overflow-y:auto;margin-top:8px;">
                <div style="color:#a6e3a1;">[系统] 发品助手已加载</div>
            </div>
        </div>
    `;

    document.body.appendChild(panel);

    const header = document.getElementById('polo-panel-header');
    const content = document.getElementById('polo-panel-content');
    const collapseBtn = document.getElementById('polo-collapse');
    const pasteBtn = document.getElementById('polo-paste-btn');
    const autofillBtn = document.getElementById('polo-autofill-btn');
    const productInfo = document.getElementById('polo-product-info');
    const dropdownBtn = document.getElementById('polo-action-dropdown-btn');
    const logArea = document.getElementById('polo-log');
    const actionMenu = document.getElementById('polo-action-menu');
    const modeOverwriteBtn = document.getElementById('polo-mode-overwrite');
    const modeAppendBtn = document.getElementById('polo-mode-append');
    const modeGlider = document.getElementById('polo-mode-glider');
    let isCollapsed = false;
    window.__polo_fill_mode = 'overwrite';

    function updateModeGlider() {
        if (!modeGlider) return;
        const activeTab = window.__polo_fill_mode === 'overwrite' ? modeOverwriteBtn : modeAppendBtn;
        if (activeTab) {
            const rect = activeTab.getBoundingClientRect();
            const containerRect = activeTab.parentElement.getBoundingClientRect();
            modeGlider.style.transform = `translateX(${rect.left - containerRect.left - 4}px)`;
            modeGlider.style.width = `${rect.width}px`;
        }
    }

    function togglePanel() {
        isCollapsed = !isCollapsed;
        if (isCollapsed) {
            collapseBtn.textContent = '+';
            pasteBtn.style.display = 'none';
            autofillBtn.style.display = 'none';
            dropdownBtn.style.display = 'none';
            actionMenu.style.display = 'none';
            logArea.style.display = 'none';
            if (extRow) extRow.style.display = 'none';
            panel.style.width = '260px';
            panel.style.maxHeight = 'auto';
        } else {
            collapseBtn.textContent = '−';
            pasteBtn.style.display = 'block';
            autofillBtn.style.display = 'block';
            dropdownBtn.style.display = 'block';
            logArea.style.display = 'block';
            if (extRow) extRow.style.display = 'flex';
            panel.style.width = '380px';
            panel.style.maxHeight = '85vh';
        }
    }

    collapseBtn.onclick = (e) => {
        e.stopPropagation();
        togglePanel();
    };

    header.onclick = (e) => {
        if (e.target !== header) return;
        togglePanel();
    };

    modeOverwriteBtn.onclick = (e) => {
        e.stopPropagation();
        window.__polo_fill_mode = 'overwrite';
        modeOverwriteBtn.classList.add('active');
        modeOverwriteBtn.style.color = '#fff';
        modeAppendBtn.classList.remove('active');
        modeAppendBtn.style.color = '#64748b';
        updateModeGlider();
        log('📌 模式切换为：覆盖填入', 'info');
    };

    modeAppendBtn.onclick = (e) => {
        e.stopPropagation();
        window.__polo_fill_mode = 'append';
        modeAppendBtn.classList.add('active');
        modeAppendBtn.style.color = '#fff';
        modeOverwriteBtn.classList.remove('active');
        modeOverwriteBtn.style.color = '#64748b';
        updateModeGlider();
        log('📌 模式切换为：追加填入', 'info');
    };

    const extJpgBtn = document.getElementById('polo-ext-jpg');
    const extPngBtn = document.getElementById('polo-ext-png');
    const extRow = extJpgBtn?.parentElement;

    function updateImgExtButtons() {
        if (!extJpgBtn || !extPngBtn) return;
        if (IMG_EXT === 'jpg') {
            extJpgBtn.style.border = '1px solid #52c41a';
            extJpgBtn.style.background = '#52c41a';
            extJpgBtn.style.color = 'white';
            extPngBtn.style.border = '1px solid #d9d9d9';
            extPngBtn.style.background = 'white';
            extPngBtn.style.color = '#666';
        } else {
            extPngBtn.style.border = '1px solid #52c41a';
            extPngBtn.style.background = '#52c41a';
            extPngBtn.style.color = 'white';
            extJpgBtn.style.border = '1px solid #d9d9d9';
            extJpgBtn.style.background = 'white';
            extJpgBtn.style.color = '#666';
        }
    }

    extJpgBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        saveImgExt('jpg');
        updateImgExtButtons();
        log('📷 图片格式切换为: JPG', 'info');
    });

    extPngBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        saveImgExt('png');
        updateImgExtButtons();
        log('📷 图片格式切换为: PNG', 'info');
    });

    setTimeout(updateModeGlider, 100);

    togglePanel();

    loadImgExt().then(() => {
        updateImgExtButtons();
    });

    let isDragging = false;
    let dragStartX = 0, dragStartY = 0;
    let panelStartLeft = 0, panelStartTop = 0;

    header.addEventListener('mousedown', (e) => {
        if (e.target === collapseBtn || e.target.id === 'polo-close') return;
        isDragging = true;
        dragStartX = e.clientX;
        dragStartY = e.clientY;
        const rect = panel.getBoundingClientRect();
        panelStartLeft = rect.left;
        panelStartTop = rect.top;
        panel.style.cursor = 'grabbing';
        e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        const deltaX = e.clientX - dragStartX;
        const deltaY = e.clientY - dragStartY;
        let newLeft = panelStartLeft + deltaX;
        let newTop = panelStartTop + deltaY;
        const maxLeft = window.innerWidth - panel.offsetWidth;
        const maxTop = window.innerHeight - panel.offsetHeight;
        newLeft = Math.max(0, Math.min(newLeft, maxLeft));
        newTop = Math.max(0, Math.min(newTop, maxTop));
        panel.style.left = newLeft + 'px';
        panel.style.top = newTop + 'px';
        panel.style.right = 'auto';
    });

    document.addEventListener('mouseup', () => {
        if (isDragging) {
            isDragging = false;
            panel.style.cursor = 'pointer';
        }
    });

    document.getElementById('polo-close').onclick = () => panel.remove();

    document.getElementById('polo-autofill-btn').onclick = async () => {
        if (!currentProduct) {
            log('没有产品数据！', 'error');
            return;
        }
        const btn = document.getElementById('polo-autofill-btn');
        btn.disabled = true;
        btn.style.opacity = '0.5';
        try {
            await ensureTabActive();
            log('开始自动填写页3...');
            const results = await fillAllPage3(currentProduct);
            for (const r of results) log(r, r.startsWith('✅') ? 'success' : r.startsWith('⚠️') ? 'warn' : 'info');
            
            log('🎉 全部填入完成！', 'success');
            log('💡 请检查填写内容后，手动点击页面底部的保存按钮', 'success');
            
            const saveBtn = Array.from(document.querySelectorAll('button')).find(b => 
                (b.innerText || b.textContent || '').trim() === '保存' && b.offsetHeight > 0
            );
            if (saveBtn) {
                saveBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
                log('🔍 已滚动到保存按钮位置', 'info');
            }
            
            const rowNum = getRowFromUrl();
            if (rowNum !== null) {
                chrome.runtime.sendMessage({ action: 'markUploaded', row: rowNum }, () => {});
                log(`🔄 批量模式：标记第${rowNum}行已上传完成`, 'success');
                log(`🔄 批量模式：通知后台第${rowNum}行页3填写完成，准备打开下一个`, 'success');
                setTimeout(() => {
                    chrome.runtime.sendMessage({ action: 'publishCompleted', rowNum: rowNum }, () => {});
                }, 1000);
            }
        } catch (e) {
            log('❌ 填入失败: ' + e.message, 'error');
        }
        btn.disabled = false;
        btn.style.opacity = '1';
    };

    const items = [
        { icon: '🖼️', label: '上传主图', act: 'fill_images' },
        { icon: '📌', label: '填入商品名称', act: 'fill_title' },
        { icon: '📁', label: '选择商品分组', act: 'fill_group' },
        { icon: '🔑', label: '填入商品关键词', act: 'fill_keywords' },
        { icon: '📋', label: '填入商品属性', act: 'fill_attributes' },
        { icon: '🎨', label: '填入商品颜色', act: 'fill_colors' },
        { icon: '📏', label: '填入商品尺码', act: 'fill_sizes' },
        { icon: '📐', label: '选择尺码模板', act: 'fill_size_template' },
        { icon: '💲', label: '计量单位', act: 'fill_price_unit' },
        { icon: '💰', label: '阶梯价', act: 'fill_ladder_price' },
        { icon: '🔢', label: '批量编辑10000', act: 'fill_batch_qty' },
        { icon: '📦', label: '物流信息', act: 'fill_logistics' },
        { icon: '📦', label: '箱规关联', act: 'fill_box_rule' },
        { icon: '📑', label: '选择物流模板', act: 'fill_logistics_template' },
        { icon: '🖼️', label: '选择详情模板', act: 'fill_detail_template' },
        { icon: '🏢', label: '选择公司介绍模板', act: 'fill_company_intro_template' },
        { icon: '✨', label: '填入商品卖点', act: 'fill_highlights', mode: true },
        { icon: '❓', label: '填入FAQs', act: 'fill_faqs', mode: true },
        { icon: '💾', label: '保存', act: 'save_draft' },
    ];

    const actionMap = {
        fill_images: fillImagesPage3,
        fill_title: fillTitlePage3,
        fill_group: fillGroupPage3,
        fill_keywords: fillKeywordsPage3,
        fill_attributes: fillAttributesPage3,
        fill_colors: fillColorsPage3,
        fill_sizes: fillSizesPage3,
        fill_size_template: fillSizeTemplate,
        fill_price_unit: fillPriceUnitPage3,
        fill_ladder_price: fillLadderPricePage3,
        fill_logistics: fillLogisticsPage3,
        fill_box_rule: fillBoxRule,
        fill_logistics_template: fillLogisticsTemplate,
        fill_detail_template: fillDetailTemplate,
        fill_company_intro_template: fillCompanyIntroTemplate,
        fill_highlights: fillHighlightsPage3,
        fill_faqs: fillFaqsPage3,
        fill_batch_qty: fillBatchQtyPage3,
        save_draft: saveDraft,
    };

    const menu = document.getElementById('polo-action-menu');

    items.forEach(({ icon, label, act, mode: needMode }) => {
        const el = document.createElement('div');
        el.style.cssText = 'padding:8px 12px;border-radius:6px;cursor:pointer;font-size:13px;color:#333;transition:background 0.15s;';
        el.innerText = `${icon} ${label}`;
        el.onmouseenter = () => { el.style.background = '#f1f5f9'; };
        el.onmouseleave = () => { el.style.background = 'transparent'; };
        el.onclick = async (e) => {
            e.stopPropagation();
            menu.style.display = 'none';
            if (!currentProduct) {
                log('没有产品数据！', 'error');
                return;
            }
            log(`📤 ${label}执行中...`);
            try {
                const fn = actionMap[act];
                const results = fn ? (needMode ? await fn(currentProduct, window.__polo_fill_mode) : await fn(currentProduct)) : await fillAllPage3(currentProduct, act);
                let hasSuccess = false;
                let hasWarn = false;
                for (const r of results) {
                    const type = r.startsWith('✅') ? 'success' : r.startsWith('⚠️') ? 'warn' : 'info';
                    if (type === 'success') hasSuccess = true;
                    if (type === 'warn') hasWarn = true;
                    log(r, type);
                }
                if (hasSuccess && !hasWarn) {
                    log(`✅ ${label}完成`);
                } else if (hasWarn) {
                    log(`⚠️ ${label}部分完成`, 'warn');
                } else {
                    log(`⚠️ ${label}未完成`, 'warn');
                }
            } catch (e) {
                log(`❌ ${label}失败: ${e.message}`, 'error');
            }
        };
        menu.appendChild(el);
    });

    let open = false;
    const ddBtn = document.getElementById('polo-action-dropdown-btn');
    ddBtn.onclick = (e) => {
        e.stopPropagation();
        open = !open;
        menu.style.display = open ? 'block' : 'none';
    };
    document.addEventListener('click', () => { open = false; menu.style.display = 'none'; });

    document.getElementById('polo-paste-btn').onclick = loadFromClipboard;

    chrome.runtime.onMessage.addListener((request) => {
        if (request.action === 'uploadResult') {
            if (request.result?.ok) {
                log('✓ 主图上传成功！', 'success');
            } else {
                log('✗ 主图上传失败: ' + (request.result?.error || '未知错误'), 'error');
            }
        }
        if (request.action === 'log' && request.msg) {
            log(request.msg, 'warn');
        }
    });
}

function getRowFromUrl() {
    const params = new URLSearchParams(window.location.search);
    const row = params.get('row');
    if (row) return parseInt(row, 10);
    try {
        const ssRow = sessionStorage.getItem('polo_batch_row');
        if (ssRow) return parseInt(ssRow, 10);
    } catch (e) {}
    return null;
}

async function loadBatchProduct(rowNum) {
    try {
        const resp = await sendMessageRetry({
            action: 'getProductByRow',
            rowNum: rowNum
        });
        if (resp && resp.ok && resp.data) {
            currentProduct = resp.data;
            updateProductInfo(currentProduct);
            log('✓ 从批量数据加载产品: 行' + rowNum, 'success');

            const uploadedResp = await sendMessageRetry({
                action: 'getUploadedRows'
            });
            if (uploadedResp && uploadedResp.ok && uploadedResp.rows && uploadedResp.rows[rowNum]) {
                log(`⚠️ 第${rowNum}行已上传完成，跳过自动填入`, 'warn');
                return false;
            }
            
            const stopHeartbeat = startHeartbeat(15000);
            log('💓 保活心跳已启动（每15秒）', 'info');
            
            await new Promise(r => setTimeout(r, 3000));
            
            try {
                await ensureTabActive();
                log('🔄 批量模式：自动开始填写页3...', 'success');
                const results = await fillAllPage3(currentProduct);
                for (const r of results) log(r, r.startsWith('✅') ? 'success' : r.startsWith('⚠️') ? 'warn' : 'info');
                
                log('🎉 全部填入完成！', 'success');
                log('💡 请检查填写内容后，手动点击页面底部的保存按钮', 'success');
                
                const saveBtn = Array.from(document.querySelectorAll('button')).find(b => 
                    (b.innerText || b.textContent || '').trim() === '保存' && b.offsetHeight > 0
                );
                if (saveBtn) {
                    saveBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    log('🔍 已滚动到保存按钮位置', 'info');
                }
                
                await sendMessageRetry({ action: 'markUploaded', row: rowNum });
                log(`🔄 批量模式：标记第${rowNum}行已上传完成`, 'success');
                log(`🔄 批量模式：通知后台第${rowNum}行页3填写完成，准备打开下一个`, 'success');
                setTimeout(async () => {
                    try {
                        await sendMessageRetry({ action: 'publishCompleted', rowNum: rowNum });
                    } catch (e) {
                        log('❌ 通知后台失败: ' + e.message, 'error');
                    } finally {
                        stopHeartbeat();
                    }
                }, 1000);
            } catch (e) {
                log('❌ 自动填入失败: ' + e.message, 'error');
                stopHeartbeat();
            }
            
            return true;
        }
    } catch (e) {
        log('✗ 加载批量产品失败: ' + e.message, 'error');
    }
    return false;
}

function initPage3() {
    if (top !== self) return;
    createPage3Panel();

    const rowNum = getRowFromUrl();
    if (rowNum !== null) {
        log('📦 检测到批量发品模式，行' + rowNum + '，正在加载产品数据...', 'info');
        initStorageListener(true);
        loadBatchProduct(rowNum);
    } else {
        initStorageListener(false);
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPage3);
} else {
    initPage3();
}
