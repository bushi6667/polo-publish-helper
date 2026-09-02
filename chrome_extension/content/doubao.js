// ============================================================
// doubao.js —— 豆包 AI 换色/改图自动化执行器（注入 doubao.com 页面）
// 职责：在豆包网页上模拟真人操作完成「AI 换色」流程：
//   切换图像生成模式 → 上传图片 → 输入提示词 → 发送 → 轮询下载
//   4 张新图（white/black/gray/navy，无水印原图优先，见 doubao_raw.js）
// 通信：监听 background 的 startColorTask / startAiEditTask / getColorTaskStatus
// 注意：依赖豆包页面 DOM 结构（类名随站点改版可能变化）
// ============================================================
let colorTask = null;
let isProcessing = false;
let heartbeatTimer = null;

// 统一日志前缀
function log(msg, type = 'info') {
    console.log('[豆包AI换色]', msg);
}

// 心跳保活：防止 MV3 Service Worker 休眠导致 assistantPort 丢失
// 批量换色任务期间每 20 秒发一次心跳，任务结束后停止
function startHeartbeatForColorTask() {
    if (heartbeatTimer) return;
    heartbeatTimer = setInterval(() => {
        try {
            chrome.runtime.sendMessage({ action: 'heartbeat' }, () => {
                if (chrome.runtime.lastError) {
                    console.log('[豆包AI换色][心跳] SW未响应:', chrome.runtime.lastError.message);
                }
            });
        } catch (e) {}
    }, 20000);
    console.log('[豆包AI换色][心跳] 已启动（20s间隔）');
}

// 停止心跳
function stopHeartbeatForColorTask() {
    if (heartbeatTimer) {
        clearInterval(heartbeatTimer);
        heartbeatTimer = null;
        console.log('[豆包AI换色][心跳] 已停止');
    }
}

// 延时工具
function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
}

// 原生 value setter 设值 + input/change 事件（绕过 React 受控组件）
function setInputValue(el, val) {
    if (!el) return;
    const proto = Object.getPrototypeOf(el);
    const setter = proto?.value?.set;
    if (setter) {
        setter.call(el, val);
    } else {
        el.value = val;
    }
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
}

// 模拟真实鼠标点击（坐标中心 + mousedown/mouseup/click），失败降级 el.click()
function nativeMouseClick(el) {
    if (!el) return false;
    try {
        const rect = el.getBoundingClientRect();
        const x = rect.left + rect.width / 2;
        const y = rect.top + rect.height / 2;
        el.dispatchEvent(new MouseEvent('mousedown', {
            bubbles: true, cancelable: true, view: window,
            clientX: x, clientY: y, button: 0
        }));
        el.dispatchEvent(new MouseEvent('mouseup', {
            bubbles: true, cancelable: true, view: window,
            clientX: x, clientY: y, button: 0
        }));
        el.dispatchEvent(new MouseEvent('click', {
            bubbles: true, cancelable: true, view: window,
            clientX: x, clientY: y, button: 0
        }));
        return true;
    } catch (e) {
        try { el.click(); return true; } catch (_) { return false; }
    }
}

// 定位「图像生成」模式按钮（优先 data-skill-id，其次按文本模糊匹配）
function findImageGenButton() {
    const selectors = [
        'button[data-skill-id="skill_bar_button_3"]',
        'div[data-skill-id="skill_bar_button_3"]',
    ];
    for (const sel of selectors) {
        const el = document.querySelector(sel);
        if (el && el.offsetHeight > 0) return el;
    }
    const allBtns = document.querySelectorAll('button, div[role="button"]');
    for (const btn of allBtns) {
        const txt = (btn.innerText || '').trim();
        if ((txt.includes('图像生成') || txt.includes('图片生成')) && btn.offsetHeight > 0) {
            return btn;
        }
    }
    return null;
}

// 定位聊天输入框（textarea / contenteditable / role=textbox 多选择器）
function findChatInput() {
    const selectors = [
        'textarea',
        '[contenteditable="true"]',
        'div[role="textbox"]',
        '.chat-input textarea',
        '.input-box textarea',
    ];
    for (const sel of selectors) {
        const el = document.querySelector(sel);
        if (el && el.offsetHeight > 0) return el;
    }
    return null;
}

// 定位「发送」按钮（按文本精确/包含匹配）
function findSendButton() {
    const allBtns = document.querySelectorAll('button');
    for (const btn of allBtns) {
        const txt = (btn.innerText || '').trim();
        if ((txt === '发送' || txt.includes('发送')) && btn.offsetHeight > 0) {
            return btn;
        }
    }
    return null;
}

