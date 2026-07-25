# 修复商品分组两次点击取消选中的问题

## 背景

商品分组选择时，日志显示 ✅ 已匹配到选项，但实际没生效。

根因：DOM 节点 `.next-tree-node-inner` 的点击是**切换行为**（点一次选中，再点一次取消）。代码中连续点击了两次，导致选中又被取消。从实际 DOM 看，`aria-selected` 属性在第一次点击后变为 `"true"`，第二次点击又变回 `"false"`。

## 设计原因

1. 当前代码对 `.next-tree-node-inner` 点击了两次，不符合其 toggle 交互模式
2. 缺少选中校验，无法知道点击是否生效
3. 缺少降级机制，`realClick` 失效时无后备

## 设计优点

1. 只点一次，符合 DOM 交互行为
2. 点击后校验 `aria-selected="true"`，确保选中成功
3. 校验失败时使用 `nativeMouseClick` 降级
4. 确认选中后再关闭弹窗，避免时序问题

## 能力边界

### 能做什么

- 正确选中商品分组（T-Shirts/Shirts/Polo/Hoodies/Jackets/Vest/Pants）
- 选中后校验 `aria-selected` 属性
- 有降级机制处理 `realClick` 失效的情况

### 不能做什么

- 不改类目映射逻辑（`buildGroupCandidates`）
- 不涉及多级树展开（当前所有节点在 level 1）
- 不改 `fillAllPage3` 全量填入中的调用方式

## 改动范围

| 文件 | 改动点 |
|---|---|
| `chrome_extension/content/page3.js` | `fillGroupPage3` 第 1141-1148 行 |
| `tests/test-page3-group-fix.js` | 新增测试 |

## 详细设计

### 改动点

```js
// 改前：点两次
if (treeItem) {
    await realClick(treeItem);
    await sleep3(500);
    await realClick(treeItem);  // 取消选中
}

// 改后：点一次 + 校验 + 降级
if (treeItem) {
    await realClick(treeItem);
    await sleep3(500);
    if (treeItem.getAttribute('aria-selected') !== 'true') {
        await nativeMouseClick(treeItem);
        await sleep3(500);
    }
}
```
