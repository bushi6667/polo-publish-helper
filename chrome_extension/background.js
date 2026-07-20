importScripts('upload/page2_upload.js', 'upload/page3_upload.js');

const STORAGE_KEY = 'polo_product_data';
const IMAGE_DIR_KEY = 'polo_image_dir';
const COLOR_IMG_DIR_KEY = 'polo_color_img_dir';
const PUBLISH_QUEUE_KEY = 'polo_publish_queue';
const PENDING_COLOR_TASK_KEY = 'polo_pending_color_task';
const DOUBAO_TAB_ID_KEY = 'polo_doubao_tab_id';

let IMAGE_DIR = '';
let COLOR_IMG_DIR = '';
let CURRENT_FILENAME = '';
const DOUBAO_URL = 'https://www.doubao.com/chat';

let assistantTabId = null;
let assistantPort = null;

let publishQueue = [];
let isProcessingQueue = false;

async function ensureConfigLoaded() {
    return new Promise((resolve) => {
        chrome.storage.local.get([IMAGE_DIR_KEY, COLOR_IMG_DIR_KEY, 'current_filename', PUBLISH_QUEUE_KEY], (result) => {
            if (result[IMAGE_DIR_KEY]) IMAGE_DIR = result[IMAGE_DIR_KEY];
            if (result[COLOR_IMG_DIR_KEY]) COLOR_IMG_DIR = result[COLOR_IMG_DIR_KEY];
            if (result['current_filename']) CURRENT_FILENAME = result['current_filename'];
            if (result[PUBLISH_QUEUE_KEY] && Array.isArray(result[PUBLISH_QUEUE_KEY])) {
                publishQueue = result[PUBLISH_QUEUE_KEY];
            }
            resolve();
        });
    });
}

async function savePublishQueue() {
    return new Promise((resolve) => {
        chrome.storage.local.set({ [PUBLISH_QUEUE_KEY]: publishQueue }, resolve);
    });
}

async function savePendingColorTask(task) {
    return new Promise((resolve) => {
        if (task) {
            chrome.storage.local.set({ [PENDING_COLOR_TASK_KEY]: task }, resolve);
        } else {
            chrome.storage.local.remove(PENDING_COLOR_TASK_KEY, resolve);
        }
    });
}

async function getPendingColorTask() {
    return new Promise((resolve) => {
        chrome.storage.local.get(PENDING_COLOR_TASK_KEY, (result) => {
            resolve(result[PENDING_COLOR_TASK_KEY] || null);
        });
    });
}

async function saveDoubaoTabId(tabId) {
    return new Promise((resolve) => {
        if (tabId) {
            chrome.storage.local.set({ [DOUBAO_TAB_ID_KEY]: tabId }, resolve);
        } else {
            chrome.storage.local.remove(DOUBAO_TAB_ID_KEY, resolve);
        }
    });
}

async function getDoubaoTabId() {
    return new Promise((resolve) => {
        chrome.storage.local.get(DOUBAO_TAB_ID_KEY, (result) => {
            resolve(result[DOUBAO_TAB_ID_KEY] || null);
        });
    });
}

async function openPublishTab(rowNum) {
    const baseUrl = 'https://post.alibaba.com/product/easyListing.htm?spm=a2700.micro_product_manager.0.0.40e03e5fPaTwSu';
    const url = baseUrl + '&row=' + rowNum;
    await chrome.tabs.create({ url });
    console.log(`🆕 已打开第${rowNum}行产品发品页面`);
}

async function processPublishQueue() {
    await ensureConfigLoaded();
    if (isProcessingQueue || publishQueue.length === 0) return;
    isProcessingQueue = true;
    
    const rowNum = publishQueue[0];
    await openPublishTab(rowNum);
    
    isProcessingQueue = false;
}

async function advancePublishQueue() {
    await ensureConfigLoaded();
    if (publishQueue.length === 0) return;
    
    publishQueue.shift();
    await savePublishQueue();
    
    if (publishQueue.length > 0) {
        console.log(`📋 队列剩余 ${publishQueue.length} 个，下一个: row${publishQueue[0]}`);
        await processPublishQueue();
    } else {
        console.log('🎉 批量发品队列已全部处理完毕');
    }
}

async function realClickCDP(tabId, x, y) {
    try {
        try {
            await chrome.debugger.attach({ tabId }, '1.3');
        } catch (e) {
            if (!e.message.includes('already attached')) {
                throw e;
            }
        }
        await chrome.debugger.sendCommand({ tabId }, 'Input.dispatchMouseEvent', {
            type: 'mouseMoved',
            x, y,
            button: 'none',
            clickCount: 0
        });
        await new Promise(r => setTimeout(r, 30));
        await chrome.debugger.sendCommand({ tabId }, 'Input.dispatchMouseEvent', {
            type: 'mousePressed',
            x, y,
            button: 'left',
            clickCount: 1
        });
        await new Promise(r => setTimeout(r, 60));
        await chrome.debugger.sendCommand({ tabId }, 'Input.dispatchMouseEvent', {
            type: 'mouseReleased',
            x, y,
            button: 'left',
            clickCount: 1
        });
        await new Promise(r => setTimeout(r, 30));
        return { ok: true };
    } catch (e) {
        return { ok: false, error: e.message };
    }
}

let doubaoTabId = null;
let pendingColorTask = null;
let pendingAiEditTask = null;

const IDB_NAME = 'PoloColorImages';
const IDB_STORE = 'images';
const IDB_VERSION = 1;

function openIDB() {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(IDB_NAME, IDB_VERSION);
        req.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains(IDB_STORE)) {
                db.createObjectStore(IDB_STORE);
            }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

async function saveColorImageToIDB(key, dataUrl) {
    try {
        const db = await openIDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(IDB_STORE, 'readwrite');
            tx.objectStore(IDB_STORE).put(dataUrl, key);
            tx.oncomplete = () => { db.close(); resolve(true); };
            tx.onerror = () => { db.close(); reject(tx.error); };
        });
    } catch (e) {
        console.warn('IndexedDB 写入失败:', e.message);
        return false;
    }
}

async function getColorImageFromIDB(key) {
    try {
        const db = await openIDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(IDB_STORE, 'readonly');
            const req = tx.objectStore(IDB_STORE).get(key);
            req.onsuccess = () => { db.close(); resolve(req.result || null); };
            req.onerror = () => { db.close(); reject(req.error); };
        });
    } catch (e) {
        console.warn('IndexedDB 读取失败:', e.message);
        return null;
    }
}

function colorImageIDBKey(filename, rowNum, color) {
    const safeFn = (filename || '').replace(/[^a-zA-Z0-9]/g, '_');
    return safeFn + '__row' + rowNum + '__' + color;
}

chrome.storage.local.get([IMAGE_DIR_KEY, COLOR_IMG_DIR_KEY, 'current_filename'], (result) => {
    if (result[IMAGE_DIR_KEY]) IMAGE_DIR = result[IMAGE_DIR_KEY];
    if (result[COLOR_IMG_DIR_KEY]) COLOR_IMG_DIR = result[COLOR_IMG_DIR_KEY];
    if (result['current_filename']) CURRENT_FILENAME = result['current_filename'];
    console.log('📂 启动加载配置:', { IMAGE_DIR, COLOR_IMG_DIR, CURRENT_FILENAME });
});

function getFilePrefix() {
    const prefix = CURRENT_FILENAME ? CURRENT_FILENAME.replace(/[^a-zA-Z0-9]/g, '_') + '__' : '';
    console.log(`🔍 [getFilePrefix] CURRENT_FILENAME=${CURRENT_FILENAME}, prefix=${prefix}`);
    return prefix;
}

function colorKey(rowNum) {
    return getFilePrefix() + 'color__' + rowNum;
}

function uploadedKey() {
    return getFilePrefix() + 'uploaded';
}

function productKey() {
    return getFilePrefix() + 'product';
}



function buildColorImagePath(rowNum, color) {
    let base = COLOR_IMG_DIR;
    if (!base) {
        base = 'D:\\下载\\gg';
    }
    const sep = base.includes('/') ? '/' : '\\';
    const dir = base.endsWith('\\') || base.endsWith('/')
        ? base.slice(0, -1)
        : base;
    const hasSubDir = dir.includes('Polo发品_颜色图');
    const fileFolder = CURRENT_FILENAME || '默认';
    let path;
    if (hasSubDir) {
        path = dir + sep + fileFolder + sep + 'row' + rowNum + sep + 'row' + rowNum + '_' + color + '.png';
    } else {
        path = dir + sep + 'Polo发品_颜色图' + sep + fileFolder + sep + 'row' + rowNum + sep + 'row' + rowNum + '_' + color + '.png';
    }
    console.log(`🔍 [buildColorImagePath] 生成路径: ${path}, base=${base}, hasSubDir=${hasSubDir}, fileFolder=${fileFolder}`);
    return path;
}

function getColorImagePathData(rowNum, color, callback) {
    const storageKey = colorKey(rowNum);
    console.log(`🔍 [getColorImagePathData] row=${rowNum}, color=${color}, COLOR_IMG_DIR=${COLOR_IMG_DIR}, CURRENT_FILENAME=${CURRENT_FILENAME}, storageKey=${storageKey}`);
    chrome.storage.local.get(storageKey, (result) => {
        let images = result[storageKey] || {};
        if (Object.keys(images).length === 0) {
            const legacyKey = 'color_images_row_' + rowNum;
            chrome.storage.local.get(legacyKey, (legacyResult) => {
                const legacyImages = legacyResult[legacyKey] || {};
                if (Object.keys(legacyImages).length > 0) {
                    chrome.storage.local.set({ [storageKey]: legacyImages }, () => {
                        chrome.storage.local.remove(legacyKey);
                        console.log(`🔄 已迁移颜色图数据: ${legacyKey} → ${storageKey}`);
                    });
                    images = legacyImages;
                }
                const imgData = images[color];
                const url = typeof imgData === 'string' ? imgData : (imgData?.url || null);
                let path = null;
                if (COLOR_IMG_DIR) {
                    path = buildColorImagePath(rowNum, color);
                    console.log(`🔍 [getColorImagePathData] storage空，用COLOR_IMG_DIR拼路径: ${path}`);
                } else {
                    path = typeof imgData === 'string' ? null : (imgData?.path || null);
                    console.log(`🔍 [getColorImagePathData] storage空，COLOR_IMG_DIR也空，path=${path}`);
                }
                const resultData = { ok: true, path, url };
                console.log(`🔍 [getColorImagePathData] 准备调用callback: ${JSON.stringify(resultData)}`);
                try {
                    callback(resultData);
                    console.log(`✅ [getColorImagePathData] callback调用成功`);
                } catch (e) {
                    console.error(`❌ [getColorImagePathData] callback调用失败: ${e.message}`);
                }
            });
        } else {
            try {
                const imgData = images[color];
                console.log(`🔍 [getColorImagePathData] imgData类型: ${typeof imgData}, 值: ${JSON.stringify(imgData)}`);
                const url = typeof imgData === 'string' ? imgData : (imgData?.url || null);
                console.log(`🔍 [getColorImagePathData] url: ${url}`);
                let path = null;
                if (COLOR_IMG_DIR) {
                    path = buildColorImagePath(rowNum, color);
                    console.log(`🔍 [getColorImagePathData] storage有数据，用COLOR_IMG_DIR拼路径: ${path}`);
                } else {
                    path = typeof imgData === 'string' ? null : (imgData?.path || null);
                    console.log(`🔍 [getColorImagePathData] storage有数据但COLOR_IMG_DIR空，path=${path}`);
                }
                const resultData = { ok: true, path, url };
                console.log(`🔍 [getColorImagePathData] 准备调用callback: ${JSON.stringify(resultData)}`);
                callback(resultData);
                console.log(`✅ [getColorImagePathData] callback调用成功`);
            } catch (e) {
                console.error(`❌ [getColorImagePathData] storage有数据分支异常: ${e.message}`);
                console.error(e.stack);
                callback({ ok: false, error: e.message });
            }
        }
    });
}