// 定位可见的 file input（用于 CDP 注入图片文件）
function findFileInput() {
    const inputs = document.querySelectorAll('input[type="file"]');
    for (const inp of inputs) {
        if (inp.offsetParent !== null || inp.style.display !== 'none') {
            return inp;
        }
    }
    return inputs[0] || null;
}

// 定位「上传图片」按钮（优先找含 file input 的按钮，其次用 file input 父元素）
function findUploadButton() {
    const allEls = document.querySelectorAll('button, div, span, label');
    for (const el of allEls) {
        const txt = (el.innerText || '').trim();
        if ((txt.includes('上传') || txt.includes('图片') || txt.includes('+')) && el.offsetHeight > 0) {
            const inp = el.querySelector('input[type="file"]');
            if (inp) return { btn: el, input: inp };
        }
    }
    const fileInp = findFileInput();
    if (fileInp) {
        return { btn: fileInp.parentElement, input: fileInp };
    }
    return null;
}

// 切换豆包到「图像生成」模式（点击图像生成按钮并等待渲染）
async function switchToImageGenMode() {
    log('切换到图像生成模式...');
    const btn = findImageGenButton();
    if (!btn) {
        log('未找到图像生成按钮', 'warn');
        return false;
    }
    nativeMouseClick(btn);
    await sleep(2000);
    log('已点击图像生成按钮');
    return true;
}

// 上传图片：发消息给 background，由其用 CDP 注入文件到豆包页面的 file input
async function uploadImage(imagePath) {
    log('上传图片: ' + imagePath);
    const resp = await chrome.runtime.sendMessage({
        action: 'doubaoUploadImage',
        imagePath: imagePath
    });
    if (resp?.ok) {
        log('图片上传请求已发送');
        await sleep(2000);
        return true;
    }
    log('图片上传失败: ' + (resp?.error || '未知错误'), 'error');
    return false;
}

// 在聊天输入框输入提示词（textarea 走原生 setter，contenteditable 直接 innerText）
async function typePrompt(prompt) {
    log('输入提示词...');
    const input = findChatInput();
    if (!input) {
        log('未找到输入框', 'error');
        return false;
    }

    input.focus();
    await sleep(200);

    if (input.tagName === 'TEXTAREA' || input.tagName === 'INPUT') {
        setInputValue(input, prompt);
    } else {
        input.innerText = prompt;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
    }

    await sleep(500);
    log('提示词已输入');
    return true;
}

// 发送消息：点发送按钮；找不到则用 execCommand 回车发送
async function sendMessage() {
    log('发送消息...');
    const sendBtn = findSendButton();
    if (sendBtn) {
        nativeMouseClick(sendBtn);
    } else {
        const input = findChatInput();
        if (input) {
            input.focus();
            document.execCommand('SelectAll');
            document.execCommand('insertText', false, '\n');
        }
    }
    await sleep(1000);
    log('消息已发送');
    return true;
}

// 无水印原图 URL 映射（hash -> image_raw URL，由 doubao_raw.js 捕获后经事件同步）
const rawUrlMap = new Map();

// 监听 doubao_raw.js（MAIN world）广播的原图捕获事件
document.addEventListener('_poloRawUrlUpdate', (e) => {
    rawUrlMap.set(e.detail.hash, e.detail.url);
});

// 从图片 URL 提取 hash（用于映射原图）
function getHashFromUrl(url) {
    if (!url) return null;
    const m = url.match(/([a-f0-9]{20,40})/i);
    return m ? m[1] : null;
}

// 取无水印原图 URL（有映射用原图，否则回退传入 src）
function getRawUrl(imgSrc) {
    const hash = getHashFromUrl(imgSrc);
    if (!hash) return imgSrc;
    const raw = rawUrlMap.get(hash);
    return raw || imgSrc;
}

