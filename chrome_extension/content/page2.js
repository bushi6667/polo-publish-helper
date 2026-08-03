// ============================================================
// page2.js —— 1688 easyListing 发品页（页2）自动填表脚本
// 职责：自动填写产品标题、上传主图、等待预测类目渲染并选择类目；
//       批量模式下自动点击「发布产品」跳转页3，并透传 row= 参数
// 依赖：common.js（工具）、selectors.js（配置）、smartFind.js（查找）
// 面板：页面右下角浮动面板（Polo发品助手）
// ============================================================
let hiddenFileInput = null;
let IMG_EXT = 'jpg';

// 从 storage 加载图片格式配置（默认 jpg）
function loadImgExt() {
    return new Promise((resolve) => {
        chrome.storage.local.get('img_ext', (result) => {
            IMG_EXT = result.img_ext || 'jpg';
            resolve(IMG_EXT);
        });
    });
}

// 保存图片格式配置（页2/页3 共享同一 storage key）
function saveImgExt(ext) {
    IMG_EXT = ext;
    chrome.storage.local.set({ img_ext: ext });
}

// 创建页面隐藏 file input（供 CDP 注入图片文件用）
function createHiddenFileInput() {
    if (hiddenFileInput) return hiddenFileInput;
    hiddenFileInput = document.createElement('input');
    hiddenFileInput.id = 'hidden-upload-input';
    hiddenFileInput.type = 'file';
    hiddenFileInput.accept = 'image/png,image/jpg,image/jpeg';
    hiddenFileInput.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;opacity:0;pointer-events:none;z-index:-1;';
    hiddenFileInput.multiple = false;
    document.body.appendChild(hiddenFileInput);
    return hiddenFileInput;
}

// 轮询等待主图上传完成（出现已上传图片列表项），超时返回 false
function waitForImageUploadPage2(timeoutMs = 20000) {
    return new Promise((resolve) => {
        const startTime = Date.now();
        const check = () => {
            let imgs;
            if (window.smartFind && typeof window.smartFind.findAll === 'function') {
                imgs = window.smartFind.findAll('page2', 'imageUploaded');
            } else {
                const selectors = window.selectors && window.selectors.getList ?
                    window.selectors.getList('page2', 'imageUploaded') :
                    ['.image-upload-list-item img', '.image-item img', '.image-previewer img', '.image-uploader img'];
                imgs = document.querySelectorAll(selectors.join(','));
            }
            if (imgs.length > 0) {
                resolve(true);
                return;
            }
            if (Date.now() - startTime > timeoutMs) {
                resolve(false);
                return;
            }
            setTimeout(check, 500);
        };
        check();
    });
}

// 轮询等待「预测/常用类目」tab 与类目列表渲染完成（上传主图后异步出现）
function waitForPredictCategoryRender(timeoutMs = 15000) {
    return new Promise((resolve) => {
        const startTime = Date.now();
        const check = () => {
            const tabSelectors = window.selectors && window.selectors.getList ?
                window.selectors.getList('page2', 'categoryTab') :
                ['li[role="tab"]', '.next-tabs-tab'];
            
            const tabInnerSelectors = window.selectors && window.selectors.getList ?
                window.selectors.getList('page2', 'categoryTabInner') :
                ['.next-tabs-tab-inner', '[class*="tab-inner"]'];
            
            const catListSelectors = window.selectors && window.selectors.getList ?
                window.selectors.getList('page2', 'categoryList') :
                ['ul.category-list', '.next-tree', '.category-tree'];

            const tabItems = document.querySelectorAll(tabSelectors.join(','));
            let hasPredict = false;
            let hasFav = false;
            for (const tab of tabItems) {
                const inner = tab.querySelector(tabInnerSelectors.join(','));
                const text = (inner ? inner.textContent : tab.textContent) || '';
                if (text.includes('预测') || text.includes('推荐') || text.includes('智能')) {
                    hasPredict = true;
                }
                if (text.includes('您经常使用的类目') || text.includes('常用类目')) {
                    hasFav = true;
                }
            }
            
            const catList = document.querySelector(catListSelectors.join(','));
            if (catList && (hasPredict || hasFav)) {
                resolve(true);
                return;
            }
            
            if (window.smartFind) {
                const foundCatList = window.smartFind.find('page2', 'categoryList');
                if (foundCatList && (hasPredict || hasFav)) {
                    resolve(true);
                    return;
                }
            }
            
            if (Date.now() - startTime > timeoutMs) {
                resolve(false);
                return;
            }
            setTimeout(check, 500);
        };
        check();
    });
}

