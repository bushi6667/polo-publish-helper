// ============================================================
// 豆包无水印原图 URL 捕获器（MAIN world，document_start 注入）
// 为什么必须在 MAIN world：content script 默认在 ISOLATED world，
// 看不到页面自身 JS 里的 window.fetch/XMLHttpRequest/WebSocket 属性；
// 只有 MAIN world + 赶在页面脚本之前（document_start）才能 patch 到
// 豆包页面真正使用的网络 API，读取接口返回 JSON 中的 image_raw 原图 URL。
// 捕获结果存入 window.__poloRawUrls（Map: hash -> URL），并通过
// '_poloRawUrlUpdate' 自定义事件广播给 doubao.js（ISOLATED world）使用。
// 原图 URL 比页面显示的水印图多 image_raw 参数，下载后无水印。
// ============================================================

// 防重复注入（页面重载/脚本重执行时跳过）
if (window.__poloRawInterceptorInited) {
    console.log('[发品助手] 拦截器已存在，跳过重复注入');
} else {
    window.__poloRawInterceptorInited = true;

// 原图 URL 缓存：hash（URL 中的十六进制片段）-> 完整 image_raw URL
window.__poloRawUrls = new Map();

// 从网络响应文本中提取 image_raw 原图 URL
// 匹配 byteimg.com 且含 image_raw 参数的 URL，去转义后按 hash 去重，
// 新 URL 触发 '_poloRawUrlUpdate' 事件通知 doubao.js
function extractRawFromText(text) {
    if (!text || typeof text !== 'string') return;
    if (!text.includes('image_raw') || !text.includes('byteimg')) return;
    const regex = /https?:\/\/[^"'\s<>\\\)]+byteimg\.com[^"'\s<>\\\)]+image_raw[^"'\s<>\\\)]*/gi;
    let m;
    while ((m = regex.exec(text)) !== null) {
        const url = m[0].replace(/\\u002F/g, '/').replace(/\\\//g, '/').replace(/&amp;/g, '&');
        const hashMatch = url.match(/([a-f0-9]{20,40})/i);
        if (hashMatch && !window.__poloRawUrls.has(hashMatch[1])) {
            window.__poloRawUrls.set(hashMatch[1], url);
            console.log('[发品助手] 捕获 image_raw: ' + hashMatch[1].slice(0, 8));
            document.dispatchEvent(new CustomEvent('_poloRawUrlUpdate', {
                detail: { hash: hashMatch[1], url }
            }));
        }
    }
}

// 拦截 1：fetch —— clone 响应读取文本扫描原图 URL，不阻塞原响应
const origFetch = window.fetch;
window.fetch = async function(...args) {
    const resp = await origFetch.apply(this, args);
    try {
        const clone = resp.clone();
        const text = await clone.text();
        extractRawFromText(text);
    } catch(e) {}
    return resp;
};

// 拦截 2：XMLHttpRequest —— 在 load 事件后扫描 responseText
const origOpen = XMLHttpRequest.prototype.open;
XMLHttpRequest.prototype.open = function(method, url) {
    this.addEventListener('load', function() {
        try {
            extractRawFromText(this.responseText);
        } catch(e) {}
    });
    return origOpen.apply(this, arguments);
};

// 拦截 3：WebSocket —— 扫描文本消息；保留原型链与状态常量
try {
    const origWS = window.WebSocket;
    window.WebSocket = function(url, protocols) {
        const ws = new origWS(url, protocols);
        ws.addEventListener('message', function(event) {
            try {
                const data = typeof event.data === 'string' ? event.data : '';
                extractRawFromText(data);
            } catch(e) {}
        });
        return ws;
    };
    window.WebSocket.prototype = origWS.prototype;
    window.WebSocket.CONNECTING = origWS.CONNECTING;
    window.WebSocket.OPEN = origWS.OPEN;
    window.WebSocket.CLOSING = origWS.CLOSING;
    window.WebSocket.CLOSED = origWS.CLOSED;
} catch(e) {
    console.log('[发品助手] WebSocket 拦截失败:', e.message);
}

// 兜底：每 3s 扫描页面 script 标签文本（部分接口数据内联在脚本中）
setInterval(() => {
    document.querySelectorAll('script').forEach(script => {
        try {
            extractRawFromText(script.textContent || '');
        } catch(e) {}
    });
}, 3000);

console.log('[发品助手] 无水印图拦截器已启动（fetch + XHR + WebSocket）');

}
