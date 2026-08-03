// ============================================================
// page2_upload.js —— 页2（easyListing）主图上传执行器（background 侧 importScripts 加载）
// 通过 chrome.debugger CDP 协议在 1688 发品页执行真实点击/文件注入：
//   attach debugger → 点击上传区域 → 等待 Page.fileChooserOpened →
//   DOM.setFileInputFiles 注入本地图片 → 等待上传完成校验
// 由 background.js 的 uploadMainImage 消息（pageType=page2）触发
// ============================================================
async function uploadPage2ImageViaCDP(tabId, imagePath) {
    // 页面内浮动面板日志（经 content script 的 log action 转发）
    const sendLog = async (msg) => {
        try { await chrome.tabs.sendMessage(tabId, { action: 'log', msg }); } catch (_) {}
    };

    try {
        console.log('📤 [page2 upload] 开始:', imagePath);
        await sendLog('📤 开始上传主图: ' + imagePath);

        await sendLog('🔧 [page2 upload] 准备attach debugger...');
        try {
            await chrome.debugger.attach({ tabId }, '1.3');
            console.log('✅ [page2 upload] debugger attach成功');
            await sendLog('✅ [page2 upload] debugger attach成功');
        } catch (e) {
            console.log('⚠️ [page2 upload] debugger已被attach:', e.message);
            await sendLog('⚠️ [page2 upload] debugger已被attach');
        }

        const normPath = imagePath.replace(/\\/g, '/');

        console.log('🔍 [page2 upload] 查找上传区域...');
        const hoverResult = await chrome.scripting.executeScript({
            target: { tabId: tabId },
            world: 'MAIN',
            func: () => {
                const area = document.querySelector('#image-placeholder, .image-upload-photobank-placeholder');
                if (area) {
                    const rect = area.getBoundingClientRect();
                    if (rect.width > 0 && rect.height > 0) {
                        area.scrollIntoView({ block: 'center', behavior: 'instant' });
                        const centerX = Math.round(rect.left + rect.width / 2);
                        const centerY = Math.round(rect.top + rect.height / 2);
                        return { found: true, x: centerX, y: centerY };
                    }
                }
                return { found: false };
            }
        });

        if (hoverResult?.[0]?.result?.found) {
            const { x, y } = hoverResult[0].result;
            console.log(`✅ [page2 upload] 鼠标悬停到上传区域 (${x}, ${y})`);
            await sendLog(`🔍 鼠标悬停到上传区域 (${x}, ${y})`);
            await chrome.debugger.sendCommand({ tabId }, 'Input.dispatchMouseEvent', {
                type: 'mouseMoved', x, y
            });
            await new Promise(r => setTimeout(r, 500));
        }

        console.log('🔧 [page2 upload] 方式A：直接 CDP 查找 input[type=file] 并注入...');
        await sendLog('🔧 方式A：直接 CDP 查找 input[type=file] 并注入...');

        const doc = await chrome.debugger.sendCommand({ tabId }, 'DOM.getDocument', { depth: -1, pierce: true });

        const selectors = [
            '.upload-select-inner input[type=file]',
            'input#hidden-upload-input[type=file]',
            'input[type=file]'
        ];

        for (const selector of selectors) {
            try {
                const result = await chrome.debugger.sendCommand({ tabId }, 'DOM.querySelectorAll', {
                    nodeId: doc.root.nodeId,
                    selector: selector
                });

                if (result?.nodeIds && result.nodeIds.length > 0) {
                    console.log(`✅ [page2 upload] 使用选择器 "${selector}" 找到 ${result.nodeIds.length} 个 input`);
                    await sendLog(`✅ 使用选择器 "${selector}" 找到 ${result.nodeIds.length} 个 input`);

                    for (const nodeId of result.nodeIds) {
                        try {
                            await chrome.debugger.sendCommand({ tabId }, 'DOM.setFileInputFiles', {
                                files: [normPath],
                                nodeId: nodeId
                            });
                            console.log(`✅ [page2 upload] 方式A 注入成功 (nodeId=${nodeId})`);
                            await sendLog(`✅ 方式A 注入成功 (nodeId=${nodeId})`);

                            await new Promise(r => setTimeout(r, 3000));

                            const uploadOk = await waitForPage2UploadImages(tabId, sendLog);
                            await chrome.debugger.detach({ tabId });

                            if (uploadOk) {
                                await sendLog('✅ 主图上传完成！');
                                return { ok: true, method: 'direct-input-injection' };
                            } else {
                                await sendLog('⚠️ 方式A 注入后未检测到图片，尝试下一个 input...');
                            }
                        } catch (e) {
                            console.warn(`⚠️ [page2 upload] nodeId=${nodeId} 注入失败:`, e.message);
                            await sendLog(`⚠️ nodeId=${nodeId} 注入失败: ${e.message}`);
                        }
                    }
                }
            } catch (e) {
                console.warn(`⚠️ [page2 upload] 选择器 "${selector}" 查询失败:`, e.message);
                await sendLog(`⚠️ 选择器 "${selector}" 查询失败: ${e.message}`);
            }
        }

        console.log('⚠️ [page2 upload] 方式A 所有 input 注入失败，回退到方式B：点击按钮+监听文件选择器...');
        await sendLog('⚠️ 方式A 失败，回退到方式B：点击按钮+监听文件选择器...');

        const btnResult = await chrome.scripting.executeScript({
            target: { tabId: tabId },
            world: 'MAIN',
            func: () => {
                const uploadSelect = document.querySelector('.upload-select-inner');
                if (uploadSelect) {
                    const btn = uploadSelect.querySelector('button, .next-btn, [role="button"], span');
                    if (btn) {
                        const rect = btn.getBoundingClientRect();
                        if (rect.width > 0 && rect.height > 0) {
                            return { found: true, x: Math.round(rect.left + rect.width / 2), y: Math.round(rect.top + rect.height / 2) };
                        }
                    }
                }
                const allBtns = document.querySelectorAll('*');
                for (const el of allBtns) {
                    if (el.textContent && el.textContent.includes('本地上传')) {
                        const rect = el.getBoundingClientRect();
                        if (rect.width > 0 && rect.height > 0) {
                            return { found: true, x: Math.round(rect.left + rect.width / 2), y: Math.round(rect.top + rect.height / 2) };
                        }
                    }
                }
                return { found: false };
            }
        });

        if (!btnResult?.[0]?.result?.found) {
            await chrome.debugger.detach({ tabId });
            await sendLog('❌ 未找到上传按钮');
            return { ok: false, error: '未找到上传按钮' };
        }

        const btnX = btnResult[0].result.x;
        const btnY = btnResult[0].result.y;
        console.log(`✅ [page2 upload] 找到按钮 (${btnX}, ${btnY})`);
        await sendLog(`🔍 找到按钮 (${btnX}, ${btnY})`);

        await chrome.debugger.sendCommand({ tabId }, 'Input.dispatchMouseEvent', {
            type: 'mouseMoved', x: btnX, y: btnY
        });
        await new Promise(r => setTimeout(r, 300));

        console.log('⏳ [page2 upload] 等待文件选择器...');
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
            type: 'mousePressed', x: btnX, y: btnY, button: 'left', clickCount: 1
        });
        await new Promise(r => setTimeout(r, 100));
        await chrome.debugger.sendCommand({ tabId }, 'Input.dispatchMouseEvent', {
            type: 'mouseReleased', x: btnX, y: btnY, button: 'left', clickCount: 1
        });

        const chooserResult = await fileChooserPromise;
        if (chooserResult.action !== 'opened') {
            await chrome.debugger.detach({ tabId });
            await sendLog('❌ 文件选择器超时未触发');
            return { ok: false, error: '文件选择器超时未触发' };
        }

        console.log('✅ [page2 upload] 文件选择器打开，注入文件...');
        await sendLog('✅ 文件选择器打开，注入文件...');

        await chrome.debugger.sendCommand({ tabId }, 'DOM.setFileInputFiles', {
            files: [normPath],
            backendNodeId: chooserResult.params.backendNodeId
        });

        await new Promise(r => setTimeout(r, 3000));

        const uploadOk2 = await waitForPage2UploadImages(tabId, sendLog);
        await chrome.debugger.detach({ tabId });

        if (uploadOk2) {
            await sendLog('✅ 主图上传完成（方式B）');
            return { ok: true, method: 'filechooser' };
        } else {
            await sendLog('⚠️ 方式B 注入后未检测到图片');
            return { ok: false, error: '上传后未检测到图片' };
        }
    } catch (e) {
        try { await chrome.debugger.detach({ tabId }); } catch (_) {}
        console.error('❌ [page2 upload] 上传失败:', e.message);
        await sendLog('❌ 上传失败: ' + e.message);
        return { ok: false, error: e.message };
    }
}

