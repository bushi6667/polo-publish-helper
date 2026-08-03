// ============================================================
// page3_upload.js —— 页3（publish）主图/颜色图上传执行器（background 侧 importScripts 加载）
// 通过 chrome.debugger CDP 在 1688 发品页执行真实点击 + 文件注入：
//   attach debugger → 在页面 MAIN world 查找上传占位区（含 Shadow DOM 递归）→
//   真实鼠标点击触发文件选择器 → Page.fileChooserOpened → DOM.setFileInputFiles 注入 →
//   轮询校验上传结果
// 含两个入口：uploadPage3ImageViaCDP（主图）、uploadColorImageViaCDP（颜色图）
// ============================================================
async function uploadPage3ImageViaCDP(tabId, imagePath) {
    // 页面内浮动面板日志（经 content script 的 log action 转发）
    const sendLog = async (msg) => {
        try { await chrome.tabs.sendMessage(tabId, { action: 'log', msg }); } catch (_) {}
    };

    try {
        console.log('📤 [page3 upload] 开始:', imagePath);
        await sendLog('📤 开始上传主图: ' + imagePath);

        try { await chrome.debugger.detach({ tabId }); } catch (_) {}
        await new Promise(r => setTimeout(r, 100));
        await chrome.debugger.attach({ tabId }, '1.3');
        await chrome.debugger.sendCommand({ tabId }, 'Page.enable');
        await chrome.debugger.sendCommand({ tabId }, 'DOM.enable');
        await chrome.debugger.sendCommand({ tabId }, 'Runtime.enable');

        console.log('🔍 查找上传占位区域...');
        const hoverResult = await chrome.scripting.executeScript({
            target: { tabId: tabId },
            world: 'MAIN',
            func: () => {
                // 递归查找上传占位区：优先顶层选择器，找不到则遍历 Shadow DOM 子树
                // （页3 部分区域是 shadow DOM 包裹，常规 querySelector 无法穿透）
                function findInShadow(root) {
                    if (!root) return null;
                    const sel = '#image-placeholder, .image-upload-photobank-placeholder, .upload-select-inner';
                    const found = root.querySelector?.(sel);
                    if (found) {
                        const rect = found.getBoundingClientRect();
                        if (rect.width > 0 && rect.height > 0) return found;
                    }
                    const all = root.querySelectorAll?.('*') || [];
                    for (const el of all) {
                        if (el.shadowRoot) {
                            const r = findInShadow(el.shadowRoot);
                            if (r) return r;
                        }
                    }
                    return null;
                }
                const el = findInShadow(document);
                if (el) {
                    el.scrollIntoView({ block: 'center', behavior: 'instant' });
                    const rect = el.getBoundingClientRect();
                    return {
                        found: true,
                        x: Math.round(rect.left + rect.width / 2),
                        y: Math.round(rect.top + rect.height / 2)
                    };
                }
                return { found: false };
            }
        });

        let hovered = false;
        if (hoverResult?.[0]?.result?.found) {
            const { x, y } = hoverResult[0].result;
            console.log(`✅ hover 到上传区域 (${x}, ${y})`);
            await sendLog(`🔍 找到上传占位区域，hover 到 (${x}, ${y})`);
            await chrome.debugger.sendCommand({ tabId }, 'Input.dispatchMouseEvent', {
                type: 'mouseMoved', x, y
            });
            hovered = true;
            await new Promise(r => setTimeout(r, 800));
        } else {
            console.warn('⚠️ 未找到上传占位区域，跳过 hover');
            await sendLog('⚠️ 未找到上传占位区域，跳过 hover');
        }

        console.log('🔧 方式A：查找 file input...');
        await sendLog('🔧 正在查找上传文件选择器...');

        const inputResult = await chrome.scripting.executeScript({
            target: { tabId: tabId },
            world: 'MAIN',
            func: () => {
                function findInShadow(root) {
                    if (!root) return null;
                    const inputs = root.querySelectorAll?.('input[type="file"]') || [];
                    for (const inp of inputs) {
                        if (inp.closest?.('.upload-select-inner')) return inp;
                    }
                    if (inputs.length > 0) return inputs[0];
                    const all = root.querySelectorAll?.('*') || [];
                    for (const el of all) {
                        if (el.shadowRoot) {
                            const r = findInShadow(el.shadowRoot);
                            if (r) return r;
                        }
                    }
                    return null;
                }
                const input = findInShadow(document);
                const allInputs = document.querySelectorAll('input[type="file"]');
                const info = [];
                allInputs.forEach((inp, i) => {
                    info.push({
                        i,
                        id: inp.id || '',
                        className: inp.className || '',
                        accept: inp.accept || '',
                        multiple: inp.multiple,
                        visible: inp.offsetWidth > 0 && inp.offsetHeight > 0,
                        inUploadInner: !!inp.closest?.('.upload-select-inner'),
                        inShadow: !!inp.getRootNode?.()?.host
                    });
                });
                return { found: !!input, totalCount: allInputs.length, hasUploadInner: !!document.querySelector('.upload-select-inner'), details: info };
            }
        });

        let methodAOk = false;
        const normPath = imagePath.replace(/\\/g, '/');

        if (inputResult?.[0]?.result?.found) {
            await sendLog(`📊 页面共 ${inputResult[0].result.totalCount} 个文件选择器，已定位到上传区域`);
            console.log(`📊 共 ${inputResult[0].result.totalCount} 个 file input`, inputResult[0].result.details);

            try {
                const evalResult = await chrome.debugger.sendCommand({ tabId }, 'Runtime.evaluate', {
                    expression: `
                        (function() {
                            function findInShadow(root) {
                                if (!root) return null;
                                const inputs = root.querySelectorAll?.('input[type="file"]') || [];
                                for (const inp of inputs) {
                                    if (inp.closest?.('.upload-select-inner')) return inp;
                                }
                                if (inputs.length > 0) return inputs[0];
                                const all = root.querySelectorAll?.('*') || [];
                                for (const el of all) {
                                    if (el.shadowRoot) {
                                        const r = findInShadow(el.shadowRoot);
                                        if (r) return r;
                                    }
                                }
                                return null;
                            }
                            return findInShadow(document);
                        })()
                    `,
                    returnByValue: false
                });

                if (evalResult?.result?.objectId) {
                    const objectId = evalResult.result.objectId;
                    try {
                        await chrome.debugger.sendCommand({ tabId }, 'DOM.setFileInputFiles', {
                            files: [normPath],
                            objectId: objectId
                        });
                        console.log('✅ 方式A 注入成功 (objectId)');
                        await sendLog('✅ 文件已注入上传组件（直接引用方式）');
                        methodAOk = true;
                    } catch (e1) {
                        console.warn('⚠️ 方式A objectId失败:', e1.message);
                        await sendLog('⚠️ 方式A objectId失败: ' + e1.message);
                        try {
                            const nodeResp = await chrome.debugger.sendCommand({ tabId }, 'DOM.requestNode', {
                                objectId: objectId
                            });
                            if (nodeResp?.nodeId) {
                                await chrome.debugger.sendCommand({ tabId }, 'DOM.setFileInputFiles', {
                                    files: [normPath],
                                    nodeId: nodeResp.nodeId
                                });
                                console.log('✅ 方式A 注入成功 (nodeId)');
                                await sendLog('✅ 方式A 注入成功 (nodeId)');
                                methodAOk = true;
                            }
                        } catch (e2) {
                            console.warn('⚠️ 方式A nodeId失败:', e2.message);
                            await sendLog('⚠️ 方式A nodeId失败: ' + e2.message);
                        }
                    }
                }
            } catch (e) {
                console.warn('⚠️ 方式A Runtime失败:', e.message);
                await sendLog('⚠️ 方式A Runtime失败: ' + e.message);
            }

            if (!methodAOk) {
                try {
                    const searchResult = await chrome.debugger.sendCommand({ tabId }, 'DOM.performSearch', {
                        query: 'input[type="file"]',
                        includeUserAgentShadowDOM: true
                    });
                    if (searchResult?.searchId && searchResult?.resultCount > 0) {
                        await sendLog(`🔍 DOM搜索找到 ${searchResult.resultCount} 个`);
                        const searchRes = await chrome.debugger.sendCommand({ tabId }, 'DOM.getSearchResults', {
                            searchId: searchResult.searchId,
                            fromIndex: 0,
                            toIndex: searchResult.resultCount
                        });
                        if (searchRes?.nodeIds?.length > 0) {
                            for (let i = 0; i < searchRes.nodeIds.length; i++) {
                                const nodeId = searchRes.nodeIds[i];
                                try {
                                    await chrome.debugger.sendCommand({ tabId }, 'DOM.setFileInputFiles', {
                                        files: [normPath],
                                        nodeId: nodeId
                                    });
                                    console.log(`✅ 方式A 成功 (nodeId=${nodeId})`);
                                    await sendLog(`✅ 方式A 注入成功 (搜索方式 #${i + 1})`);
                                    methodAOk = true;
                                    break;
                                } catch (e) {
                                    console.warn(`  nodeId=${nodeId} 失败:`, e.message);
                                    await sendLog(`⚠️ 搜索 #${i + 1} 失败: ${e.message}`);
                                }
                            }
                        }
                    }
                } catch (e) {
                    console.warn('⚠️ 方式A DOM搜索失败:', e.message);
                    await sendLog('⚠️ 方式A DOM搜索失败: ' + e.message);
                }
            }

            if (!methodAOk) {
                try {
                    await sendLog('🔧 方式A-直连：尝试直接触发 input + 监听 fileChooser');
                    let fileChooserResolved = false;
                    let fileChooserParams = null;

                    const fcHandler = (source, event) => {
                        if (source.tabId !== tabId) return;
                        if (event.method === 'Page.fileChooserOpened') {
                            fileChooserResolved = true;
                            fileChooserParams = event.params;
                        }
                    };
                    chrome.debugger.onEvent.addListener(fcHandler);

                    await chrome.debugger.sendCommand({ tabId }, 'Runtime.evaluate', {
                        expression: `
                            (function() {
                                function findInShadow(root) {
                                    if (!root) return null;
                                    const inputs = root.querySelectorAll?.('input[type="file"]') || [];
                                    for (const inp of inputs) {
                                        if (inp.closest?.('.upload-select-inner')) return inp;
                                    }
                                    if (inputs.length > 0) return inputs[0];
                                    const all = root.querySelectorAll?.('*') || [];
                                    for (const el of all) {
                                        if (el.shadowRoot) {
                                            const r = findInShadow(el.shadowRoot);
                                            if (r) return r;
                                        }
                                    }
                                    return null;
                                }
                                const inp = findInShadow(document);
                                if (inp) {
                                    inp.addEventListener('change', () => {}, { once: true });
                                    inp.click();
                                    return true;
                                }
                                return false;
                            })()
                        `,
                        userGesture: true
                    });

                    for (let i = 0; i < 50; i++) {
                        if (fileChooserResolved) break;
                        await new Promise(r => setTimeout(r, 100));
                    }

                    chrome.debugger.onEvent.removeListener(fcHandler);

                    if (fileChooserResolved && fileChooserParams?.backendNodeId) {
                        await chrome.debugger.sendCommand({ tabId }, 'DOM.setFileInputFiles', {
                            files: [normPath],
                            backendNodeId: fileChooserParams.backendNodeId
                        });
                        console.log('✅ 方式A 直连注入成功');
                        await sendLog('✅ 方式A 直连注入成功');
                        methodAOk = true;
                    } else {
                        await sendLog('⚠️ 方式A 直连未触发 fileChooser');
                    }
                } catch (e) {
                    console.warn('⚠️ 方式A 直连失败:', e.message);
                    await sendLog('⚠️ 方式A 直连失败: ' + e.message);
                }
            }
        } else {
            await sendLog('⚠️ 方式A: 未找到 file input（可能在 shadow DOM 内）');
        }

        if (methodAOk) {
            const uploadOk = await waitForPage3UploadImages(tabId, sendLog);
            await chrome.debugger.detach({ tabId });
            if (uploadOk) {
                await sendLog('✅ 主图上传完成（方式A）');
                return { ok: true, method: 'direct-injection' };
            } else {
                await sendLog('⚠️ 方式A 注入后未检测到图片，尝试方式B...');
                try {
                    await chrome.debugger.attach({ tabId }, '1.3');
                    await chrome.debugger.sendCommand({ tabId }, 'Page.enable');
                    await chrome.debugger.sendCommand({ tabId }, 'DOM.enable');
                } catch (_) {}
            }
        }

        console.log('🔧 方式B：点击按钮 + 监听文件选择器...');
        await sendLog('🔧 方式B：点击上传按钮...');

        const btnResult = await chrome.scripting.executeScript({
            target: { tabId: tabId },
            world: 'MAIN',
            func: () => {
                function findInShadow(root) {
                    if (!root) return null;
                    const btn1 = root.querySelector?.('.upload-select-inner button.upload-image, .upload-select-inner .next-btn.upload-image');
                    if (btn1) {
                        const rect = btn1.getBoundingClientRect();
                        if (rect.width > 0 && rect.height > 0) return { el: btn1, source: 'upload-image-class' };
                    }
                    const inner = root.querySelector?.('.upload-select-inner');
                    if (inner) {
                        const btns = inner.querySelectorAll?.('button, [role="button"]');
                        for (const b of btns || []) {
                            const rect = b.getBoundingClientRect();
                            if (rect.width > 0 && rect.height > 0) return { el: b, source: 'upload-select-inner' };
                        }
                    }
                    const all = root.querySelectorAll?.('button, [role="button"], span, div') || [];
                    for (const el of all) {
                        const t = (el.innerText || el.textContent || '').trim();
                        if (t === '本地上传' || t.includes('本地上传')) {
                            const rect = el.getBoundingClientRect();
                            if (rect.width > 0 && rect.height > 0) return { el, source: 'text-match' };
                        }
                    }
                    const allEls = root.querySelectorAll?.('*') || [];
                    for (const el of allEls) {
                        if (el.shadowRoot) {
                            const r = findInShadow(el.shadowRoot);
                            if (r) return r;
                        }
                    }
                    return null;
                }
                const r = findInShadow(document);
                if (r) {
                    const rect = r.el.getBoundingClientRect();
                    return {
                        found: true,
                        x: Math.round(rect.left + rect.width / 2),
                        y: Math.round(rect.top + rect.height / 2),
                        source: r.source
                    };
                }
                return { found: false };
            }
        });

        if (!btnResult?.[0]?.result?.found) {
            await chrome.debugger.detach({ tabId });
            await sendLog('❌ 未找到上传按钮');
            return { ok: false, error: '未找到上传按钮' };
        }

        const { x: btnX, y: btnY, source: btnSource } = btnResult[0].result;
        console.log(`✅ 找到按钮 (${btnX}, ${btnY}) via ${btnSource}`);
        await sendLog(`🔍 找到按钮 (${btnX}, ${btnY}) via ${btnSource}`);

        if (!hovered) {
            await chrome.debugger.sendCommand({ tabId }, 'Input.dispatchMouseEvent', {
                type: 'mouseMoved', x: btnX, y: btnY
            });
            await new Promise(r => setTimeout(r, 500));
        }

        console.log('⏳ 等待文件选择器...');
        await sendLog('⏳ 等待文件选择器...');
        const fileChooserPromise = new Promise((resolve) => {
            const timeout = setTimeout(() => {
                resolve({ action: 'timeout' });
            }, 15000);
            const handler = (source, event) => {
                if (source.tabId !== tabId) return;
                if (event.method === 'Page.fileChooserOpened') {
                    clearTimeout(timeout);
                    chrome.debugger.onEvent.removeListener(handler);
                    resolve({ action: 'opened', params: event.params });
                }
            };
            chrome.debugger.onEvent.addListener(handler);
        });

        await chrome.debugger.sendCommand({ tabId }, 'Input.dispatchMouseEvent', {
            type: 'mouseMoved', x: btnX, y: btnY
        });
        await new Promise(r => setTimeout(r, 300));
        await chrome.debugger.sendCommand({ tabId }, 'Input.dispatchMouseEvent', {
            type: 'mousePressed', x: btnX, y: btnY, button: 'left', clickCount: 1
        });
        await new Promise(r => setTimeout(r, 100));
        await chrome.debugger.sendCommand({ tabId }, 'Input.dispatchMouseEvent', {
            type: 'mouseReleased', x: btnX, y: btnY, button: 'left', clickCount: 1
        });

        const chooserResult = await fileChooserPromise;
        if (chooserResult.action !== 'opened') {
            await sendLog('⚠️ 方式B: 文件选择器事件未触发，尝试兜底方案...');

            try {
                await sendLog('🔧 兜底：通过 Runtime.evaluate 获取所有 input 并逐个尝试');
                const evalAllResult = await chrome.debugger.sendCommand({ tabId }, 'Runtime.evaluate', {
                    expression: `
                        (function() {
                            function findAllInShadow(root) {
                                let results = [];
                                if (!root) return results;
                                const inputs = root.querySelectorAll?.('input[type="file"]') || [];
                                results = results.concat(Array.from(inputs));
                                const all = root.querySelectorAll?.('*') || [];
                                for (const el of all) {
                                    if (el.shadowRoot) {
                                        results = results.concat(findAllInShadow(el.shadowRoot));
                                    }
                                }
                                return results;
                            }
                            const inputs = findAllInShadow(document);
                            return inputs.map((inp, i) => ({
                                i,
                                id: inp.id || '',
                                name: inp.name || '',
                                className: inp.className || '',
                                accept: inp.accept || '',
                                inUploadInner: !!inp.closest?.('.upload-select-inner')
                            }));
                        })()
                    `,
                    returnByValue: true
                });

                const inputList = evalAllResult?.result?.value || [];
                await sendLog(`📋 找到 ${inputList.length} 个 file input`);

                for (let idx = 0; idx < inputList.length; idx++) {
                    try {
                        const idxResult = await chrome.debugger.sendCommand({ tabId }, 'Runtime.evaluate', {
                            expression: `
                                (function() {
                                    function findAllInShadow(root) {
                                        let results = [];
                                        if (!root) return results;
                                        const inputs = root.querySelectorAll?.('input[type="file"]') || [];
                                        results = results.concat(Array.from(inputs));
                                        const all = root.querySelectorAll?.('*') || [];
                                        for (const el of all) {
                                            if (el.shadowRoot) {
                                                results = results.concat(findAllInShadow(el.shadowRoot));
                                            }
                                        }
                                        return results;
                                    }
                                    return findAllInShadow(document)[${idx}];
                                })()
                            `,
                            returnByValue: false
                        });

                        if (idxResult?.result?.objectId) {
                            try {
                                await chrome.debugger.sendCommand({ tabId }, 'DOM.setFileInputFiles', {
                                    files: [normPath],
                                    objectId: idxResult.result.objectId
                                });
                                const testOk = await waitForPage3UploadImages(tabId, sendLog, 10);
                                if (testOk) {
                                    await chrome.debugger.detach({ tabId });
                                    await sendLog(`✅ 兜底方案 #${idx + 1} 上传成功！`);
                                    return { ok: true, method: 'fallback-' + idx };
                                }
                            } catch (_) {}
                        }
                    } catch (_) {}
                }

                await chrome.debugger.detach({ tabId });
                await sendLog('❌ 所有方案均失败');
                return { ok: false, error: '所有上传方案均失败' };
            } catch (e2) {
                await chrome.debugger.detach({ tabId });
                await sendLog('❌ 兜底方案失败: ' + e2.message);
                return { ok: false, error: '文件选择器超时未触发' };
            }
        }

        console.log('✅ 文件选择器打开，注入文件...');
        await sendLog('✅ 文件选择器打开，注入文件...');

        await chrome.debugger.sendCommand({ tabId }, 'DOM.setFileInputFiles', {
            files: [normPath],
            backendNodeId: chooserResult.params.backendNodeId
        });

        const uploadOk2 = await waitForPage3UploadImages(tabId, sendLog);
        await chrome.debugger.detach({ tabId });

        if (uploadOk2) {
            await sendLog('✅ 主图上传完成（方式B）');
            return { ok: true, method: 'filechooser' };
        } else {
            await sendLog('⚠️ 方式B 注入后未检测到图片上传结果');
            return { ok: false, error: '上传后未检测到图片' };
        }
    } catch (e) {
        try { await chrome.debugger.detach({ tabId }); } catch (_) {}
        console.error('❌ 上传失败:', e.message);
        await sendLog('❌ 上传失败: ' + e.message);
        return { ok: false, error: e.message };
    }
}