chrome.runtime.onInstalled.addListener(() => {
    console.log('✅ Polo发品助手扩展已安装');
    ensureConfigLoaded().then(() => {
        console.log('📂 启动配置已加载:', { IMAGE_DIR, COLOR_IMG_DIR, CURRENT_FILENAME });
    });
});

chrome.runtime.onStartup.addListener(() => {
    ensureConfigLoaded();
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.url && (tab.url.includes('doubao.com') || tab.url.includes('www.doubao.com'))) {
        console.log('🌐 豆包页面加载完成:', tabId);
        doubaoTabId = tabId;
        await saveDoubaoTabId(tabId);
        
        const pendingTask = await getPendingColorTask();
        if (pendingTask) {
            console.log('📤 发送待处理的换色任务（从storage恢复）');
            setTimeout(async () => {
                sendStartColorTask(tabId, pendingTask);
                await savePendingColorTask(null);
            }, 2000);
        }
    }
});

async function handleSharedAction(request, sendResponse) {
    if (request.action === 'saveProductData') {
        const pKey = productKey();
        const setObj = { [pKey]: request.data };
        setObj[STORAGE_KEY] = request.data;
        chrome.storage.local.set(setObj, () => {
            sendResponse({ ok: true });
        });
        if (request.imageDir) {
            IMAGE_DIR = request.imageDir;
            chrome.storage.local.set({ [IMAGE_DIR_KEY]: request.imageDir });
            console.log('📂 图片目录已更新:', request.imageDir);
        }
        if (request.colorImgDir && !COLOR_IMG_DIR) {
            COLOR_IMG_DIR = request.colorImgDir;
            chrome.storage.local.set({ [COLOR_IMG_DIR_KEY]: request.colorImgDir });
            console.log('🖼️ 颜色图目录已初始化（来自页1）:', request.colorImgDir);
        } else if (request.colorImgDir && COLOR_IMG_DIR) {
            console.log('🖼️ 颜色图目录已由popup设置，忽略页1传入值。当前:', COLOR_IMG_DIR, '，页1传入:', request.colorImgDir);
        } else if (IMAGE_DIR && !COLOR_IMG_DIR) {
            const baseDir = IMAGE_DIR.replace(/[/\\]extracted_images$/, '');
            if (baseDir && baseDir !== IMAGE_DIR) {
                COLOR_IMG_DIR = baseDir;
                chrome.storage.local.set({ [COLOR_IMG_DIR_KEY]: baseDir });
                console.log('🖼️ 颜色图目录已自动设置:', baseDir);
            }
        }
        return true;
    }
    if (request.action === 'saveBatchProducts') {
        const products = request.products || [];
        const setObj = {};
        const prefix = getFilePrefix();
        for (const p of products) {
            if (p && p.row !== undefined) {
                const key = prefix + 'product__row' + p.row;
                setObj[key] = p;
            }
        }
        if (request.imageDir) {
            IMAGE_DIR = request.imageDir;
            setObj[IMAGE_DIR_KEY] = request.imageDir;
            console.log('📂 图片目录已更新:', request.imageDir);
        }
        if (request.colorImgDir && !COLOR_IMG_DIR) {
            COLOR_IMG_DIR = request.colorImgDir;
            setObj[COLOR_IMG_DIR_KEY] = request.colorImgDir;
            console.log('🖼️ 颜色图目录已初始化（来自批量发品）:', request.colorImgDir);
        } else if (request.colorImgDir && COLOR_IMG_DIR) {
            console.log('🖼️ 颜色图目录已由popup设置，忽略批量发品传入值。当前:', COLOR_IMG_DIR, '，批量传入:', request.colorImgDir);
        }
        chrome.storage.local.set(setObj, () => {
            console.log(`📦 已保存 ${products.length} 个产品数据`);
            sendResponse({ ok: true, count: products.length });
        });
        return true;
    }
    if (request.action === 'getProductByRow') {
        const rowNum = request.rowNum;
        const prefix = getFilePrefix();
        const key = prefix + 'product__row' + rowNum;
        chrome.storage.local.get(key, (result) => {
            const product = result[key] || null;
            if (product) {
                console.log(`📦 获取产品数据: row=${rowNum}, title=${product.seo_title_en || product.title_en || '无标题'}`);
            } else {
                console.log(`⚠️ 未找到产品数据: row=${rowNum}`);
            }
            sendResponse({ ok: !!product, data: product });
        });
        return true;
    }
    if (request.action === 'openPublishPage') {
        chrome.tabs.create({
            url: 'https://post.alibaba.com/product/easyListing.htm?spm=a2700.micro_product_manager.0.0.40e03e5fPaTwSu'
        });
        sendResponse({ ok: true });
        return true;
    }
    if (request.action === 'openBatchPublish') {
        const rows = request.rows || [];
        if (rows.length === 0) {
            sendResponse({ ok: true, count: 0 });
            return true;
        }
        
        await ensureConfigLoaded();
        publishQueue = [...rows];
        await savePublishQueue();
        console.log(`📋 批量发品队列已创建，共${publishQueue.length}个产品: ${publishQueue.join(', ')}`);
        
        await processPublishQueue();
        
        sendResponse({ ok: true, count: rows.length, queue: publishQueue });
        return true;
    }
    if (request.action === 'publishCompleted') {
        const rowNum = request.rowNum;
        console.log(`✅ 收到第${rowNum}行产品保存完成通知`);
        
        await advancePublishQueue();
        
        sendResponse({ ok: true, remaining: publishQueue.length });
        return true;
    }
    if (request.action === 'markUploaded') {
        const row = request.row;
        const key = uploadedKey();
        chrome.storage.local.get(key, (result) => {
            const uploaded = result[key] || {};
            uploaded[row] = true;
            chrome.storage.local.set({ [key]: uploaded }, () => {
                sendResponse({ ok: true });
            });
        });
        return true;
    }
    if (request.action === 'getUploadedRows') {
        const key = uploadedKey();
        chrome.storage.local.get(key, (result) => {
            sendResponse({ ok: true, rows: result[key] || {} });
        });
        return true;
    }
    if (request.action === 'startColorChange') {
        openDoubaoAndStartTask(request.task).then(result => {
            sendResponse(result);
        });
        return true;
    }
    if (request.action === 'startAiEdit') {
        openDoubaoForAiEdit(request.task).then(result => {
            sendResponse(result);
        });
        return true;
    }
    if (request.action === 'startPsEdit') {
        startPsEdit(request.task).then(result => {
            sendResponse(result);
        });
        return true;
    }
    if (request.action === 'getColorImage') {
        fetchColorImageAsBase64(request.rowNum, request.color).then(result => {
            sendResponse(result);
        });
        return true;
    }
    if (request.action === 'getColorImagesInfo') {
        const storageKey = colorKey(request.rowNum);
        chrome.storage.local.get(storageKey, (result) => {
            let images = result[storageKey] || {};
            if (Object.keys(images).length === 0) {
                const legacyKey = 'color_images_row_' + request.rowNum;
                chrome.storage.local.get(legacyKey, (legacyResult) => {
                    const legacyImages = legacyResult[legacyKey] || {};
                    if (Object.keys(legacyImages).length > 0) {
                        chrome.storage.local.set({ [storageKey]: legacyImages }, () => {
                            chrome.storage.local.remove(legacyKey);
                            console.log(`🔄 已迁移颜色图数据: ${legacyKey} → ${storageKey}`);
                        });
                        images = legacyImages;
                    }
                    sendResponse({ ok: true, images: Object.keys(images) });
                });
            } else {
                sendResponse({ ok: true, images: Object.keys(images) });
            }
        });
        return true;
    }
    if (request.action === 'getColorImagePath') {
        console.log(`🔍 [getColorImagePath] 调用: rowNum=${request.rowNum}, color=${request.color}, COLOR_IMG_DIR=${COLOR_IMG_DIR}, CURRENT_FILENAME=${CURRENT_FILENAME}`);
        const responseFn = (data) => {
            console.log(`🔍 [getColorImagePath] 收到getColorImagePathData回调，原始data: ${JSON.stringify(data)}`);
            data._debug = { colorImgDir: COLOR_IMG_DIR, currentFilename: CURRENT_FILENAME };
            console.log(`🔍 [getColorImagePath] 返回数据: ${JSON.stringify(data)}`);
            try {
                sendResponse(data);
                console.log(`✅ [getColorImagePath] sendResponse调用成功`);
            } catch (e) {
                console.error(`❌ [getColorImagePath] sendResponse调用失败: ${e.message}`);
            }
        };
        getColorImagePathData(request.rowNum, request.color, responseFn);
        return true;
    }
    if (request.action === 'setCurrentFilename') {
        CURRENT_FILENAME = request.filename || '';
        console.log(`📄 当前文件名切换为: ${CURRENT_FILENAME || '(默认)'}`);
        chrome.storage.local.set({ current_filename: CURRENT_FILENAME }, () => {
            sendResponse({ ok: true, filename: CURRENT_FILENAME });
        });
        return true;
    }
    if (request.action === 'getPsEditResult') {
        chrome.storage.local.get(PS_EDIT_RESULT_KEY, (result) => {
            sendResponse({ ok: true, result: result[PS_EDIT_RESULT_KEY] || null });
        });
        return true;
    }
    if (request.action === 'clearPsEditResult') {
        chrome.storage.local.remove(PS_EDIT_RESULT_KEY, () => {
            sendResponse({ ok: true });
        });
        return true;
    }
    return false;
}