// 收集页面内豆包 AI 消息里的全部 byteimg/tos-alistore 图片 URL（去重、优先原图）
function getAllImageUrls() {
    const urls = [];
    const seen = new Set();

    // 判断元素是否属于豆包 AI 消息（向上 10 层找消息容器类名；justify-end 为用户消息）
    function isDoubaoMessage(el) {
        let parent = el.parentElement;
        for (let i = 0; i < 10 && parent; i++) {
            const className = (parent.className || '').toString();
            if (className.includes('container-MzuYIN') || className.includes('container-dLabXv')) {
                return true;
            }
            if (className.includes('justify-end')) {
                return false;
            }
            parent = parent.parentElement;
        }
        return false;
    }

    document.querySelectorAll('img, source').forEach(el => {
        if (!isDoubaoMessage(el)) return;
        const src = el.getAttribute('src') || el.getAttribute('srcset') || el.getAttribute('data-src') || '';
        if (!src.includes('byteimg.com') && !src.includes('tos-alistore')) return;
        const hash = getHashFromUrl(src);
        if (!hash || seen.has(hash)) return;
        seen.add(hash);
        const rawUrl = getRawUrl(src);
        urls.push(rawUrl);
    });

    return urls;
}

// 获取最后一条消息的元信息（条数/文本/是否 AI/是否生成中），用于判断生成状态
function getLastMessageInfo() {
    const msgSelectors = [
        '.chat-message',
        '[class*="message-item"]',
        '[class*="msg-content"]',
        '[class*="message"]',
        '[class*="chat-item"]',
        '[class*="conversation-item"]',
        'div[data-message-id]',
        'div[data-testid*="message"]',
    ];
    let msgs = [];
    for (const sel of msgSelectors) {
        const found = document.querySelectorAll(sel);
        if (found.length > 0) { msgs = Array.from(found); break; }
    }
    if (msgs.length === 0) {
        return { count: 0, text: '', hasLoading: true, isAI: false };
    }
    const last = msgs[msgs.length - 1];
    const text = last.innerText || '';
    const html = last.innerHTML || '';
    const htmlLower = html.toLowerCase();
    const txtLower = text.toLowerCase();

    const classAttr = (last.getAttribute('class') || '').toLowerCase();
    const userKeywords = ['user', 'self', 'my-message', 'mine', 'sender-me'];
    const aiKeywords = ['assistant', 'model', 'ai-message', 'bot', 'agent', 'doubao', 'seedream', 'gpt'];
    const hasUserClass = userKeywords.some(k => classAttr.includes(k));
    const hasAiClass = aiKeywords.some(k => classAttr.includes(k));
    const isUser = hasUserClass && !hasAiClass;
    const isAI = !isUser;

    // 生成中判定：HTML 含 loading 类特征 或 文本含「生成中/思考中」等关键词
    const loadingHtml = ['loading', 'spinner', 'animate', 'skeleton', 'progress', 'pending']
        .some(k => htmlLower.includes(k));
    const loadingText = ['生成中', '思考中', '正在', '绘制中', '创作中']
        .some(k => txtLower.includes(k));
    const hasLoading = isAI && (loadingHtml || loadingText);

    return { count: msgs.length, text: text.slice(0, 120), hasLoading, isAI, isUser };
}

// 纯字符串判定：给定最后一条消息的文本与其是否 AI/是否生成中，判断是否为"生成失败/被拒"类消息
// 关键词越保守越好，避免误判正在生成的正常消息；AI 且未在生成中才可能判定为错误
function isGenerationErrorText(text, isAI, hasLoading) {
    if (!isAI || hasLoading) return false;
    const txt = (text || '').toLowerCase();
    const cnErr = ['生成失败', '出错了', '无法生成', '生成不了', '对不起', '抱歉', '未能', '失败了', '不可用', '被拒绝', '不被允许', '请重新'];
    const enErr = ['failed', 'error', 'sorry', 'could not', 'unable to', 'cannot generate', 'is not allowed'];
    return cnErr.some(k => txt.includes(k)) || enErr.some(k => txt.includes(k));
}

// 判断豆包是否返回了"生成失败/内容被拒"类错误消息，用于在轮询中提前中止，避免干等超时
function isGenerationError() {
    const info = getLastMessageInfo();
    return isGenerationErrorText(info.text, info.isAI, info.hasLoading);
}