// 页2自动填表主流程：标题逐字输入 → 上传主图 → 等待预测类目 → 选择类目；
// 批量模式（URL 带 row=）最后自动点击「发布产品」跳转页3
async function autoFillPage2(product) {
    // 页面不可见时先激活标签页
    if (document.visibilityState !== 'visible') {
        try {
            await chrome.runtime.sendMessage({ action: 'activateTab' });
            for (let i = 0; i < 20; i++) {
                await new Promise(r => setTimeout(r, 50));
                if (document.visibilityState === 'visible') break;
            }
        } catch (e) {}
    }

    const dots = document.querySelectorAll('.step-dot');

    const nextStepEl = document.getElementById('polo-next-step');
    const setNextStep = (label) => {
        if (nextStepEl) {
            nextStepEl.innerHTML = label ? `<span style="font-size:10px;color:#667eea;font-weight:500;">下一步: ${label}</span>` : '';
        }
    };

    // 步骤指示条重置（灰）
    for (let i = 0; i < 3; i++) {
        if (dots[i]) dots[i].style.background = '#e5e6eb';
    }
    setNextStep('标题');

    log('开始自动填写页2...');
    await new Promise(r => setTimeout(r, 500));

    // ---------- 步骤1：产品标题（逐字输入，最多 128 字符） ----------
    dots[0].style.background = '#667eea';
    setNextStep('主图');
    log('填写产品标题...');
    const title = (product.seo_title_en || product.seo_title || product.title_en || '').split('\n')[0].substring(0, 128);

    if (!title) {
        dots[0].style.background = '#ff4d4f';
        log('✗ SEO标题数据为空', 'error');
    } else {
        let ti = null;
        if (window.smartFind && typeof window.smartFind.find === 'function') {
            ti = window.smartFind.find('page2', 'titleInput');
        }
        if (!ti) {
            const titleSelectors = window.selectors && window.selectors.getList ?
                window.selectors.getList('page2', 'titleInput') :
                ['input#productTitle', 'input[name="title"]', '.title-input input'];
            ti = document.querySelector(titleSelectors.join(','));
        }
        if (ti) {
            await realClick(ti);
            await new Promise(r => setTimeout(r, 300));
            document.execCommand('selectAll', false, null);
            await new Promise(r => setTimeout(r, 50));
            for (const ch of String(title)) {
                document.execCommand('insertText', false, ch);
                await new Promise(r => setTimeout(r, 8));
            }
            ti.dispatchEvent(new Event('input', {bubbles: true}));
            ti.dispatchEvent(new Event('change', {bubbles: true}));
            dots[0].style.background = '#52c41a';
            log('✓ 标题填写完成', 'success');
        } else {
            dots[0].style.background = '#ff4d4f';
            log('✗ 未找到标题输入框 #productTitle', 'error');
        }
    }

    await new Promise(r => setTimeout(r, 400));

    // ---------- 步骤2：上传主图（CDP 注入，等待上传完成） ----------
    dots[1].style.background = '#667eea';
    setNextStep('类目');
    log('上传主图...');
    if (!IMAGE_DIR) await loadImageDir();
    if (!IMG_EXT) await loadImgExt();
    const imagePath = IMAGE_DIR + (IMAGE_DIR.includes('/') ? '/' : '\\') + 'row' + product.row + '_main.' + IMG_EXT;
    try {
        const resp = await chrome.runtime.sendMessage({
            action: 'uploadMainImage',
            pageType: 'page2',
            imagePath: imagePath
        });
        if (resp?.accepted) {
            log('⏳ 图片上传中，请稍候...', 'warn');
        } else {
            dots[1].style.background = '#ff4d4f';
            log('✗ 图片上传请求失败', 'error');
        }
    } catch (e) {
        dots[1].style.background = '#ff4d4f';
        log('✗ 图片上传失败: ' + e.message, 'error');
    }

    log('⏳ 等待图片上传完成...', 'warn');
    const uploadOk = await waitForImageUploadPage2(20000);
    if (uploadOk) {
        dots[1].style.background = '#52c41a';
        log('✓ 主图上传完成', 'success');
    } else {
        log('⚠️ 图片上传等待超时，继续下一步', 'warn');
    }

    // ---------- 步骤2.5：等待预测类目渲染 ----------
    log('⏳ 等待预测类目渲染...', 'warn');
    const predictOk = await waitForPredictCategoryRender(15000);
    if (predictOk) {
        log('✓ 预测类目已渲染', 'success');
    } else {
        log('⚠️ 预测类目等待超时，继续下一步', 'warn');
    }

    await new Promise(r => setTimeout(r, 800));

    // ---------- 步骤3：选择类目 ----------
    dots[2].style.background = '#667eea';
    setNextStep('');
    log('选择类目...');
    const catResult = await selectCategory(product.category);
    if (catResult.ok) {
        dots[2].style.background = '#52c41a';
        log('✓ 类目已选择: ' + catResult.name, 'success');
    } else {
        dots[2].style.background = '#ff4d4f';
        log('✗ 类目选择失败: ' + (catResult.error || '未知错误'), 'error');
    }

    log('=== 页2信息已填写完成 ===', 'success');
    
    // ---------- 批量模式：自动点发布跳页3 ----------
    const rowNum = getRowFromUrl();
    if (rowNum !== null) {
        log('🔄 批量模式：自动点击"我已阅读如上规则，现在发布产品"按钮...', 'success');
        await new Promise(r => setTimeout(r, 2000));
        
        let publishBtn = null;
        if (window.smartFind && typeof window.smartFind.findAll === 'function') {
            const btns = window.smartFind.findAll('page2', 'publishButton');
            publishBtn = btns.find(btn => {
                const txt = (btn.innerText || btn.textContent || '').trim();
                return txt.includes('我已阅读') || txt.includes('发布产品');
            });
        }
        if (!publishBtn) {
            const publishSelectors = window.selectors && window.selectors.getList ?
                window.selectors.getList('page2', 'publishButton') :
                ['button.next-btn-primary', '[class*="primary"]', 'button'];
            publishBtn = Array.from(document.querySelectorAll(publishSelectors.join(','))).find(btn => {
                const txt = (btn.innerText || btn.textContent || '').trim();
                return txt.includes('我已阅读') || txt.includes('发布产品');
            });
        }
        
        if (publishBtn) {
            publishBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
            await new Promise(r => setTimeout(r, 800));
            await realClick(publishBtn);
            log('✅ 已点击发布按钮，正在跳转页3...', 'success');
        } else {
            log('⚠️ 未找到发布按钮，请手动点击', 'warn');
        }
    } else {
        log('请确认主图上传成功后，点击底部按钮进入下一步', 'success');
    }
}