chrome.runtime.onMessageExternal.addListener((request, sender, sendResponse) => {
    console.log(`🔍 [onMessageExternal] 收到消息: action=${request.action}, senderUrl=${sender?.url || 'unknown'}, senderId=${sender?.id || 'unknown'}`);
    if (request.action === 'ping') {
        assistantTabId = sender.tab?.id || null;
        sendResponse({ ok: true, version: '1.0.0' });
        return true;
    }
    if (request.action === 'clearAllColorImages') {
        const prefix = getFilePrefix();
        chrome.storage.local.get(null, (result) => {
            const keys = Object.keys(result).filter(k => k.startsWith(prefix + 'color__'));
            if (keys.length > 0) {
                chrome.storage.local.remove(keys, () => {
                    console.log(`🧹 已清理 ${keys.length} 个颜色图数据`);
                    sendResponse({ ok: true, cleared: keys.length });
                });
            } else {
                sendResponse({ ok: true, cleared: 0 });
            }
        });
        return true;
    }
    if (request.action === 'clearUploadedRows') {
        const key = uploadedKey();
        chrome.storage.local.remove(key, () => {
            console.log('🧹 已清理已上传状态');
            sendResponse({ ok: true });
        });
        return true;
    }
    if (request.action === 'clearAllOnNewFile') {
        const prefix = getFilePrefix();
        chrome.storage.local.get(null, (result) => {
            const keys = Object.keys(result).filter(k => k.startsWith(prefix));
            chrome.storage.local.remove(keys, () => {
                console.log(`🧹 新文件加载，清理当前文件数据: ${keys.length}项`);
                sendResponse({ ok: true, cleared: keys.length });
            });
        });
        return true;
    }
    if (request.action === 'getConfig') {
        sendResponse({ ok: true, config: { imageDir: IMAGE_DIR, colorImgDir: COLOR_IMG_DIR } });
        return true;
    }
    if (request.action === 'updateConfig') {
        if (request.config) {
            if (request.config.imageDir !== undefined) {
                IMAGE_DIR = request.config.imageDir;
                chrome.storage.local.set({ [IMAGE_DIR_KEY]: request.config.imageDir });
                console.log('📂 图片目录已更新为:', IMAGE_DIR);
            }
            if (request.config.colorImgDir !== undefined) {
                COLOR_IMG_DIR = request.config.colorImgDir;
                chrome.storage.local.set({ [COLOR_IMG_DIR_KEY]: request.config.colorImgDir });
                console.log('🖼️ 颜色图目录已更新为:', COLOR_IMG_DIR);
            }
            sendResponse({ ok: true, imageDir: IMAGE_DIR, colorImgDir: COLOR_IMG_DIR });
        } else {
            sendResponse({ ok: false, error: '缺少配置参数' });
        }
        return true;
    }
    handleSharedAction(request, sendResponse);
    return true;
});

chrome.runtime.onConnectExternal.addListener((port) => {
    console.log('🔌 [onConnectExternal] 收到外部连接:', port.name, port.sender?.url || 'unknown');
    if (port.name === 'assistant-channel') {
        assistantPort = port;
        assistantTabId = port.sender?.tab?.id || null;
        console.log('✅ [onConnectExternal] 发品助手长连接已建立, tabId=', assistantTabId);
        port.onDisconnect.addListener(() => {
            console.log('🔌 [onConnectExternal] 发品助手长连接已断开');
            assistantPort = null;
        });
        port.onMessage.addListener((msg) => {
            console.log('🔍 [onConnectExternal] 收到消息:', msg.action);
        });
    }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log(`🔍 [onMessage] 收到消息: action=${request.action}, sender=${sender?.tab?.url ? 'tab' : 'unknown'}`);
    if (request.action === 'getProductData') {
        const key = productKey();
        chrome.storage.local.get(key, (result) => {
            sendResponse({ ok: true, data: result[key] || null });
        });
        return true;
    }

    if (request.action === 'updateConfig') {
        if (request.config) {
            if (request.config.imageDir !== undefined) {
                IMAGE_DIR = request.config.imageDir;
                chrome.storage.local.set({ [IMAGE_DIR_KEY]: request.config.imageDir });
                console.log('📂 图片目录已更新为:', IMAGE_DIR);
            }
            if (request.config.colorImgDir !== undefined) {
                COLOR_IMG_DIR = request.config.colorImgDir;
                chrome.storage.local.set({ [COLOR_IMG_DIR_KEY]: request.config.colorImgDir });
                console.log('🖼️ 颜色图目录已更新为:', COLOR_IMG_DIR);
            }
            sendResponse({ ok: true, imageDir: IMAGE_DIR, colorImgDir: COLOR_IMG_DIR });
        } else {
            sendResponse({ ok: false, error: '缺少配置参数' });
        }
        return true;
    }

    if (request.action === 'getConfig') {
        sendResponse({ ok: true, config: { imageDir: IMAGE_DIR, colorImgDir: COLOR_IMG_DIR } });
        return true;
    }

    if (request.action === 'broadcastConfig') {
        sendResponse({ ok: true });
        return true;
    }

    if (request.action === 'heartbeat') {
        ensureConfigLoaded().then(() => {
            sendResponse({ ok: true, ts: Date.now() });
        });
        return true;
    }

    if (request.action === 'realMouseClick') {
        const tabId = sender.tab?.id;
        if (!tabId) {
            sendResponse({ ok: false, error: '无法获取标签页ID' });
            return false;
        }
        const { x, y } = request;
        if (x === undefined || y === undefined) {
            sendResponse({ ok: false, error: '缺少坐标参数' });
            return false;
        }
        realClickCDP(tabId, x, y).then(result => {
            sendResponse(result);
        }).catch(err => {
            sendResponse({ ok: false, error: err.message });
        });
        return true;
    }

    if (request.action === 'runClickScript') {
        const tabId = sender.tab?.id;
        if (!tabId) {
            sendResponse({ ok: false, error: '无法获取标签页ID' });
            return false;
        }
        const { selector } = request;
        const expr = `(function() {
            const el = document.querySelector('${selector}');
            if (!el) return { ok: false, msg: '元素未找到' };
            const rect = el.getBoundingClientRect();
            const x = rect.left + rect.width / 2;
            const y = rect.top + rect.height / 2;
            el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: x, clientY: y }));
            el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, clientX: x, clientY: y }));
            el.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: x, clientY: y }));
            return { ok: true, msg: '点击完成', rect: { width: rect.width, height: rect.height } };
        })()`;
        
        chrome.scripting.executeScript({
            target: { tabId },
            func: (expression) => eval(expression),
            args: [expr]
        }).then(results => {
            if (results && results[0] && results[0].result) {
                sendResponse(results[0].result);
            } else {
                sendResponse({ ok: false, error: '脚本执行失败' });
            }
        }).catch(err => {
            sendResponse({ ok: false, error: err.message });
        });
        return true;
    }

    if (request.action === 'activateTab') {
        const tabId = sender.tab?.id;
        if (!tabId) {
            sendResponse({ ok: false, error: '无法获取标签页ID' });
            return false;
        }
        chrome.tabs.update(tabId, { active: true }, () => {
            chrome.windows.update(sender.tab.windowId, { focused: true }, () => {
                sendResponse({ ok: true });
            });
        });
        return true;
    }

    if (request.action === 'startPsEdit') {
        startPsEdit(request.task).then(result => {
            sendResponse(result);
        });
        return true;
    }

    if (request.action === 'psEditSave') {
        console.log('[PS编辑] background 收到 psEditSave 消息');
        handlePsEditSave(request.data);
        sendResponse({ ok: true });
        return true;
    }

    if (request.action === 'psEditSaveFsa') {
        console.log('[PS编辑] background 收到 psEditSaveFsa 消息，fileName:', request.fileName, 'data length:', request.data?.byteLength);
        handlePsEditSaveFsa(request.data, request.fileName);
        sendResponse({ ok: true });
        return true;
    }

    console.log(`🔍 [onMessage] 调用handleSharedAction: action=${request.action}`);
    const sharedActions = ['saveProductData', 'saveBatchProducts', 'getProductByRow', 'openPublishPage', 'openBatchPublish', 'publishCompleted', 'markUploaded', 'getUploadedRows', 'startColorChange', 'startAiEdit', 'startPsEdit', 'getColorImage', 'getColorImagesInfo', 'getColorImagePath', 'setCurrentFilename', 'getPsEditResult', 'clearPsEditResult', 'getConfig'];
    if (sharedActions.includes(request.action)) {
        handleSharedAction(request, sendResponse);
        return true;
    }

    if (request.action === 'uploadMainImage') {
        const tabId = sender.tab?.id;
        if (!tabId) {
            sendResponse({ ok: false, error: '无法获取标签页ID' });
            return false;
        }
        const imagePath = request.imagePath;
        if (!imagePath) {
            sendResponse({ ok: false, error: '图片路径为空' });
            return false;
        }

        const pageType = request.pageType || 'page2';

        sendResponse({ ok: true, accepted: true });

        let uploadFn;
        if (pageType === 'page2') {
            uploadFn = uploadPage2ImageViaCDP;
        } else if (pageType === 'page3') {
            uploadFn = uploadPage3ImageViaCDP;
        } else {
            uploadFn = uploadPage2ImageViaCDP;
        }

        uploadFn(tabId, imagePath).then(result => {
            chrome.tabs.sendMessage(tabId, { action: 'uploadResult', result }).catch(() => {});
        }).catch(err => {
            chrome.tabs.sendMessage(tabId, { action: 'uploadResult', result: { ok: false, error: err.message } }).catch(() => {});
        });
        return true;
    }

    if (request.action === 'uploadAllImages') {
        const tabId = sender.tab?.id;
        if (!tabId) {
            sendResponse({ ok: false, error: '无法获取标签页ID' });
            return false;
        }
        const imagePaths = request.imagePaths || [];
        if (imagePaths.length === 0) {
            sendResponse({ ok: false, error: '图片路径列表为空' });
            return false;
        }

        const pageType = request.pageType || 'page2';

        sendResponse({ ok: true, accepted: true });

        let uploadFn;
        if (pageType === 'page2') {
            uploadFn = uploadPage2ImageViaCDP;
        } else if (pageType === 'page3') {
            uploadFn = uploadPage3ImageViaCDP;
        } else {
            uploadFn = uploadPage2ImageViaCDP;
        }

        batchUploadImages(tabId, imagePaths, uploadFn).then(result => {
            chrome.tabs.sendMessage(tabId, { action: 'batchUploadResult', result }).catch(() => {});
        }).catch(err => {
            chrome.tabs.sendMessage(tabId, { action: 'batchUploadResult', result: { ok: false, error: err.message } }).catch(() => {});
        });
        return true;
    }

    if (request.action === 'uploadSkuColorImage') {
        const tabId = sender.tab?.id;
        if (!tabId) {
            sendResponse({ ok: false, error: '无法获取标签页ID' });
            return false;
        }
        const { colorLabel, imagePath, iconX, iconY, itemIndex } = request;
        if (!colorLabel || !imagePath) {
            sendResponse({ ok: false, error: '缺少参数' });
            return false;
        }
        sendResponse({ ok: true, accepted: true });
        uploadColorImageViaCDP(tabId, colorLabel, imagePath, iconX, iconY, itemIndex).then(result => {
            chrome.tabs.sendMessage(tabId, { action: 'skuColorUploadResult', result }).catch(() => {});
        }).catch(err => {
            chrome.tabs.sendMessage(tabId, { action: 'skuColorUploadResult', result: { ok: false, error: err.message } }).catch(() => {});
        });
        return true;
    }

    if (request.action === 'startColorChange') {
        openDoubaoAndStartTask(request.task).then(result => {
            sendResponse(result);
        });
        return true;
    }

    if (request.action === 'doubaoUploadImage') {
        const tabId = sender.tab?.id;
        uploadDoubaoImage(tabId, request.imagePath).then(result => {
            sendResponse(result);
        });
        return true;
    }

    if (request.action === 'downloadDoubaoImage') {
        downloadDoubaoImage(request.url, request.filename, request.rowNum).then(result => {
            sendResponse(result);
        });
        return true;
    }

    if (request.action === 'colorTaskComplete') {
        console.log('🎨 换色任务完成:', request.results);
        const rowNum = request.rowNum;
        if (rowNum) {
            // 持久化完成事件：SW 休眠后通知通道可能失效，发品助手页面可轮询此 key 兜底推进
            const eventKey = 'color_task_complete_event';
            const event = { rowNum, timestamp: Date.now(), results: request.results };
            chrome.storage.local.set({ [eventKey]: event }, () => {
                console.log(`💾 换色完成事件已持久化: row${rowNum}`);
            });
            notifyColorTaskComplete(rowNum);
        }
        sendResponse({ ok: true });
        return true;
    }

    if (request.action === 'getColorImage') {
        fetchColorImageAsBase64(request.rowNum, request.color).then(result => {
            sendResponse(result);
        });
        return true;
    }

    if (request.action === 'getColorImagesInfo') {
        const storageKey = colorKey(request.rowNum);
        chrome.storage.local.get(storageKey, (result) => {
            let images = result[storageKey] || {};
            if (Object.keys(images).length === 0) {
                const legacyKey = 'color_images_row_' + request.rowNum;
                chrome.storage.local.get(legacyKey, (legacyResult) => {
                    const legacyImages = legacyResult[legacyKey] || {};
                    if (Object.keys(legacyImages).length > 0) {
                        chrome.storage.local.set({ [storageKey]: legacyImages }, () => {
                            chrome.storage.local.remove(legacyKey);
                            console.log(`🔄 已迁移颜色图数据: ${legacyKey} → ${storageKey}`);
                        });
                        images = legacyImages;
                    }
                    sendResponse({ ok: true, images: Object.keys(images) });
                });
            } else {
                sendResponse({ ok: true, images: Object.keys(images) });
            }
        });
        return true;
    }

    if (request.action === 'getColorImagePath') {
        console.log(`🔍 [getColorImagePath] onMessage调用: rowNum=${request.rowNum}, color=${request.color}, COLOR_IMG_DIR=${COLOR_IMG_DIR}, CURRENT_FILENAME=${CURRENT_FILENAME}`);
        const responseFn = (data) => {
            console.log(`🔍 [getColorImagePath] onMessage收到回调，原始data: ${JSON.stringify(data)}`);
            data._debug = { colorImgDir: COLOR_IMG_DIR, currentFilename: CURRENT_FILENAME };
            console.log(`🔍 [getColorImagePath] onMessage返回数据: ${JSON.stringify(data)}`);
            try {
                sendResponse(data);
                console.log(`✅ [getColorImagePath] onMessage sendResponse成功`);
            } catch (e) {
                console.error(`❌ [getColorImagePath] onMessage sendResponse失败: ${e.message}`);
            }
        };
        getColorImagePathData(request.rowNum, request.color, responseFn);
        return true;
    }

    if (request.action === 'setCurrentFilename') {
        CURRENT_FILENAME = request.filename || '';
        chrome.storage.local.set({ current_filename: CURRENT_FILENAME }, () => {
            sendResponse({ ok: true, filename: CURRENT_FILENAME });
        });
        return true;
    }

    if (request.action === 'fillBoxRule') {
        const tabId = sender.tab?.id;
        if (!tabId) {
            sendResponse({ ok: false, error: '无法获取标签页ID' });
            return false;
        }
        sendResponse({ ok: true, accepted: true });

        // 混合方案：先CDP，失败后降级到直接postMessage
        fillBoxRuleHybrid(tabId).then(result => {
            chrome.tabs.sendMessage(tabId, { action: 'fillBoxRuleResult', result }).catch(() => {});
        }).catch(err => {
            chrome.tabs.sendMessage(tabId, { action: 'fillBoxRuleResult', result: { ok: false, error: err.message } }).catch(() => {});
        });
        return true;
    }
});