// 轮询等待图片生成完成：以现有图为基准，检测到 >= minImages 张新图即返回；
// 超时（默认 10 分钟）返回已检测到的新图（可能不足）
async function waitForGenerationComplete(timeout = 600000, minImages = 4) {
    log(`等待图片生成完成（最多${Math.round(timeout/60000)}分钟，至少${minImages}张）...`);

    const existingUrls = getAllImageUrls();
    const existingSet = new Set(existingUrls);
    log(`已有图片 ${existingUrls.length} 张作为基准`);
    log(`💡 提示：如果只显示 ${minImages-1} 张，请手动向上/向下滚动显示第 ${minImages} 张`);

    const startTime = Date.now();
    let lastImageCount = existingUrls.length;

    while (Date.now() - startTime < timeout) {
        await sleep(2000);
        const elapsed = Math.floor((Date.now() - startTime) / 1000);

        const currentUrls = getAllImageUrls();
        const currentCount = currentUrls.length;
        const newUrls = currentUrls.filter(u => !existingSet.has(u));

        if (currentCount > lastImageCount) {
            log(`[${elapsed}s] 图片增加: ${lastImageCount} → ${currentCount} (新图${newUrls.length}张)`);
            lastImageCount = currentCount;
        }

        if (newUrls.length >= minImages) {
            log(`✨ 检测到 ${newUrls.length} 张新图，满足要求`);
            await sleep(1500);
            return getAllImageUrls().filter(u => !existingSet.has(u));
        }

        if (elapsed % 15 === 0 && elapsed > 0) {
            log(`[${elapsed}s] 当前新图 ${newUrls.length}/${minImages} 张，请手动滚动显示更多`);
        }
    }

    log('⚠️ 等待超时', 'warn');
    const finalUrls = getAllImageUrls();
    const finalNew = finalUrls.filter(u => !existingSet.has(u));

    if (finalNew.length >= minImages) {
        log(`✅ 超时后检测到 ${finalNew.length} 张新图`);
        return finalNew;
    }

    log(`❌ 超时，只检测到 ${finalNew.length} 张新图`, 'error');
    return finalNew;
}

// 增量下载新图：按 white/black/gray/navy 顺序命名 row{rowNum}_{color}.png，
// 逐张发 downloadDoubaoImage 消息让 background 下载（自动建子文件夹）
async function downloadImagesIncremental(rowNum, timeout = 600000, totalImages = 4) {
    log(`等待 ${totalImages} 张图片出现（最多${Math.round(timeout/60000)}分钟）...`);

    const colorNames = ['white', 'black', 'gray', 'navy'];
    const existingUrls = new Set(getAllImageUrls());
    log(`已有 ${existingUrls.size} 张图片作为基准，已捕获无水印原图 ${rawUrlMap.size} 张`);
    log(`💡 提示：如果只显示 ${totalImages-1} 张，请手动向上/向下滚动显示第 ${totalImages} 张`);

    const startTime = Date.now();
    let allNewUrls = [];
    let lastImageCount = 0;

    while (Date.now() - startTime < timeout) {
        await sleep(2000);
        const elapsed = Math.floor((Date.now() - startTime) / 1000);

        // 生成被拒/失败时提前中止，避免把 10 分钟白白耗在等待上（清晰报告给调用方）
        if (isGenerationError()) {
            log('⚠️ 检测到豆包返回错误消息，生成失败，提前结束', 'warn');
            break;
        }

        const currentUrls = getAllImageUrls();
        const newUrls = currentUrls.filter(u => {
            const h = getHashFromUrl(u);
            return h && !existingUrls.has(u);
        });

        if (newUrls.length > lastImageCount) {
            lastImageCount = newUrls.length;
            log(`[${elapsed}s] 图片增加: ${lastImageCount} 张`);
        }

        if (newUrls.length >= totalImages) {
            allNewUrls = newUrls.slice(0, totalImages);
            log(`✅ 检测到 ${allNewUrls.length} 张新图 (已达到目标 ${totalImages} 张)`);
            break;
        }

        if (elapsed % 15 === 0 && elapsed > 0) {
            log(`[${elapsed}s] 当前新图 ${newUrls.length}/${totalImages} 张，请手动滚动显示更多`);
        }
    }

    const downloads = [];

    if (allNewUrls.length === 0) {
        log('⚠️ 超时，未检测到足够新图', 'warn');
        return downloads;
    }

    log(`开始一次性下载 ${allNewUrls.length} 张图...`);

    for (let i = 0; i < allNewUrls.length; i++) {
        const url = allNewUrls[i];
        const colorName = colorNames[i] || `color${i + 1}`;
        const filename = `row${rowNum}_${colorName}.png`;
        const hash = getHashFromUrl(url);
        const isRaw = rawUrlMap.has(hash);

        try {
            // 通过 Service Worker 下载（支持自动建子文件夹）
            const resp = await chrome.runtime.sendMessage({
                action: 'downloadDoubaoImage',
                url: url,
                filename: filename,
                rowNum: rowNum
            });
            if (resp?.ok) {
                downloads.push({ color: colorName, filename, ok: true, isRaw });
                log(`  ✓ ${i + 1}/${allNewUrls.length}: ${colorName} (${isRaw ? '无水印原图' : '水印图'}) → ${filename}`);
            } else {
                downloads.push({ color: colorName, filename, ok: false, error: resp?.error });
                log(`  ✗ ${colorName} 下载触发失败: ${resp?.error || '未知'}`, 'error');
            }
        } catch (e) {
            downloads.push({ color: colorName, filename, ok: false, error: e.message });
            log(`  ✗ ${colorName} 下载异常: ${e.message}`, 'error');
        }
    }

    const rawCount = downloads.filter(d => d.isRaw).length;
    log(`下载任务结束: 成功 ${downloads.filter(d => d.ok).length}/${downloads.length}，其中无水印 ${rawCount} 张`);
    return downloads;
}