// 轮询检测页2主图是否上传成功（executeScript 注入 MAIN world 数图片数量），
// 最多 maxAttempts 次；返回 true 表示检测到图片
async function waitForPage2UploadImages(tabId, sendLog, maxAttempts = 30) {
    console.log('⏳ [page2 upload] 轮询检测上传结果...');
    for (let i = 0; i < maxAttempts; i++) {
        try {
            const result = await chrome.scripting.executeScript({
                target: { tabId: tabId },
                world: 'MAIN',
                func: () => {
                    const container = document.querySelector('div.image-uploader, #image-placeholder, .image-upload-photobank-placeholder')?.parentElement;
                    if (!container) {
                        const imgs = document.querySelectorAll('.image-upload-list-item img, .image-item img');
                        return { count: imgs.length };
                    }
                    const imgs = container.querySelectorAll('img, .image-upload-list-item, .image-item, .image-previewer');
                    return { count: imgs.length };
                }
            });
            const count = result?.[0]?.result?.count || 0;
            if (count > 0) {
                console.log(`✅ [page2 upload] 检测到 ${count} 张图片`);
                await sendLog(`✅ 检测到 ${count} 张图片已上传`);
                return true;
            }
        } catch (e) {
            console.warn('  [page2 upload] 检测失败:', e.message);
        }
        if (i > 0 && i % 10 === 0) {
            await sendLog(`⏳ 等待上传... (${i}/${maxAttempts})`);
        }
        await new Promise(r => setTimeout(r, 1000));
    }
    console.log('⚠️ [page2 upload] 上传检测超时');
    return false;
}