async function fillBoxRuleHybrid(tabId) {
    const sendLog = async (msg) => {
        try { await chrome.tabs.sendMessage(tabId, { action: 'log', msg }); } catch (_) {}
    };

    await sendLog('📦 方案1: CDP坐标点击方式...');
    const cdpResult = await tryFillBoxRuleCDP(tabId);
    await sendLog(`📊 CDP结果: ok=${cdpResult.ok}, error=${cdpResult.error || 'none'}`);
    if (cdpResult.ok) return cdpResult;

    await sendLog('📦 方案2: iframe content script方式...');
    const iframeResult = await fillBoxRuleViaIframeScript(tabId);
    await sendLog(`📊 iframe脚本结果: ok=${iframeResult.ok}, error=${iframeResult.error || 'none'}`);
    if (iframeResult.ok) return iframeResult;

    await sendLog('📦 方案3: postMessage方案尝试...');
    return await fillBoxRuleViaTabScript(tabId);
}

async function fillBoxRuleViaIframeScript(tabId) {
    const sendLog = async (msg) => {
        try { await chrome.tabs.sendMessage(tabId, { action: 'log', msg }); } catch (_) {}
    };

    try {
        await sendLog('📦 查找箱规iframe...');
        const frames = await chrome.webNavigation.getAllFrames({ tabId });
        let targetFrameId = null;
        for (const frame of frames) {
            if (frame.url && frame.url.includes('scm.alibaba.com') && frame.url.includes('template_relate_package')) {
                targetFrameId = frame.frameId;
                await sendLog(`📦 找到iframe: frameId=${frame.frameId}, url=${frame.url}`);
                break;
            }
        }

        if (!targetFrameId) {
            await sendLog('❌ 未找到箱规iframe');
            return { ok: false, error: '未找到箱规iframe' };
        }

        // ping检测iframe content script是否已加载
        await sendLog('📦 Ping检测iframe content script...');
        const pingResult = await new Promise((resolve) => {
            chrome.tabs.sendMessage(tabId, { action: 'pingBoxRuleIframe' }, { frameId: targetFrameId }, (response) => {
                if (chrome.runtime.lastError) {
                    resolve({ ok: false, error: chrome.runtime.lastError.message });
                } else {
                    resolve(response || { ok: false });
                }
            });
        });

        if (!pingResult.ok) {
            await sendLog('⚠️ iframe content script未响应，尝试动态注入...');
            try {
                await chrome.scripting.executeScript({
                    target: { tabId, frameIds: [targetFrameId] },
                    files: ['content/boxRuleIframe.js']
                });
                await sendLog('✅ 动态注入成功，等待加载...');
                await new Promise(r => setTimeout(r, 1500));
            } catch (injectErr) {
                await sendLog('❌ 动态注入失败: ' + injectErr.message);
                return { ok: false, error: '注入失败: ' + injectErr.message };
            }
        } else {
            await sendLog('✅ iframe content script已就绪');
        }

        await sendLog('📦 发送fillBoxRuleIframe消息...');
        const result = await new Promise((resolve) => {
            chrome.tabs.sendMessage(tabId, { action: 'fillBoxRuleIframe' }, { frameId: targetFrameId }, (response) => {
                if (chrome.runtime.lastError) {
                    resolve({ ok: false, error: chrome.runtime.lastError.message });
                } else {
                    resolve(response || { ok: false, error: '无响应' });
                }
            });
        });

        await sendLog(`📊 iframe执行结果: ${JSON.stringify(result)}`);
        return result;
    } catch (e) {
        await sendLog('❌ iframe脚本方式失败: ' + e.message);
        return { ok: false, error: e.message };
    }
}

