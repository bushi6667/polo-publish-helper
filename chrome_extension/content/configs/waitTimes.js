// 等待时间配置 - 统一管理所有setTimeout等待时间
//
// 依赖:
//   - 无 (纯配置文件，仅导出配置和wait函数)

/**
 * 等待时间配置(稳定模式)
 * 适用于网络较慢、页面渲染较慢的场景
 */
const waitTimesStable = {
    modeFactor: 1.0,      // 整体等待时长系数（稳定=1.0）
    scroll: {
        before: 150,      // 滚动前等待
        after: 300,       // 滚动后等待渲染
        between: 200      // 多次滚动间隔
    },
    dropdown: {
        open: 900,        // 下拉展开等待
        inputChar: 80,    // 每个字符输入间隔
        searchResult: 450, // 搜索结果等待
        pollOption: 3000  // 选项轮询最大时间
    },
    field: {
        focus: 50,        // 获取焦点后等待
        clear: 50,        // 清空值后等待
        inputChar: 8,     // 每个字符输入间隔
        confirm: 200,     // 确认事件后等待
        blur: 300         // 失焦后等待
    },
    province: {
        maxWait: 5000,    // 省份字段最大等待时间
        interval: 200     // 省份轮询间隔
    },
    color: {
        input: 8,         // 颜色输入字符间隔
        waitResult: 500,  // 颜色输入结果等待
        upload: 2000      // 图片上传等待
    },
    template: {
        open: 800,        // 模板下拉展开
        pollOption: 2000, // 模板选项轮询
        confirm: 800      // 确认对话框等待
    },
    overlay: {
        keydown: 80,      // 按下ESC后等待
        keyup: 120,       // 释放ESC后等待
        hide: 50          // 隐藏覆盖层后等待
    }
};

/**
 * 等待时间配置(快速模式)
 * 适用于网络良好、页面渲染快的场景
 */
const waitTimesFast = {
    modeFactor: 0.7,      // 整体等待时长系数（快速=0.7，缩短约三成）
    scroll: {
        before: 100,
        after: 200,
        between: 150
    },
    dropdown: {
        open: 500,
        inputChar: 50,
        searchResult: 300,
        pollOption: 2000
    },
    field: {
        focus: 30,
        clear: 30,
        inputChar: 5,
        confirm: 150,
        blur: 200
    },
    province: {
        maxWait: 3000,
        interval: 150
    },
    color: {
        input: 5,
        waitResult: 300,
        upload: 1500
    },
    template: {
        open: 500,
        pollOption: 1500,
        confirm: 500
    },
    overlay: {
        keydown: 50,
        keyup: 80,
        hide: 30
    }
};

/**
 * 当前使用的等待时间配置
 * 可通过setWaitMode切换
 */
let currentWaitTimes = waitTimesStable;

/**
 * 设置等待模式
 * @param {string} mode - 'stable' 或 'fast'
 */
function setWaitMode(mode) {
    if (mode === 'fast') {
        currentWaitTimes = waitTimesFast;
    } else {
        currentWaitTimes = waitTimesStable;
    }
}

/**
 * 获取当前等待时间配置
 * @returns {Object} 等待时间配置对象
 */
function getWaitTimes() {
    return currentWaitTimes;
}

/**
 * 通用等待函数
 * @param {number} ms - 等待毫秒数
 * @returns {Promise}
 */
function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// 导出
if (typeof window !== 'undefined') {
    window.waitTimes = {
        stable: waitTimesStable,
        fast: waitTimesFast,
        current: currentWaitTimes,
        setMode: setWaitMode,
        get: getWaitTimes,
        wait
    };
}