// 轮询检测页3主图是否上传成功（注入 MAIN world 用 countRealImages 统计真实图片数），
// 最多 maxAttempts 次；返回 true 表示检测到图片
async function waitForPage3UploadImages(tabId, sendLog, maxAttempts = 30) {
    console.log('⏳ 轮询检测上传结果...');
    for (let i = 0; i < maxAttempts; i++) {
        try {
            const result = await chrome.scripting.executeScript({
                target: { tabId: tabId },
                world: 'MAIN',
                func: () => {
                    // 统计真实图片数量：排除 SVG 小图标/过小装饰图/占位符，只在列表项范围内统计
function countRealImages(root) {
                        if (!root) return 0;
                        const items = root.querySelectorAll('.image-upload-list-item, .image-item');
                        let count = 0;
                        for (const item of items) {
                            const imgs = item.querySelectorAll('img');
                            for (const img of imgs) {
                                const src = img.src || '';
                                if (!src) continue;
                                if (src.startsWith('data:image/svg')) continue;
                                if (src.includes('placeholder') || src.includes('plus') || src.includes('add')) continue;
                                if (img.naturalWidth && img.naturalWidth < 20) continue;
                                count++;
                                break;
                            }
                        }
                        return count;
                    }
                    const container = document.querySelector('div.image-uploader, #image-placeholder, .image-upload-photobank-placeholder')?.parentElement;
                    if (container) {
                        return { count: countRealImages(container) };
                    }
                    return { count: countRealImages(document) };
                }
            });
            const count = result?.[0]?.result?.count || 0;
            if (count > 0) {
                console.log(`✅ 检测到 ${count} 张图片`);
                await sendLog(`✅ 检测到 ${count} 张图片已上传`);
                return true;
            }
        } catch (e) {
            console.warn('  检测失败:', e.message);
        }
        if (i > 0 && i % 10 === 0) {
            await sendLog(`⏳ 等待上传... (${i}/${maxAttempts})`);
        }
        await new Promise(r => setTimeout(r, 1000));
    }
    console.log('⚠️ 上传检测超时');
    return false;
}