async function tryFillBoxRuleCDP(tabId) {
    const sendLog = async (msg) => {
        try { await chrome.tabs.sendMessage(tabId, { action: 'log', msg }); } catch (_) {}
    };
    
    console.log('📦 箱规关联 CDP Target 方式尝试...');
    await sendLog('📦 CDP: 开始attach debugger...');
    let mainAttached = false;
    let iframeTargetId = null;
    let iframeAttached = false;
    try {
        try {
            await chrome.debugger.attach({ tabId }, '1.3');
            mainAttached = true;
            console.log('✅ 主页面 debugger attach 成功');
            await sendLog('✅ CDP: main attach成功');
        } catch (e) {
            console.log('❌ 主页面 Debugger attach 失败:', e.message);
            if (e.message && e.message.includes('already attached')) {
                mainAttached = true;
                console.log('⚠️ 已被attach，继续执行');
                await sendLog('⚠️ CDP: 已被attach，继续执行');
            } else {
                await sendLog('❌ CDP: main attach失败: ' + e.message);
                return { ok: false, error: 'Debugger attach 失败: ' + e.message };
            }
        }

        await new Promise(r => setTimeout(r, 1500));

        await sendLog('📦 CDP: 获取iframe位置...');
        let iframeRect;
        try {
            const rectResult = await chrome.debugger.sendCommand({ tabId }, 'Runtime.evaluate', {
                expression: `(function(){
                    const iframes = document.querySelectorAll('iframe');
                    for (const iframe of iframes) {
                        if (iframe.src && iframe.src.includes('scm.alibaba.com') && iframe.src.includes('template_relate_package')) {
                            const rect = iframe.getBoundingClientRect();
                            if (rect.width > 0 && rect.height > 0) {
                                return {left:rect.left, top:rect.top, width:rect.width, height:rect.height};
                            }
                        }
                    }
                    return null;
                })()`,
                returnByValue: true
            });
            iframeRect = rectResult.result?.value;
            await sendLog(`📦 CDP: iframe位置: ${JSON.stringify(iframeRect)}`);
        } catch (e) {
            await sendLog('❌ CDP: 获取iframe位置失败: ' + e.message);
            return { ok: false, error: '获取iframe位置失败' };
        }

        if (!iframeRect) {
            await sendLog('📦 CDP: 尝试第二种方式查找iframe...');
            try {
                const rectResult = await chrome.debugger.sendCommand({ tabId }, 'Runtime.evaluate', {
                    expression: `(function(){
                        const iframes = document.querySelectorAll('iframe');
                        for (const iframe of iframes) {
                            const rect = iframe.getBoundingClientRect();
                            if (rect.width > 0 && rect.height > 0 && rect.height > 500) {
                                return {left:rect.left, top:rect.top, width:rect.width, height:rect.height};
                            }
                        }
                        return null;
                    })()`,
                    returnByValue: true
                });
                iframeRect = rectResult.result?.value;
                await sendLog(`📦 CDP: 第二种方式iframe位置: ${JSON.stringify(iframeRect)}`);
            } catch (e) {
                await sendLog('❌ CDP: 第二种方式获取iframe位置失败: ' + e.message);
            }
        }

        if (!iframeRect) {
            return { ok: false, error: 'iframe未找到' };
        }

        await sendLog('📦 CDP: 通过主页面注入脚本到iframe...');
        
        const boxRuleScript = `(function(){
            function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
            function nativeClick(el) {
                if (!el) return;
                var rect = el.getBoundingClientRect();
                var x = rect.left + rect.width / 2;
                var y = rect.top + rect.height / 2;
                el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: x, clientY: y }));
                el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, clientX: x, clientY: y }));
                el.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: x, clientY: y }));
            }
            function findEl(text, selector) {
                var els = document.querySelectorAll(selector);
                for (var i = 0; i < els.length; i++) {
                    var t = (els[i].innerText || els[i].textContent || '').trim();
                    if (t.includes(text) && els[i].offsetParent !== null) return els[i];
                }
                return null;
            }
            async function run() {
                var result = { s1: false, s2: false, s3: false, s4: false, s5: false, s6: false };
                try {
                    await sleep(800);
                    
                    var manual = findEl('手动设置', 'label, .next-radio-wrapper, [class*="radio"]');
                    if (manual) { nativeClick(manual); await sleep(500); }
                    var next1 = findEl('下一步', 'button, .next-btn');
                    if (next1) { nativeClick(next1); await sleep(1500); result.s1 = true; }
                    
                    await sleep(800);
                    
                    var multi = findEl('一箱多件', 'label, .next-radio-wrapper, [class*="radio"]');
                    if (multi) { nativeClick(multi); await sleep(500); }
                    var confirm1 = findEl('确认', 'button, .next-btn');
                    if (confirm1) { nativeClick(confirm1); await sleep(1500); result.s2 = true; }
                    
                    await sleep(1000);
                    
                    var next2 = findEl('下一步', 'button, .next-btn');
                    if (next2) { nativeClick(next2); await sleep(1500); result.s3 = true; }
                    
                    await sleep(1500);
                    
                    var targetRow = null;
                    var rows = document.querySelectorAll('tr, .next-table-row');
                    for (var i = 0; i < rows.length; i++) {
                        if (rows[i].innerText.includes('50*40*30') || rows[i].innerText.includes('50x40x30')) {
                            targetRow = rows[i];
                            break;
                        }
                    }
                    if (targetRow) {
                        var inputEl = targetRow.querySelector('input[type="number"], .next-number-picker input, input[aria-valuemax]');
                        if (inputEl) {
                            inputEl.focus();
                            inputEl.select();
                            inputEl.value = '25';
                            inputEl.dispatchEvent(new Event('input', { bubbles: true }));
                            inputEl.dispatchEvent(new Event('change', { bubbles: true }));
                            inputEl.blur();
                            await sleep(800);
                            result.s4 = true;
                        }
                    }
                    
                    await sleep(1000);
                    
                    var associate = null;
                    var rows = document.querySelectorAll('tr, .next-table-row');
                    for (var i = 0; i < rows.length; i++) {
                        if (rows[i].innerText.includes('50*40*30') || rows[i].innerText.includes('50x40x30')) {
                            var btns = rows[i].querySelectorAll('button, .next-btn');
                            for (var j = 0; j < btns.length; j++) {
                                if (btns[j].innerText.includes('关联')) {
                                    associate = btns[j];
                                    break;
                                }
                            }
                            if (associate) break;
                        }
                    }
                    if (!associate) associate = findEl('关联', 'button, .next-btn');
                    if (associate) {
                        if (associate.disabled) associate.disabled = false;
                        nativeClick(associate);
                        await sleep(1500);
                        result.s5 = true;
                    }
                    
                    await sleep(1500);
                    
                    var confirm2 = findEl('确认', 'button, .next-btn');
                    if (confirm2) { nativeClick(confirm2); await sleep(1000); }
                    var finish = findEl('确认完成', 'button, .next-btn');
                    if (!finish) finish = findEl('完成', 'button, .next-btn');
                    if (finish) { nativeClick(finish); await sleep(1000); result.s6 = true; }
                } catch(e) {}
                return result;
            }
            return run();
        })()`;

        const injectExpr = `(function(){
            const iframes = document.querySelectorAll('iframe');
            for (const iframe of iframes) {
                if (iframe.src && iframe.src.includes('scm.alibaba.com') && iframe.src.includes('template_relate_package')) {
                    try {
                        const win = iframe.contentWindow;
                        if (win && win.eval) {
                            return win.eval(\`${boxRuleScript}\`);
                        }
                    } catch(e) {
                        return { error: e.message };
                    }
                }
            }
            return { error: 'iframe not found' };
        })()`;

        await sendLog('📦 CDP: 注入脚本到iframe...');
        try {
            const result = await chrome.debugger.sendCommand({ tabId }, 'Runtime.evaluate', {
                expression: injectExpr,
                returnByValue: true,
                awaitPromise: true,
                timeout: 30000
            });
            const res = result.result?.value;
            await sendLog(`📦 CDP: iframe脚本结果: ${JSON.stringify(res)}`);
            
            if (res && !res.error) {
                const allOk = res.s1 && res.s2 && res.s3 && res.s4 && res.s5 && res.s6;
                if (allOk) {
                    await sendLog('✅ CDP: 箱规步骤全部完成');
                    return { ok: true, method: 'cdp-iframe-eval' };
                } else {
                    await sendLog(`⚠️ CDP: 部分步骤失败: ${JSON.stringify(res)}`);
                }
            }
        } catch (e) {
            await sendLog('❌ CDP: 脚本注入失败: ' + e.message);
        }

        return { ok: false, error: 'CDP脚本注入失败' };

    } catch (e) {
        console.log('❌ tryFillBoxRuleCDP 异常:', e.message);
        await sendLog('❌ CDP: 异常: ' + e.message);
        return { ok: false, error: e.message };
    }
}

function buildBoxRuleStepsCode() {
    var code = "";
    code += "async function boxRuleSteps(){";
    code += "const sleep=ms=>new Promise(r=>setTimeout(r,ms));";
    code += "const nativeClick=el=>{if(!el)return;const rect=el.getBoundingClientRect();const x=rect.left+rect.width/2,y=rect.top+rect.height/2;el.dispatchEvent(new MouseEvent('mousedown',{bubbles:true,clientX:x,clientY:y}));el.dispatchEvent(new MouseEvent('mouseup',{bubbles:true,clientX:x,clientY:y}));el.dispatchEvent(new MouseEvent('click',{bubbles:true,clientX:x,clientY:y}));};";
    code += "async function debugPage(){const d=[];d.push('URL:'+document.URL);d.push('TITLE:'+document.title);d.push('LABEL:'+document.querySelectorAll('label').length);d.push('BTN:'+document.querySelectorAll('button').length);d.push('NEXT:'+document.querySelectorAll('.next-btn').length);const ls=document.querySelectorAll('label');for(let i=0;i<Math.min(5,ls.length);i++){const t=(ls[i].innerText||'').substring(0,80).replace(/[\\r\\n]/g,' ');d.push('L'+i+':'+t);}const bs=document.querySelectorAll('button');for(let i=0;i<Math.min(5,bs.length);i++){const t=(bs[i].innerText||'').substring(0,40).replace(/[\\r\\n]/g,' ');d.push('B'+i+':'+t+'|'+bs[i].className.substring(0,50));}return d.join(';');}";
    code += "async function step1(){const ls=doc.querySelectorAll('label');for(const l of ls){const t=l.innerText||'';if(t.includes('手动设置')&&l.offsetParent!==null){nativeClick(l);await sleep(400);break;}}const bs=doc.querySelectorAll('.next-btn,button');for(const b of bs){const t=(b.innerText||'').trim();if(t==='确认'&&b.offsetParent!==null){nativeClick(b);return true;}}return false;}";
    code += "async function step2(){await sleep(800);const ls=doc.querySelectorAll('label');for(const l of ls){const t=l.innerText||'';if(t.includes('一箱多件')&&l.offsetParent!==null){nativeClick(l);await sleep(400);break;}}const bs=doc.querySelectorAll('.next-btn,button');for(const b of bs){const t=(b.innerText||'').trim();if(t==='下一步'&&b.offsetParent!==null){nativeClick(b);return true;}}return false;}";
    code += "async function step3(){await sleep(1000);const bs=doc.querySelectorAll('.next-btn,button');for(const b of bs){const t=(b.innerText||'').trim();if(t==='下一步'&&b.offsetParent!==null){nativeClick(b);return true;}}return false;}";
    code += "async function step4(){await sleep(1500);const rs=doc.querySelectorAll('tr,[class*=\"table-row\"],[class*=\"row\"]');for(const r of rs){const t=r.innerText||'';if(t.includes('50*40*30')){const is=r.querySelectorAll('input');for(const i of is){if(i.offsetParent!==null){i.focus();i.value='25';i.dispatchEvent(new Event('input',{bubbles:true}));i.dispatchEvent(new Event('change',{bubbles:true}));break;}}await sleep(300);const ls=r.querySelectorAll('a,button,[class*=\"link\"]');for(const l of ls){if(l.innerText&&l.innerText.trim()==='关联'&&l.offsetParent!==null){nativeClick(l);return true;}}return true;}}return false;}";
    code += "async function step5(){await sleep(800);const bs=doc.querySelectorAll('.next-btn,button');for(const b of bs){const t=(b.innerText||'').trim();if(t==='确认'&&b.offsetParent!==null){nativeClick(b);return true;}}return false;}";
    code += "const dbg=await debugPage();await sleep(500);const s1=await step1();await sleep(1200);const s2=await step2();await sleep(1200);const s3=await step3();await sleep(1500);const s4=await step4();await sleep(1000);const s5=await step5();return {ok:s1&&s2&&s3&&s4&&s5,steps:{s1,s2,s3,s4,s5},debug:dbg};";
    code += "}";
    return code;
}

// 通过 tab URL 方式获取 iframe reference 并 postMessage
async function fillBoxRuleViaTabScript(tabId) {
    console.log('📦 箱规关联 postMessage 方式尝试...');
    return new Promise((resolve) => {
        chrome.tabs.sendMessage(tabId, { action: 'fillBoxRuleViaPostMessage' }, (resp) => {
            resolve(resp || { ok: false, error: 'postMessage方式无响应' });
        });
        setTimeout(() => resolve({ ok: false, error: 'postMessage超时' }), 25000);
    });
}

async function batchUploadImages(tabId, imagePaths, uploadFn) {
    const sendLog = async (msg) => {
        try { await chrome.tabs.sendMessage(tabId, { action: 'log', msg }); } catch (_) {}
    };
    let success = 0;
    for (let i = 0; i < imagePaths.length; i++) {
        await sendLog(`📤 上传第 ${i + 1}/${imagePaths.length} 张图...`);
        const r = await uploadFn(tabId, imagePaths[i]);
        if (r.ok) success++;
        await new Promise(r => setTimeout(r, 1000));
    }
    await sendLog(`✅ 批量上传完成: ${success}/${imagePaths.length} 张成功`);
    return { ok: success > 0, success, total: imagePaths.length };
}