// 创建页2浮动面板（产品信息、步骤条、填表/上传按钮、格式切换、日志）
function createPage2Panel() {
    if (document.getElementById('polo-helper-panel')) return;

    const panel = document.createElement('div');
    panel.id = 'polo-helper-panel';
    panel.style.cssText = `
        position:fixed;top:60px;right:20px;z-index:99999;
        background:#fff;border-radius:14px;box-shadow:0 8px 40px rgba(0,0,0,0.18);
        width:380px;max-height:85vh;overflow-y:auto;
        font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;font-size:14px;
    `;

    panel.innerHTML = `
        <div style="background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);color:white;padding:12px 16px;display:flex;justify-content:space-between;align-items:center;">
            <h3 style="margin:0;font-size:15px;font-weight:600;">📦 Polo发品助手 (页2)</h3>
            <span id="polo-close" style="cursor:pointer;opacity:0.8;font-size:18px;padding:0 4px;">×</span>
        </div>
        <div style="padding:12px 16px;">
            <div id="polo-product-info" style="background:#f7f8fa;border-radius:8px;padding:10px;margin-bottom:12px;">
                <div style="color:#666;font-size:12px;margin-bottom:4px;">暂无产品数据</div>
                <div style="font-weight:500;color:#333;font-size:12px;">点击下方绿色按钮加载</div>
            </div>
            <div style="margin-bottom:4px;" id="polo-next-step"></div>
            <div style="display:flex;gap:4px;margin-bottom:4px;">
                <div class="step-dot" style="flex:1;height:6px;border-radius:3px;background:#e5e6eb;"></div>
                <div class="step-dot" style="flex:1;height:6px;border-radius:3px;background:#e5e6eb;"></div>
                <div class="step-dot" style="flex:1;height:6px;border-radius:3px;background:#e5e6eb;"></div>
            </div>
            <div style="display:flex;gap:4px;font-size:10px;color:#999;text-align:center;margin-bottom:12px;">
                <div style="flex:1;">标题</div>
                <div style="flex:1;">主图</div>
                <div style="flex:1;">类目</div>
            </div>
            <button id="polo-paste-btn" style="display:block;width:100%;padding:12px;border:none;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer;margin-bottom:8px;background:linear-gradient(135deg,#52c41a 0%,#389e0d 100%);color:white;box-shadow:0 2px 8px rgba(82,196,26,0.3);">
                📥 从剪贴板加载产品数据
            </button>
            <button id="polo-autofill-btn" disabled style="display:block;width:100%;padding:10px;border:none;border-radius:8px;font-size:14px;font-weight:500;cursor:pointer;margin-bottom:8px;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);color:white;opacity:0.5;cursor:not-allowed;">
                🚀 一键填入全部信息
            </button>
            <button id="polo-upload-img-btn" disabled style="display:block;width:100%;padding:10px;border:none;border-radius:8px;font-size:14px;font-weight:500;cursor:pointer;margin-bottom:8px;background:#f0f1f5;color:#333;">
                🖼️ 仅上传主图
            </button>
            <div style="display:flex;gap:6px;margin-bottom:8px;">
                <div style="flex:1;font-size:12px;color:#666;line-height:28px;">图片格式:</div>
                <button id="polo-ext-jpg" style="flex:1;padding:6px 8px;border:1px solid #52c41a;border-radius:6px;font-size:12px;font-weight:500;cursor:pointer;background:#52c41a;color:white;">JPG</button>
                <button id="polo-ext-png" style="flex:1;padding:6px 8px;border:1px solid #d9d9d9;border-radius:6px;font-size:12px;font-weight:500;cursor:pointer;background:white;color:#666;">PNG</button>
            </div>
            <div id="polo-log" style="background:#1e1e2e;color:#a6e3a1;padding:10px;border-radius:6px;font-family:monospace;font-size:11px;line-height:1.5;max-height:200px;overflow-y:auto;margin-top:8px;">
                <div style="color:#a6e3a1;">[系统] 发品助手已加载</div>
            </div>
        </div>
    `;

    document.body.appendChild(panel);

    document.getElementById('polo-close').onclick = () => panel.remove();

    // 一键填入：调用 autoFillPage2 全流程
    document.getElementById('polo-autofill-btn').onclick = async () => {
        if (!currentProduct) {
            log('没有产品数据！', 'error');
            return;
        }
        const btn = document.getElementById('polo-autofill-btn');
        btn.disabled = true;
        btn.style.opacity = '0.5';
        try {
            await autoFillPage2(currentProduct);
        } catch (e) {
            log('❌ 填入失败: ' + e.message, 'error');
        }
        btn.disabled = false;
        btn.style.opacity = '1';
    };

    // 仅上传主图按钮
    document.getElementById('polo-upload-img-btn').onclick = async () => {
        if (!currentProduct) {
            log('没有产品数据！', 'error');
            return;
        }
        if (!IMAGE_DIR) await loadImageDir();
        if (!IMG_EXT) await loadImgExt();
        const imagePath = IMAGE_DIR + (IMAGE_DIR.includes('/') ? '/' : '\\') + 'row' + currentProduct.row + '_main.' + IMG_EXT;
        log('开始上传主图: ' + imagePath);
        try {
            const resp = await chrome.runtime.sendMessage({
                action: 'uploadMainImage',
                pageType: 'page2',
                imagePath: imagePath
            });
            if (resp?.accepted) {
                log('⏳ 图片上传中，请稍候...', 'warn');
            }
        } catch (e) {
            log('✗ 上传失败: ' + e.message, 'error');
        }
    };

    // 图片格式按钮选中态切换（JPG/PNG 高亮）
    function updateExtButtons() {
        const btnJpg = document.getElementById('polo-ext-jpg');
        const btnPng = document.getElementById('polo-ext-png');
        if (IMG_EXT === 'jpg') {
            btnJpg.style.background = '#52c41a';
            btnJpg.style.borderColor = '#52c41a';
            btnJpg.style.color = 'white';
            btnPng.style.background = 'white';
            btnPng.style.borderColor = '#d9d9d9';
            btnPng.style.color = '#666';
        } else {
            btnPng.style.background = '#52c41a';
            btnPng.style.borderColor = '#52c41a';
            btnPng.style.color = 'white';
            btnJpg.style.background = 'white';
            btnJpg.style.borderColor = '#d9d9d9';
            btnJpg.style.color = '#666';
        }
    }

    loadImgExt().then(updateExtButtons);

    // 格式切换
    document.getElementById('polo-ext-jpg').onclick = () => {
        saveImgExt('jpg');
        updateExtButtons();
        log('图片格式切换为 JPG');
    };

    document.getElementById('polo-ext-png').onclick = () => {
        saveImgExt('png');
        updateExtButtons();
        log('图片格式切换为 PNG');
    };

    document.getElementById('polo-paste-btn').onclick = loadFromClipboard;

    // 接收 background 的上传结果与日志转发
    chrome.runtime.onMessage.addListener((request) => {
        if (request.action === 'uploadResult') {
            if (request.result?.ok) {
                log('✓ 主图上传成功！', 'success');
                const dots = document.querySelectorAll('.step-dot');
                if (dots[1]) dots[1].style.background = '#52c41a';
            } else {
                log('✗ 主图上传失败: ' + (request.result?.error || '未知错误'), 'error');
                const dots = document.querySelectorAll('.step-dot');
                if (dots[1]) dots[1].style.background = '#ff4d4f';
            }
        }
        if (request.action === 'log' && request.msg) {
            log(request.msg, 'warn');
        }
    });
}

