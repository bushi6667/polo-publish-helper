# PS编辑脚本注入可靠性修复 — 实施计划

## 变更范围

仅修改 `background.js` 中 `startPsEdit` 函数及其周边逻辑，不改动 `injectFetchInterceptor`、`injectMessageBridge` 等注入体函数。

## 实施步骤

### Step 1: 新增 `waitForTabComplete` 工具函数
- 封装 `chrome.tabs.onUpdated` 监听逻辑。
- 监听指定 `tabId`，当 `changeInfo.status === 'complete'` 时 resolve。
- 提供 `timeout` 参数（默认 30000ms），超时 reject。
- 监听期间若标签页被关闭，通过 `chrome.tabs.get` 检测并提前 reject。

### Step 2: 修改 `startPsEdit` 注入流程
- 删除固定 `await new Promise(r => setTimeout(r, 3000))`。
- 创建 Photopea 标签页后立即调用 `waitForTabComplete(tabId, 30000)`。
- 等待完成后，先通过 `chrome.tabs.get(tabId)` 确认标签页仍然存在。
- 再依次执行 MAIN world 和 ISOLATED world 的脚本注入。
- 细化 catch 错误信息：区分"标签页已关闭"、"加载超时"、"权限被拒绝"等场景。

### Step 3: 清理与格式检查
- 确保新增代码行宽不超过 120 字符。
- 去除尾随空格，确保文件末尾有换行。
- 为 `waitForTabComplete` 添加 JSDoc。

### Step 4: 编写测试
- 新建 `tests/test-psedit-injection.js`。
- 由于本项目暂无测试基础设施，参考 `测试文件2` 的 Node 测试风格，编写最小可运行测试：
  - 测试 `waitForTabComplete` 超时逻辑（使用模拟的 `chrome.tabs.onUpdated`）。
  - 测试注入前 tab 存在性检查逻辑。
- 若现有环境无法直接运行 Chrome API 测试，则编写可在 Node 环境下通过 mock 运行的单元测试。

### Step 5: 运行全量测试
- 执行项目根目录下所有 `tests/test-*.js`。
- 确保没有回归。

### Step 6: Git 提交
- 使用 `.git/COMMIT_MSG.txt` 写入提交信息。
- 提交信息格式：`fix(background): 修复PS编辑脚本注入时机，改为事件驱动等待页面加载完成`。

## 风险评估

- **低风险**：只改注入时机，不改注入体逻辑和 Photopea 交互协议。
- **注意点**：`chrome.tabs.onUpdated` 可能因同一 tab 多次导航而触发多次 `complete`，需确保只在首次 `complete` 时 resolve，并移除监听器避免内存泄漏。