async function findDoubaoTab() {
    const tabs = await chrome.tabs.query({ url: ['*://www.doubao.com/*', '*://doubao.com/*'] });
    if (tabs.length > 0) return tabs[0];
    return null;
}

async function openDoubaoAndStartTask(task) {
    console.log('🎨 启动豆包AI换色任务:', task);
    pendingColorTask = task;
    await savePendingColorTask(task);

    let tab = await findDoubaoTab();
    if (tab) {
        doubaoTabId = tab.id;
        await saveDoubaoTabId(tab.id);
        await chrome.tabs.update(tab.id, { active: true });
        console.log('📌 找到已有豆包标签页:', tab.id);
        await new Promise(r => setTimeout(r, 1000));
        sendStartColorTask(tab.id, task);
        await savePendingColorTask(null);
    } else {
        console.log('🌐 打开新的豆包标签页...');
        const newTab = await chrome.tabs.create({ url: DOUBAO_URL, active: true });
        doubaoTabId = newTab.id;
        await saveDoubaoTabId(newTab.id);
    }
    return { ok: true, tabId: doubaoTabId };
}

async function openDoubaoForAiEdit(task) {
    console.log('🤖 启动豆包AI改图任务:', task);
    pendingAiEditTask = task;

    let tab = await findDoubaoTab();
    if (tab) {
        doubaoTabId = tab.id;
        await chrome.tabs.update(tab.id, { active: true });
        console.log('📌 找到已有豆包标签页:', tab.id);
        await new Promise(r => setTimeout(r, 1000));
        sendStartAiEditTask(tab.id, task);
    } else {
        console.log('🌐 打开新的豆包标签页...');
        const newTab = await chrome.tabs.create({ url: DOUBAO_URL, active: true });
        doubaoTabId = newTab.id;
    }
    return { ok: true, tabId: doubaoTabId };
}

function sendStartAiEditTask(tabId, task) {
    chrome.tabs.sendMessage(tabId, { action: 'startAiEditTask', task }).catch(err => {
        console.log('⚠️ 发送AI改图任务失败，等待页面加载:', err.message);
    });
}

function sendStartColorTask(tabId, task) {
    chrome.tabs.sendMessage(tabId, { action: 'startColorTask', task }).catch(err => {
        console.log('⚠️ 发送任务失败，等待页面加载:', err.message);
    });
}

async function uploadDoubaoImage(tabId, imagePath) {
    console.log('🖼️ 豆包页面上传图片:', imagePath);
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: false });
        const targetId = tabId || tab?.id;
        if (!targetId) throw new Error('无法获取标签页ID');

        let attached = false;
        try {
            await chrome.debugger.attach({ tabId: targetId }, '1.3');
            attached = true;
        } catch (e) {
            console.log('Debugger 已连接或连接失败:', e.message);
        }

        const doc = await chrome.debugger.sendCommand({ tabId: targetId }, 'DOM.getDocument');
        const rootNodeId = doc.root.nodeId;

        const { nodeIds } = await chrome.debugger.sendCommand({ tabId: targetId }, 'DOM.querySelectorAll', {
            nodeId: rootNodeId,
            selector: 'input[type="file"]'
        });

        let targetNodeId = null;
        if (nodeIds && nodeIds.length > 0) {
            for (const nid of nodeIds) {
                try {
                    const result = await chrome.debugger.sendCommand({ tabId: targetId }, 'DOM.describeNode', { nodeId: nid });
                    if (result?.node) {
                        targetNodeId = nid;
                        break;
                    }
                } catch (_) {}
            }
        }

        if (!targetNodeId) {
            throw new Error('未找到文件输入框');
        }

        await chrome.debugger.sendCommand({ tabId: targetId }, 'DOM.setFileInputFiles', {
            nodeId: targetNodeId,
            files: [imagePath]
        });

        if (attached) {
            try { await chrome.debugger.detach({ tabId: targetId }); } catch (_) {}
        }

        console.log('✅ 豆包图片上传成功');
        return { ok: true };
    } catch (e) {
        console.error('❌ 豆包图片上传失败:', e.message);
        return { ok: false, error: e.message };
    }
}

async function downloadDoubaoImage(url, filename, rowNum) {
    return new Promise(async (resolve) => {
        try {
            const fileFolder = CURRENT_FILENAME || '默认';
            const relativePath = 'Polo发品_颜色图\\' + fileFolder + '\\row' + rowNum + '\\' + filename;

            const colorMatch = filename.match(/_(white|black|gray|navy)\./);
            if (colorMatch) {
                try {
                    const resp = await fetch(url, { headers: { 'Referer': 'https://www.doubao.com/' } });
                    if (resp.ok) {
                        const blob = await resp.blob();
                        const reader = new FileReader();
                        reader.onloadend = () => {
                            const color = colorMatch[1];
                            const idbKey = colorImageIDBKey(CURRENT_FILENAME, rowNum, color);
                            saveColorImageToIDB(idbKey, reader.result).then(() => {
                                console.log(`💾 颜色图已存 IndexedDB(预取): ${idbKey}`);
                            });
                        };
                        reader.readAsDataURL(blob);
                    }
                } catch (e) {
                    console.warn('预取图片存 IndexedDB 失败:', e.message);
                }
            }

            chrome.downloads.download({
                url: url,
                filename: relativePath,
                conflictAction: 'overwrite',
                saveAs: false
            }, (downloadId) => {
                if (chrome.runtime.lastError) {
                    console.warn(`⚠️ chrome.downloads 失败，改用 fetch 方式: ${chrome.runtime.lastError.message}`);
                    downloadViaFetch(url, filename, rowNum, relativePath).then(resolve);
                    return;
                }
                console.log(`📥 开始下载: ${filename} (id: ${downloadId})`);

                const onChanged = (delta) => {
                    if (delta.id !== downloadId) return;
                    if (delta.state && delta.state.current === 'complete') {
                        chrome.downloads.search({ id: downloadId }, (items) => {
                            if (items && items[0]) {
                                const fullPath = items[0].filename;
                                const storageKey = colorKey(rowNum);
                                const colorMatch = filename.match(/_(white|black|gray|navy)\./);
                                console.log(`💾 下载完成: ${filename} → ${fullPath}, storageKey=${storageKey}, colorMatch=`, colorMatch);
                                chrome.downloads.onChanged.removeListener(onChanged);
                                
                                if (colorMatch) {
                                    const color = colorMatch[1];
                                    chrome.storage.local.get(storageKey, (result) => {
                                        const images = result[storageKey] || {};
                                        images[color] = { url, path: fullPath };
                                        chrome.storage.local.set({ [storageKey]: images }, () => {
                                            console.log(`💾 已保存颜色图: row${rowNum}/${color} → ${fullPath}`);
                                            resolve({ ok: true, filename, path: fullPath });
                                        });
                                    });
                                } else {
                                    console.warn(`⚠️ 颜色匹配失败: ${filename}`);
                                    resolve({ ok: true, filename, path: fullPath });
                                }
                            }
                        });
                    }
                    if (delta.error) {
                        chrome.downloads.onChanged.removeListener(onChanged);
                        console.warn(`⚠️ 下载出错，改用 fetch 方式: ${delta.error.current}`);
                        downloadViaFetch(url, filename, rowNum, relativePath).then(resolve);
                    }
                };
                chrome.downloads.onChanged.addListener(onChanged);

                setTimeout(() => {
                    chrome.downloads.onChanged.removeListener(onChanged);
                    resolve({ ok: false, error: '下载超时' });
                }, 60000);
            });
        } catch (e) {
            console.error('❌ 下载失败:', e.message);
            resolve({ ok: false, error: e.message });
        }
    });
}

const COLOR_NAMES = ['white', 'black', 'gray', 'navy'];

async function notifyColorTaskComplete(rowNum) {
    if (assistantPort) {
        try {
            assistantPort.postMessage({ action: 'colorTaskComplete', rowNum });
            console.log('✅ 已通过长连接通知发品助手换色完成');
            return;
        } catch (e) {
            console.log('⚠️ 长连接发送失败:', e.message);
            assistantPort = null;
        }
    }

    if (assistantTabId) {
        try {
            await chrome.tabs.sendMessage(assistantTabId, { action: 'colorTaskComplete', rowNum });
            console.log('✅ 已通过 tabs.sendMessage 通知发品助手换色完成');
            return;
        } catch (e) {
            console.log('⚠️ tabs.sendMessage 失败:', e.message);
        }
    }

    try {
        const result = await new Promise((resolve) => {
            chrome.runtime.sendMessage(EXTENSION_ID, { action: 'colorTaskComplete', rowNum }, (response) => {
                if (chrome.runtime.lastError) {
                    resolve({ ok: false, error: chrome.runtime.lastError.message });
                } else {
                    resolve(response || { ok: false });
                }
            });
        });
        if (result.ok) {
            console.log('✅ 已通过 chrome.runtime.sendMessage 通知发品助手换色完成');
            return;
        }
    } catch (e) {
        console.log('⚠️ chrome.runtime.sendMessage 失败:', e.message);
    }

    console.log('⚠️ 所有通知方式均失败，尝试查找发品助手标签页...');
    try {
        const tabs = await chrome.tabs.query({ url: '*://*/发品助手.html', currentWindow: true });
        if (tabs.length > 0) {
            assistantTabId = tabs[0].id;
            await chrome.tabs.sendMessage(assistantTabId, { action: 'colorTaskComplete', rowNum });
            console.log('✅ 通过查找标签页成功通知发品助手');
            return;
        }
    } catch (e) {
        console.log('⚠️ 查找标签页并通知失败:', e.message);
    }

    try {
        const tabs = await chrome.tabs.query({ url: 'file://*/*发品助手.html', currentWindow: true });
        if (tabs.length > 0) {
            assistantTabId = tabs[0].id;
            console.log('📌 找到发品助手标签页:', assistantTabId);
            try {
                await chrome.tabs.sendMessage(assistantTabId, { action: 'colorTaskComplete', rowNum });
                console.log('✅ 通过 tabs.sendMessage 成功通知发品助手');
                return;
            } catch (e) {
                console.log('⚠️ tabs.sendMessage 仍失败，尝试重新建立连接...');
            }
        }
    } catch (e) {
        console.log('⚠️ 查找 file:// 标签页失败:', e.message);
    }

    console.log('❌ 无法通知发品助手，换色任务完成消息丢失');
}