// 颜色图上传：先定位颜色规格行（colorLabel + icon 坐标），点击上传图标触发文件选择器，
// 再经 CDP 注入颜色图文件；用于 1688 发品页的颜色规格图（按颜色逐一上传）
async function uploadColorImageViaCDP(tabId, colorLabel, imagePath, iconX, iconY, itemIndex) {
    // 页面内浮动面板日志
    const sendLog = async (msg) => {
        try { await chrome.tabs.sendMessage(tabId, { action: 'log', msg }); } catch (_) {}
    };

    try {
        console.log(`📤 [SKU颜色图上传] ${colorLabel} (item ${itemIndex}): ${imagePath}`);
        await sendLog(`📤 上传 ${colorLabel} 颜色图...`);

        try { await chrome.debugger.detach({ tabId }); } catch (_) {}
        await new Promise(r => setTimeout(r, 100));
        await chrome.debugger.attach({ tabId }, '1.3');
        await chrome.debugger.sendCommand({ tabId }, 'Page.enable');
        await chrome.debugger.sendCommand({ tabId }, 'DOM.enable');
        await chrome.debugger.sendCommand({ tabId }, 'Runtime.enable');
        await chrome.debugger.sendCommand({ tabId }, 'Page.setInterceptFileChooserDialog', { enabled: true });

        const normPath = imagePath.replace(/\\/g, '/');
        const idx = itemIndex ?? 0;

        const infoResult = await chrome.debugger.sendCommand({ tabId }, 'Runtime.evaluate', {
            expression: `
                (function() {
                    const items = document.querySelectorAll('.posting-field-color .item, .item[role="item"]');
                    const idx = ${idx};
                    if (!items[idx]) return { found: false, error: 'item not found' };

                    const item = items[idx];
                    const uploadImg = item.querySelector('.custom-upload-image');
                    if (!uploadImg) return { found: false, error: 'upload icon not found' };

                    const iconRect = uploadImg.getBoundingClientRect();
                    const fileInput = item.querySelector('input[type="file"]');

                    return {
                        found: true,
                        iconX: Math.round(iconRect.left + iconRect.width / 2),
                        iconY: Math.round(iconRect.top + iconRect.height / 2),
                        hasFileInput: !!fileInput
                    };
                })()
            `,
            returnByValue: true
        });

        const info = infoResult?.result?.value;
        if (!info?.found) {
            await chrome.debugger.detach({ tabId });
            await sendLog(`❌ 找不到上传元素: ${info?.error || '未知'}`);
            return { ok: false, error: info?.error || '找不到上传元素', color: colorLabel };
        }

        const iX = info.iconX;
        const iY = info.iconY;
        await sendLog(`📍 上传图标: (${iX}, ${iY})`);

        await sendLog(`🖱️ 悬停上传图标 (${iX}, ${iY})`);
        await chrome.debugger.sendCommand({ tabId }, 'Input.dispatchMouseEvent', {
            type: 'mouseMoved', x: iX, y: iY
        });
        await new Promise(r => setTimeout(r, 1000));

        const doc = await chrome.debugger.sendCommand({ tabId }, 'DOM.getDocument', { depth: -1, pierce: true });

        const allInputs = await chrome.debugger.sendCommand({ tabId }, 'DOM.querySelectorAll', {
            nodeId: doc.root.nodeId,
            selector: '.posting-field-color .item input[type="file"], .item[role="item"] input[type="file"]'
        });

        if (allInputs?.nodeIds && allInputs.nodeIds.length > 0) {
            const targetNodeId = allInputs.nodeIds[idx];
            if (targetNodeId) {
                await sendLog(`💡 直接注入 file input (item ${idx})...`);
                try {
                    await chrome.debugger.sendCommand({ tabId }, 'DOM.setFileInputFiles', {
                        files: [normPath],
                        nodeId: targetNodeId
                    });
                    await new Promise(r => setTimeout(r, 2000));
                    await chrome.debugger.detach({ tabId });
                    await sendLog(`✅ ${colorLabel} 颜色图上传成功`);
                    return { ok: true, color: colorLabel };
                } catch (e) {
                    await sendLog(`⚠️ 直接注入失败: ${e.message}`);
                }
            }
        }

        const handleResult = await chrome.debugger.sendCommand({ tabId }, 'Runtime.evaluate', {
            expression: `
                (function() {
                    const items = document.querySelectorAll('.posting-field-color .item, .item[role="item"]');
                    const idx = ${idx};
                    if (!items[idx]) return { visible: false };
                    const handle = items[idx].querySelector('.custom-upload-image-handle');
                    if (!handle) return { visible: false };
                    const style = window.getComputedStyle(handle);
                    const isVisible = style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
                    const btn = handle.querySelector('.image-upload-button, .handle-options-item.upload-container button');
                    if (btn && isVisible) {
                        const rect = btn.getBoundingClientRect();
                        return {
                            visible: true,
                            btnX: Math.round(rect.left + rect.width / 2),
                            btnY: Math.round(rect.top + rect.height / 2)
                        };
                    }
                    return { visible: false };
                })()
            `,
            returnByValue: true
        });

        const handleInfo = handleResult?.result?.value;
        if (!handleInfo?.visible) {
            await chrome.debugger.detach({ tabId });
            await sendLog(`❌ 菜单未展开`);
            return { ok: false, error: '菜单未展开', color: colorLabel };
        }

        const bX = handleInfo.btnX;
        const bY = handleInfo.btnY;
        await sendLog(`✅ 菜单已展开，点击「本地选取」(${bX}, ${bY})`);

        const fcPromise = new Promise((resolve) => {
            const timeout = setTimeout(() => resolve(null), 10000);
            const handler = (source, event) => {
                if (source.tabId !== tabId) return;
                if (event.method === 'Page.fileChooserOpened') {
                    clearTimeout(timeout);
                    chrome.debugger.onEvent.removeListener(handler);
                    resolve(event.params);
                }
            };
            chrome.debugger.onEvent.addListener(handler);
        });

        await chrome.debugger.sendCommand({ tabId }, 'Input.dispatchMouseEvent', {
            type: 'mouseMoved', x: bX, y: bY
        });
        await new Promise(r => setTimeout(r, 300));
        await chrome.debugger.sendCommand({ tabId }, 'Input.dispatchMouseEvent', {
            type: 'mousePressed', x: bX, y: bY, button: 'left', clickCount: 1
        });
        await new Promise(r => setTimeout(r, 100));
        await chrome.debugger.sendCommand({ tabId }, 'Input.dispatchMouseEvent', {
            type: 'mouseReleased', x: bX, y: bY, button: 'left', clickCount: 1
        });

        const fcParams = await fcPromise;
        if (fcParams?.backendNodeId) {
            await sendLog('✅ 文件选择器打开，注入文件...');
            await chrome.debugger.sendCommand({ tabId }, 'DOM.setFileInputFiles', {
                files: [normPath],
                backendNodeId: fcParams.backendNodeId
            });
            await new Promise(r => setTimeout(r, 2000));
            await chrome.debugger.detach({ tabId });
            await sendLog(`✅ ${colorLabel} 颜色图上传成功`);
            return { ok: true, color: colorLabel };
        }

        await chrome.debugger.detach({ tabId });
        await sendLog(`❌ ${colorLabel} 颜色图上传失败`);
        return { ok: false, error: '所有上传方案均失败', color: colorLabel };
    } catch (e) {
        try { await chrome.debugger.detach({ tabId }); } catch (_) {}
        console.error(`❌ ${colorLabel} 上传失败:`, e.message);
        await sendLog(`❌ ${colorLabel} 上传失败: ${e.message}`);
        return { ok: false, error: e.message, color: colorLabel };
    }
}
