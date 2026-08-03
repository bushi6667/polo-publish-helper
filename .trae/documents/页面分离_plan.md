# 页面代码分离实施计划

> **目标**：把页1、页2、页3的代码彻底分开，改一个页面绝不影响另一个页面。

## 现状问题

当前所有页面逻辑全部混在 [content.js](file:///D:/1/doubao_tool/测试文件/xlsx发品/chrome_extension/content.js) 里，用 `isPage1()` / `isPage3()` 做判断分支：
- 页1：`easyListing.htm`（标题、主图、类目）
- 页2/页3：`publish.htm`（详细发布页，当前代码里叫 isPage3）

上传逻辑在 [background.js](file:///D:/1/doubao_tool/测试文件/xlsx发品/chrome_extension/background.js) 里是一个大函数 `uploadMainImageViaCDP()`，两个页面共用。

**问题**：改上传逻辑会同时影响两个页面，容易改坏。

---

## 分离方案

### 目录结构
```
chrome_extension/
├── manifest.json          # 按URL分别注入不同的content script
├── background.js          # 消息路由 + 分发到各页面上传函数
├── common.js                # 公共工具（保留原background用）
├── content/
│   ├── common.js          # 公共工具函数（setInputValue、log等）
│   ├── page1.js          # 页1专属：面板 + 填表 + 上传调用
│   ├── page2.js          # 页2专属：面板 + 填表 + 上传调用
│   └── page3.js          # 页3预留（空文件占位，以后加）
└── upload/
    ├── page1_upload.js    # 页1专属上传逻辑
    ├── page2_upload.js    # 页2专属上传逻辑
    └── page3_upload.js    # 页3预留
```

### 核心原则
1. **每个页面一个独立的 content.js 文件**，通过 manifest 按 URL 匹配注入
2. **每个页面一个独立的上传函数**，互不调用方式相同但实现独立
3. **公共工具函数**（setInputValue、log、findFieldContainer 等）抽成 `common.js`，每个页面都加载
4. **background.js 只做消息路由**，收到上传请求时根据页面类型分发到对应页面的上传函数

---

## 具体步骤

### 第一步：抽离公共工具函数
- 从 content.js 抽出公共函数到 `content/common.js`：
  - `log()`
  - `setInputValue()`
  - `nativeMouseClick()`
  - `findFieldContainer()`
  - `setAutoComplete()`
  - `closeOverlays()`
  - `setSearchDropdown()`
  - `setTagClick()`
  - `getCategoryKeywords()`
  - `selectCategory()`
  - `generateKwFromProduct()`
  - `updateProductInfo()`
  - `loadFromClipboard()`

### 第二步：页1独立文件
新建 `content/page1.js`，包含：
- 页1面板创建（createPanel 的页1分支）
- `autoFillPage1()` 函数
- 页1专属的按钮事件绑定
- 初始化逻辑（只在页1运行）

### 第三步：页2独立文件
新建 `content/page2.js`，包含：
- 页2面板创建（createPanel 的页2分支，即原来的 isPage3 逻辑）
- `fillAllPage3()` 函数（改名叫 fillAllPage2
- 页2专属的按钮事件绑定
- 初始化逻辑（只在页2运行）

### 第四步：页3预留
新建 `content/page3.js`（空文件，加个占位）

### 第五步：上传逻辑分离
把 `uploadMainImageViaCDP()` 拆成：
- `upload/page1_upload.js` — 页1专属上传
- `upload/page2_upload.js` — 页2专属上传
- `upload/page3_upload.js` — 页3预留

background.js 根据消息里加 `pageType` 参数，分发到对应上传函数

### 第六步：更新 manifest.json
```json
"content_scripts": [
  {
    "matches": ["*://post.alibaba.com/product/easyListing*"],
    "js": ["content/common.js", "content/page1.js"],
    "run_at": "document_end"
  },
  {
    "matches": ["*://post.alibaba.com/product/publish*"],
    "js": ["content/common.js", "content/page2.js"],
    "run_at": "document_end"
  }
]
```

### 第七步：验证
- 页1功能正常：标题填写、主图上传、类目选择
- 页2功能正常：所有字段填写、下拉菜单等
- 改页1不影响页2，改页2不影响页1

---

## 风险与注意事项
1. **公共函数抽离时要确保不遗漏依赖
2. **消息传递格式要统一，pageType 参数要传对
3. **文件路径变化后要在 chrome://extensions 刷新扩展
4. **每个页面的 STORAGE_KEY 共用，各页面读取同一份产品数据