async function downloadViaFetch(url, filename, rowNum, relativePath) {
    try {
        console.log(`🔄 使用 fetch 方式下载: ${filename}`);
        const response = await fetch(url, {
            headers: { 'Referer': 'https://www.doubao.com/' }
        });
        if (!response.ok) throw new Error('HTTP ' + response.status);

        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);

        const colorMatch = filename.match(/_(white|black|gray|navy)\./);
        if (colorMatch) {
            const color = colorMatch[1];
            const reader = new FileReader();
            reader.onloadend = () => {
                const dataUrl = reader.result;
                const idbKey = colorImageIDBKey(CURRENT_FILENAME, rowNum, color);
                saveColorImageToIDB(idbKey, dataUrl).then(() => {
                    console.log(`💾 颜色图已存 IndexedDB: ${idbKey}`);
                });
            };
            reader.readAsDataURL(blob);
        }

        return new Promise((resolve) => {
            chrome.downloads.download({
                url: blobUrl,
                filename: relativePath,
                conflictAction: 'overwrite',
                saveAs: false
            }, (downloadId) => {
                if (chrome.runtime.lastError) {
                    URL.revokeObjectURL(blobUrl);
                    resolve({ ok: false, error: chrome.runtime.lastError.message });
                    return;
                }

                const onChanged = (delta) => {
                    if (delta.id !== downloadId) return;
                    if (delta.state && delta.state.current === 'complete') {
                        chrome.downloads.search({ id: downloadId }, (items) => {
                            URL.revokeObjectURL(blobUrl);
                            if (items && items[0]) {
                                const fullPath = items[0].filename;
                                const storageKey = colorKey(rowNum);
                                const colorMatch = filename.match(/_(white|black|gray|navy)\./);
                                console.log(`💾 下载完成(fetch): ${filename} → ${fullPath}, storageKey=${storageKey}, colorMatch=`, colorMatch);
                                chrome.downloads.onChanged.removeListener(onChanged);
                                
                                if (colorMatch) {
                                    const color = colorMatch[1];
                                    chrome.storage.local.get(storageKey, (result) => {
                                        const images = result[storageKey] || {};
                                        images[color] = { url, path: fullPath };
                                        chrome.storage.local.set({ [storageKey]: images }, () => {
                                            console.log(`💾 已保存颜色图(fetch): row${rowNum}/${color} → ${fullPath}`);
                                            resolve({ ok: true, filename, path: fullPath });
                                        });
                                    });
                                } else {
                                    console.warn(`⚠️ 颜色匹配失败(fetch): ${filename}`);
                                    resolve({ ok: true, filename, path: fullPath });
                                }
                            }
                        });
                    }
                    if (delta.error) {
                        URL.revokeObjectURL(blobUrl);
                        chrome.downloads.onChanged.removeListener(onChanged);
                        resolve({ ok: false, error: delta.error.current });
                    }
                };
                chrome.downloads.onChanged.addListener(onChanged);

                setTimeout(() => {
                    URL.revokeObjectURL(blobUrl);
                    chrome.downloads.onChanged.removeListener(onChanged);
                    resolve({ ok: false, error: '下载超时' });
                }, 60000);
            });
        });
    } catch (e) {
        console.error('❌ fetch 下载失败:', e.message);
        return { ok: false, error: e.message };
    }
}

async function fetchColorImageAsBase64(rowNum, color) {
    try {
        const idbKey = colorImageIDBKey(CURRENT_FILENAME, rowNum, color);
        const cached = await getColorImageFromIDB(idbKey);
        if (cached) {
            console.log(`✅ 颜色图从 IndexedDB 命中: ${idbKey}`);
            return { ok: true, dataUrl: cached };
        }

        const storageKey = colorKey(rowNum);
        let result = await new Promise((resolve) => {
            chrome.storage.local.get(storageKey, (r) => resolve(r));
        });
        let images = result[storageKey] || {};
        if (Object.keys(images).length === 0) {
            const legacyKey = 'color_images_row_' + rowNum;
            const legacyResult = await new Promise((resolve) => {
                chrome.storage.local.get(legacyKey, (r) => resolve(r));
            });
            const legacyImages = legacyResult[legacyKey] || {};
            if (Object.keys(legacyImages).length > 0) {
                await new Promise((resolve) => {
                    chrome.storage.local.set({ [storageKey]: legacyImages }, () => resolve());
                });
                chrome.storage.local.remove(legacyKey);
                console.log(`🔄 已迁移颜色图数据: ${legacyKey} → ${storageKey}`);
                images = legacyImages;
            }
        }
        const imgData = images[color];
        const url = typeof imgData === 'string' ? imgData : imgData?.url;
        if (!url) return { ok: false, error: '图片URL不存在' };

        const response = await fetch(url, {
            headers: {
                'Referer': 'https://www.doubao.com/'
            }
        });
        if (!response.ok) return { ok: false, error: 'HTTP ' + response.status };

        const blob = await response.blob();
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => {
                const dataUrl = reader.result;
                saveColorImageToIDB(idbKey, dataUrl).then(() => {
                    console.log(`💾 颜色图缓存到 IndexedDB: ${idbKey}`);
                });
                resolve({ ok: true, dataUrl });
            };
            reader.onerror = () => {
                resolve({ ok: false, error: '读取失败' });
            };
            reader.readAsDataURL(blob);
        });
    } catch (e) {
        return { ok: false, error: e.message };
    }
}

const PS_SAVE_MARKER = 'http://ps-edit-save.local/save';
let psEditState = null;

/**
 * 等待指定标签页加载完成。
 * @param {number} tabId - 要监听的标签页 ID。
 * @param {number} [timeoutMs=30000] - 超时时间（毫秒）。
 * @returns {Promise<void>}
 */
function waitForTabComplete(tabId, timeoutMs = 30000) {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            chrome.tabs.onUpdated.removeListener(onUpdated);
            reject(new Error(`标签页 ${tabId} 加载超时（${timeoutMs}ms）`));
        }, timeoutMs);

        /**
         * @param {number} updatedTabId
         * @param {object} changeInfo
         */
        function onUpdated(updatedTabId, changeInfo) {
            if (updatedTabId !== tabId) return;
            if (changeInfo.status === 'complete') {
                clearTimeout(timer);
                chrome.tabs.onUpdated.removeListener(onUpdated);
                resolve();
            }
        }

        chrome.tabs.onUpdated.addListener(onUpdated);

        // 立即检查当前状态，防止监听器添加前页面已加载完成
        chrome.tabs.get(tabId).then(tab => {
            if (tab && tab.status === 'complete') {
                clearTimeout(timer);
                chrome.tabs.onUpdated.removeListener(onUpdated);
                resolve();
            }
        }).catch(() => {
            // tab 不存在，由超时或后续事件处理
        });
    });
}

async function startPsEdit(task) {
    const { imageDataUrl, fileName, rowNum, imageDir } = task;
    const baseFileName = fileName.replace(/\.(jpg|jpeg|png|gif|webp)$/i, '');
    console.log('🖌️ 启动PS编辑:', { fileName, baseFileName, rowNum });

    const config = {
        files: [imageDataUrl],
        server: {
            version: 1,
            url: PS_SAVE_MARKER,
            formats: ['png']
        },
        script: `app.activeDocument.name = "${baseFileName}";`
    };
    const hash = encodeURIComponent(JSON.stringify(config));
    const url = `https://www.photopea.com#${hash}`;

    const tab = await chrome.tabs.create({ url, active: true });
    const tabId = tab.id;

    psEditState = {
        tabId,
        fileName,
        rowNum,
        imageDir: imageDir || IMAGE_DIR,
        saved: false
    };

    try {
        await waitForTabComplete(tabId, 30000);
    } catch (e) {
        console.error('❌ 等待Photopea加载失败:', e.message);
        return { ok: false, error: e.message };
    }

    try {
        await chrome.tabs.get(tabId);

        console.log('[PS编辑] 开始注入拦截脚本到 MAIN world...');
        await chrome.scripting.executeScript({
            target: { tabId },
            world: 'MAIN',
            func: injectFetchInterceptor,
            args: [PS_SAVE_MARKER, fileName]
        });
        console.log('[PS编辑] MAIN world 脚本注入成功');

        console.log('[PS编辑] 开始注入消息桥到 ISOLATED world...');
        await chrome.scripting.executeScript({
            target: { tabId },
            world: 'ISOLATED',
            func: injectMessageBridge
        });
        console.log('[PS编辑] ISOLATED world 消息桥注入成功');

        console.log('✅ PS编辑页面已打开，拦截脚本已注入');
        return { ok: true, tabId };
    } catch (e) {
        let errorMsg = e.message;
        if (e.message && e.message.includes('No tab with id')) {
            errorMsg = '标签页已被关闭';
        } else if (e.message && e.message.includes('Cannot access contents')) {
            errorMsg = '无法访问页面内容，请检查扩展权限';
        }
        console.error('❌ 注入脚本失败:', errorMsg);
        return { ok: false, error: errorMsg };
    }
}