// 从 URL 读取批量行号 row=N（无则返回 null）
function getRowFromUrl() {
    const params = new URLSearchParams(window.location.search);
    const row = params.get('row');
    return row ? parseInt(row, 10) : null;
}

// 批量模式：按行号从扩展存储加载产品数据，启动心跳后自动填表
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
            
            const stopHeartbeat = startHeartbeat(15000);
            log('💓 保活心跳已启动（每15秒）', 'info');
            
            await new Promise(r => setTimeout(r, 3000));
            
            try {
                log('🔄 批量模式：自动开始填写页2...', 'success');
                await autoFillPage2(currentProduct);
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

// 初始化：仅在顶层窗口执行；创建隐藏 file input 与面板；
// 批量模式（URL 带 row=）自动加载产品并启动跳转参数透传
function initPage2() {
    if (top !== self) return;
    createHiddenFileInput();
    createPage2Panel();

    const rowNum = getRowFromUrl();
    if (rowNum !== null) {
        log('📦 检测到批量发品模式，行' + rowNum + '，正在加载产品数据...', 'info');
        initStorageListener(true);
        loadBatchProduct(rowNum);
        setupNextStepRowPass(rowNum);
    } else {
        initStorageListener(false);
    }
}

// 批量模式参数透传：劫持 window.open / location.assign/replace/href /
// history.pushState/replaceState 与「下一步」按钮，为所有跳转 URL 追加 row=N
// （保证从页2跳页3时批量行号不丢失）
function setupNextStepRowPass(rowNum) {
    try { sessionStorage.setItem('polo_batch_row', rowNum); } catch(e) {}

    // 拦截「下一步/Next」按钮与 easyListing 链接的点击
    const interceptNextBtn = () => {
        const btns = document.querySelectorAll('button, .next-btn, [class*="next"], [class*="下一步"], a[href*="easyListing"]');
        for (const btn of btns) {
            const txt = (btn.innerText || btn.textContent || '').trim();
            if (txt.includes('下一步') || txt.includes('Next') || (btn.href && btn.href.includes('easyListing'))) {
                if (btn.dataset.rowBound) continue;
                btn.dataset.rowBound = '1';
                btn.addEventListener('click', (e) => {
                    try { sessionStorage.setItem('polo_batch_row', rowNum); } catch(_e) {}
                    if (btn.href && btn.href.includes('easyListing')) {
                        e.preventDefault();
                        const sep = btn.href.includes('?') ? '&' : '?';
                        window.location.href = btn.href + sep + 'row=' + rowNum;
                        return false;
                    }
                }, true);
            }
        }
    };
    interceptNextBtn();
    setInterval(interceptNextBtn, 2000);

    // 劫持 window.open
    const origOpen = window.open;
    window.open = function(url, ...args) {
        try { sessionStorage.setItem('polo_batch_row', rowNum); } catch(_e) {}
        if (url && (url.includes('easyListing') || url.includes('publish'))) {
            if (!url.includes('row=')) {
                const sep = url.includes('?') ? '&' : '?';
                url = url + sep + 'row=' + rowNum;
            }
        }
        return origOpen.call(this, url, ...args);
    };

    // 劫持 location.assign/replace/href（保留原始描述符）
    const origAssign = Object.getOwnPropertyDescriptor(Location.prototype, 'assign');
    const origReplace = Object.getOwnPropertyDescriptor(Location.prototype, 'replace');
    const origHref = Object.getOwnPropertyDescriptor(Location.prototype, 'href');

    // 为发品页 URL 追加 row 参数
    function appendRowToUrl(url) {
        try { sessionStorage.setItem('polo_batch_row', rowNum); } catch(_e) {}
        if (url && url.includes && (url.includes('easyListing') || url.includes('publish'))) {
            if (!url.includes('row=')) {
                const sep = url.includes('?') ? '&' : '?';
                url = url + sep + 'row=' + rowNum;
            }
        }
        return url;
    }

    if (origAssign && origAssign.value) {
        Object.defineProperty(location, 'assign', {
            configurable: true,
            value: function(url) {
                url = appendRowToUrl(url);
                return origAssign.value.call(this, url);
            }
        });
    }

    if (origReplace && origReplace.value) {
        Object.defineProperty(location, 'replace', {
            configurable: true,
            value: function(url) {
                url = appendRowToUrl(url);
                return origReplace.value.call(this, url);
            }
        });
    }

    if (origHref && origHref.set) {
        Object.defineProperty(location, 'href', {
            configurable: true,
            set: function(url) {
                url = appendRowToUrl(url);
                return origHref.set.call(this, url);
            },
            get: origHref.get
        });
    }

    // 劫持 history.pushState/replaceState
    const origPushState = History.prototype.pushState;
    const origReplaceState = History.prototype.replaceState;

    History.prototype.pushState = function(state, title, url) {
        if (url) {
            url = appendRowToUrl(url);
        }
        return origPushState.call(this, state, title, url);
    };

    History.prototype.replaceState = function(state, title, url) {
        if (url) {
            url = appendRowToUrl(url);
        }
        return origReplaceState.call(this, state, title, url);
    };

    window.addEventListener('popstate', () => {
        try { sessionStorage.setItem('polo_batch_row', rowNum); } catch(_e) {}
    });
}

// DOM 就绪后初始化
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPage2);
} else {
    initPage2();
}