// AI 换色主流程：切换模式 → 上传图 → 输提示词 → 发送 → 增量下载 4 张新图；
// 结束后发 colorTaskComplete 通知 background 并写回结果
async function runColorTask(task) {
    if (isProcessing) {
        log('已有任务进行中，跳过', 'warn');
        return;
    }
    isProcessing = true;
    colorTask = task;
    // 启动心跳，防止批量换色期间 SW 休眠丢失通知通道
    startHeartbeatForColorTask();

    const { imagePath, prompt, rowNum } = task;
    const results = { success: false, step: '', images: [], downloads: [] };

    try {
        results.step = '切换图像生成模式';
        const switched = await switchToImageGenMode();
        if (!switched) {
            throw new Error('未找到"图像生成"模式按钮，请确认豆包页面已就绪');
        }
        await sleep(1000);

        results.step = '上传图片';
        const uploaded = await uploadImage(imagePath);
        if (!uploaded) {
            throw new Error('图片上传失败，任务中止');
        }
        await sleep(2000);

        results.step = '输入提示词';
        await typePrompt(prompt);
        await sleep(500);

        results.step = '发送消息';
        await sendMessage();

        results.step = '逐张下载';
        const downloads = await downloadImagesIncremental(rowNum, 600000, 4);
        results.downloads = downloads;
        results.success = downloads.filter(d => d.ok).length > 0;
        results.images = downloads.map(d => d.filename);

    } catch (e) {
        log('任务失败: ' + e.message, 'error');
        results.error = e.message;
    }

    isProcessing = false;
    // 任务完成后停止心跳
    stopHeartbeatForColorTask();

    chrome.runtime.sendMessage({
        action: 'colorTaskComplete',
        results: results,
        rowNum: rowNum
    }).catch(() => {});

    return results;
}

// 消息入口：startColorTask 触发换色流程；startAiEditTask 触发改图；
// getColorTaskStatus 查询任务状态
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'startColorTask') {
        runColorTask(request.task);
        sendResponse({ ok: true, accepted: true });
        return true;
    }
    if (request.action === 'startAiEditTask') {
        runAiEditTask(request.task);
        sendResponse({ ok: true, accepted: true });
        return true;
    }
    if (request.action === 'getColorTaskStatus') {
        sendResponse({ ok: true, isProcessing, task: colorTask });
        return true;
    }
});

// AI 改图变体：切换模式 + 上传图片 + 输提示词，但【不自动发送】，
// 等用户手动编辑提示词后自己发送
async function runAiEditTask(task) {
    if (isProcessing) {
        log('已有任务在处理中，跳过', 'warn');
        return;
    }
    isProcessing = true;
    colorTask = task;

    log('开始AI改图任务: ' + JSON.stringify(task));

    try {
        // 切换到图像生成模式
        const switched = await switchToImageGenMode();
        if (!switched) {
            log('切换模式失败，尝试直接上传', 'warn');
        }

        // 上传图片
        const uploaded = await uploadImage(task.imagePath);
        if (!uploaded) {
            log('图片上传失败', 'error');
            isProcessing = false;
            return;
        }

        // 输入提示词（但不自动发送，让用户自己编辑）
        await typePrompt(task.prompt);

        log('AI改图任务准备完成，等待用户编辑并发送');
        showToast('✅ 图片已上传，请编辑提示词后发送');

    } catch (e) {
        log('AI改图任务出错: ' + e.message, 'error');
    }

    isProcessing = false;
}

// 页面顶部居中 toast 提示
function showToast(msg) {
    const toast = document.createElement('div');
    toast.style.cssText = 'position:fixed;top:20px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,0.8);color:#fff;padding:10px 20px;border-radius:8px;font-size:14px;z-index:99999;';
    toast.textContent = msg;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

log('豆包AI换色脚本已加载');