function injectFetchInterceptor(markerUrl, fileName) {
    window.__psEditFileName = fileName;
    const originalFetch = window.fetch;
    window.fetch = function(...args) {
        const url = args[0];
        if (typeof url === 'string' && url === markerUrl) {
            const request = args[1] || {};
            const body = request.body;
            if (body) {
                const reader = new FileReader();
                reader.onload = () => {
                    window.postMessage({
                        type: 'PS_EDIT_SAVE',
                        data: reader.result
                    }, '*');
                };
                reader.readAsArrayBuffer(body);
            }
            return new Response(JSON.stringify({ message: 'ok' }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            });
        }
        return originalFetch.apply(this, args);
    };

    const originalXHRSend = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.send = function(body) {
        if (this._url === markerUrl || this.responseURL === markerUrl) {
            if (body) {
                const reader = new FileReader();
                reader.onload = () => {
                    window.postMessage({
                        type: 'PS_EDIT_SAVE',
                        data: reader.result
                    }, '*');
                };
                reader.readAsArrayBuffer(body);
            }
            Object.defineProperty(this, 'status', { value: 200 });
            Object.defineProperty(this, 'responseText', { value: JSON.stringify({ message: 'ok' }) });
            Object.defineProperty(this, 'readyState', { value: 4 });
            if (this.onreadystatechange) this.onreadystatechange();
            if (this.onload) this.onload();
            return;
        }
        return originalXHRSend.apply(this, arguments);
    };

    const originalXHROpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function(method, url) {
        this._url = url;
        return originalXHROpen.apply(this, arguments);
    };



    if ('showOpenFilePicker' in window) {
        const originalShowOpenFilePicker = window.showOpenFilePicker;
        window.showOpenFilePicker = function() {
            return originalShowOpenFilePicker.apply(this, arguments);
        };
    }

    const originalCreateObjectURL = URL.createObjectURL;
    URL.createObjectURL = function(blob) {
        const url = originalCreateObjectURL.call(this, blob);
        console.log('[PS拦截] URL.createObjectURL 被调用', blob.type, blob.size);
        return url;
    };

    document.addEventListener('click', function(e) {
        const target = e.target.closest('a[download]');
        if (target && target.href && target.href.startsWith('blob:')) {
            console.log('[PS拦截] 拦截到 download 链接点击，href:', target.href);
            e.preventDefault();
            e.stopPropagation();
            fetch(target.href)
                .then(res => res.blob())
                .then(blob => {
                    console.log('[PS拦截] fetch blob 成功，type:', blob.type, 'size:', blob.size);
                    const reader = new FileReader();
                    reader.onload = function() {
                        const arrayBuffer = reader.result;
                        const uint8 = new Uint8Array(arrayBuffer);
                        let format = 'png';
                        if (uint8.length > 2 && uint8[0] === 0xFF && uint8[1] === 0xD8) {
                            format = 'jpg';
                        } else if (uint8.length > 8 && uint8[0] === 0x89 && uint8[1] === 0x50) {
                            format = 'png';
                        } else if (uint8.length > 12 && uint8[8] === 0x57 && uint8[9] === 0x45 && uint8[10] === 0x42 && uint8[11] === 0x50) {
                            format = 'webp';
                        }
                        console.log('[PS拦截] 图片数据读取完成，格式:', format);
                        const targetFileName = window.__psEditFileName || 'image.' + format;
                        console.log('[PS拦截] 准备保存文件:', targetFileName);
                        const blob = new Blob([uint8], { type: format === 'png' ? 'image/png' : format === 'jpg' ? 'image/jpeg' : 'image/webp' });
                        
                        async function saveFile(dirHandle, fileName, blobData) {
                            try {
                                const fileHandle = await dirHandle.getFileHandle(fileName, { create: true });
                                const writable = await fileHandle.createWritable();
                                await writable.write(blobData);
                                await writable.close();
                                console.log('[PS拦截] ✅ 文件保存成功:', fileName);
                                alert('✅ PS编辑图片已保存: ' + fileName);
                            } catch (e) {
                                console.error('[PS拦截] ❌ 文件保存失败:', e);
                                alert('❌ 保存失败: ' + e.message);
                            }
                        }
                        
                        async function getDirHandle() {
                            if (window.__psEditDirHandle) {
                                const perm = await window.__psEditDirHandle.queryPermission({ mode: 'readwrite' });
                                if (perm === 'granted') return window.__psEditDirHandle;
                                const requested = await window.__psEditDirHandle.requestPermission({ mode: 'readwrite' });
                                if (requested === 'granted') return window.__psEditDirHandle;
                            }
                            
                            // 尝试从 IndexedDB 恢复句柄
                            try {
                                const db = await new Promise((resolve, reject) => {
                                    const req = indexedDB.open('ps_edit_handles', 1);
                                    req.onupgradeneeded = () => req.result.createObjectStore('handles');
                                    req.onsuccess = () => resolve(req.result);
                                    req.onerror = () => reject(req.error);
                                });
                                const savedHandle = await new Promise((resolve) => {
                                    const tx = db.transaction('handles', 'readonly');
                                    const req = tx.objectStore('handles').get('dir');
                                    req.onsuccess = () => resolve(req.result || null);
                                    req.onerror = () => resolve(null);
                                });
                                if (savedHandle) {
                                    console.log('[PS拦截] 从IndexedDB恢复目录句柄');
                                    const perm = await savedHandle.queryPermission({ mode: 'readwrite' });
                                    if (perm === 'granted') {
                                        window.__psEditDirHandle = savedHandle;
                                        return savedHandle;
                                    }
                                    const requested = await savedHandle.requestPermission({ mode: 'readwrite' });
                                    if (requested === 'granted') {
                                        window.__psEditDirHandle = savedHandle;
                                        return savedHandle;
                                    }
                                }
                            } catch (e) {
                                console.warn('[PS拦截] IndexedDB恢复失败:', e);
                            }
                            
                            // 首次使用，弹出选择
                            console.log('[PS拦截] 需要选择目录');
                            const dirHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
                            window.__psEditDirHandle = dirHandle;
                            
                            // 存储到 IndexedDB
                            try {
                                const db = await new Promise((resolve, reject) => {
                                    const req = indexedDB.open('ps_edit_handles', 1);
                                    req.onupgradeneeded = () => req.result.createObjectStore('handles');
                                    req.onsuccess = () => resolve(req.result);
                                    req.onerror = () => reject(req.error);
                                });
                                const tx = db.transaction('handles', 'readwrite');
                                tx.objectStore('handles').put(dirHandle, 'dir');
                                console.log('[PS拦截] 目录句柄已存储到IndexedDB');
                            } catch (e) {
                                console.warn('[PS拦截] IndexedDB存储失败:', e);
                            }
                            return dirHandle;
                        }
                        
                        getDirHandle().then(dirHandle => {
                            saveFile(dirHandle, targetFileName, blob);
                        }).catch(err => {
                            console.error('[PS拦截] 获取目录失败:', err);
                        });
                    };
                    reader.readAsArrayBuffer(blob);
                })
                .catch(err => console.error('[PS拦截] fetch blob 失败:', err));
        }
    }, true);

    const originalCreateElement = document.createElement;
    document.createElement = function(tagName) {
        const element = originalCreateElement.call(this, tagName);
        if (tagName.toLowerCase() === 'a') {
            const originalSetAttribute = element.setAttribute.bind(element);
            element.setAttribute = function(name, value) {
                if (name === 'download') {
                    console.log('[PS拦截] 创建了带 download 属性的 a 标签');
                }
                originalSetAttribute(name, value);
            };
        }
        return element;
    };

    const originalOpen = window.open;
    window.open = function(url, name, features) {
        if (typeof url === 'string' && url.startsWith('blob:')) {
            console.log('[PS拦截] window.open 打开 blob URL:', url);
            fetch(url)
                .then(res => res.blob())
                .then(blob => {
                    if (blob.type.startsWith('image/')) {
                        const reader = new FileReader();
                        reader.onload = function() {
                            const arrayBuffer = reader.result;
                            const uint8 = new Uint8Array(arrayBuffer);
                            let format = 'png';
                            if (uint8.length > 2 && uint8[0] === 0xFF && uint8[1] === 0xD8) {
                                format = 'jpg';
                            } else if (uint8.length > 8 && uint8[0] === 0x89 && uint8[1] === 0x50) {
                                format = 'png';
                            }
                            window.postMessage({
                                type: 'PS_EDIT_SAVE_FSA',
                                data: arrayBuffer,
                                fileName: 'image.' + format
                            }, '*');
                        };
                        reader.readAsArrayBuffer(blob);
                    }
                })
                .catch(err => console.error('[PS拦截] fetch blob URL 失败:', err));
        }
        return originalOpen.apply(this, arguments);
    };
}

function injectMessageBridge() {
    console.log('[PS拦截] 消息桥已注册');
    window.addEventListener('message', (event) => {
        if (event.data && event.data.type === 'PS_EDIT_SAVE') {
            console.log('[PS拦截] 收到 PS_EDIT_SAVE 消息');
            chrome.runtime.sendMessage('oeddlfchihjeajlacggmnldilalpbcmi', {
                action: 'psEditSave',
                data: event.data.data
            });
        }
        if (event.data && event.data.type === 'PS_EDIT_SAVE_FSA') {
            console.log('[PS拦截] 收到 PS_EDIT_SAVE_FSA 消息，format:', event.data.format, 'rowNum:', event.data.rowNum, 'fileName:', event.data.fileName);
            chrome.runtime.sendMessage('oeddlfchihjeajlacggmnldilalpbcmi', {
                action: 'psEditSaveFsa',
                data: event.data.data,
                format: event.data.format,
                rowNum: event.data.rowNum,
                fileName: event.data.fileName
            });
        }
    });
}

function parsePsSaveData(arrayBuffer) {
    try {
        const uint8 = new Uint8Array(arrayBuffer);
        const jsonPad = 2000;
        const headerBytes = uint8.slice(0, jsonPad);
        let jsonStr = '';
        for (let i = 0; i < headerBytes.length; i++) {
            if (headerBytes[i] === 0) break;
            jsonStr += String.fromCharCode(headerBytes[i]);
        }
        jsonStr = jsonStr.replace(/\0/g, '').trim();
        const jsonEnd = jsonStr.lastIndexOf('}');
        if (jsonEnd === -1) return null;
        const meta = JSON.parse(jsonStr.slice(0, jsonEnd + 1));

        const versions = meta.versions || [];
        const pngVer = versions.find(v => v.format === 'png' || v.format === 'jpg');
        if (!pngVer) return null;

        const imgStart = jsonPad + pngVer.start;
        const imgEnd = imgStart + pngVer.size;
        const imgData = uint8.slice(imgStart, imgEnd);

        return { meta, imgData, format: pngVer.format };
    } catch (e) {
        console.error('解析PS保存数据失败:', e);
        return null;
    }
}

async function handlePsEditSave(arrayBuffer) {
    if (!psEditState || psEditState.saved) return;

    const parsed = parsePsSaveData(arrayBuffer);
    if (!parsed) {
        console.error('❌ 解析PS保存数据失败');
        return;
    }

    const { imgData, format } = parsed;
    const { fileName, rowNum } = psEditState;

    psEditState.saved = true;
    console.log('✅ PS编辑完成，准备发送回页面:', fileName);

    const uint8Array = Array.from(imgData);

    chrome.runtime.sendMessage(EXTENSION_ID, {
        action: 'psEditComplete',
        rowNum,
        fileName,
        imgData: uint8Array,
        format
    }).catch(() => {});
}

const EXTENSION_ID = 'oeddlfchihjeajlacggmnldilalpbcmi';

const PS_EDIT_RESULT_KEY = 'ps_edit_result';

async function handlePsEditSaveFsa(data, fileName) {
    console.log('[PS编辑] handlePsEditSaveFsa 被调用，psEditState:', psEditState);
    if (!psEditState || psEditState.saved) {
        console.log('[PS编辑] psEditState 无效或已保存');
        return;
    }

    let uint8;
    if (typeof data === 'string') {
        console.log('[PS编辑] 收到base64数据，长度:', data.length);
        const binary = atob(data);
        uint8 = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
            uint8[i] = binary.charCodeAt(i);
        }
    } else {
        uint8 = new Uint8Array(data);
    }
    let format = 'png';
    if (uint8.length > 2 && uint8[0] === 0xFF && uint8[1] === 0xD8) {
        format = 'jpg';
    } else if (uint8.length > 8 && uint8[0] === 0x89 && uint8[1] === 0x50) {
        format = 'png';
    }

    const { rowNum } = psEditState;
    psEditState.saved = true;
    console.log('✅ PS编辑完成(FSA方式)，准备保存结果:', fileName, 'format:', format, 'rowNum:', rowNum, '数据大小:', uint8.length);

    const uint8Array = Array.from(uint8);

    const result = {
        rowNum,
        fileName: psEditState.fileName,
        imgData: uint8Array,
        format,
        timestamp: Date.now()
    };

    chrome.storage.local.set({ [PS_EDIT_RESULT_KEY]: result }, () => {
        console.log('[PS编辑] 结果已保存到 storage');
    });

    chrome.runtime.sendMessage(EXTENSION_ID, {
        action: 'psEditComplete',
        ...result
    }).catch(() => {});
}

