# Page3 主图上传问题修复

## 背景

Page3 主图上传功能存在 3 个问题：
1. 菜单项点击后误判"未完成"——上传是异步操作，但菜单项用同步结果判断
2. 图片数量检测不准——检测选择器太宽泛，1 张图被统计成 8 张
3. 部分日志文案技术术语过重，用户看不懂

## 设计原因

1. **菜单项异步结果判断**：`fillImagesPage3` 当前发完 `chrome.runtime.sendMessage` 就返回，结果中只有 `⏳` 前缀的信息项，没有 `✅`。菜单项的 `hasSuccess` 判断逻辑认为没有成功项，输出"未完成"。实际上传还在后台进行。
2. **图片数量虚高**：`waitForPage3UploadImages` 使用 `querySelectorAll('img, .image-upload-list-item, ...')` 统计，把装饰图标、占位符图标、视频图标等都算进去了。
3. **日志不友好**：`upload-select-inner: true` 等技术术语直接输出给用户。

## 设计优点

1. **菜单项结果准确**：上传主图等异步操作，菜单项会等待最终结果再判断，不再误判"未完成"
2. **图片检测更准确**：只统计真实上传成功的图片项，排除装饰图标
3. **日志更易懂**：技术术语替换为用户友好的描述

## 能力边界

### 能做什么

- 菜单项点击"上传主图"后，等待上传完成再显示"完成/失败"
- 上传图片数量检测只统计真实图片（带文件名的上传项）
- 日志文案更易读

### 不能做什么

- 不改变上传方式（仍然是 CDP DOM.setFileInputFiles + 多级降级）
- 不改变 `fillAllPage3` 全量填入中上传主图的异步行为（全量填入不需要等单张图传完）
- 不修复 1688 页面本身的 `[object Object]` 警告
- 不改变 page2 的上传逻辑

## 改动范围

| 文件 | 改动点 |
|---|---|
| `chrome_extension/content/page3.js` | `fillImagesPage3` 改为异步等待 `uploadResult` 消息的 Promise 模式 |
| `chrome_extension/upload/page3_upload.js` | `waitForPage3UploadImages` 检测逻辑优化；日志文案优化 |
| `tests/test-page3-image-upload.js` | 新增测试文件 |
