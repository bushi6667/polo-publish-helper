# 页3 商品分组匹配误命中修复（group-match-fix）

> 状态：方案定稿，待实施
> 对应文件：`chrome_extension/content/page3.js`（fillGroupPage3 的选项匹配逻辑）

## 设计原因（为什么改）

实际运行日志暴露 bug：

```
📋 分组候选词: Shirts            ← 类目为衬衫，候选词正确
🔍 匹配到分组选项: "T-Shirts" (通过"Shirts")   ← 误命中
✅ 商品分组 = T-Shirts          ← 衬衫被选成了 T 恤分组
```

**根因**：`fillGroupPage3` 的选项匹配用包含匹配
（`t.toLowerCase() === tLower || t.toLowerCase().includes(tLower)`），
而 `"T-Shirts".includes("shirts")` 为 true——短候选词 "Shirts"/"Vest" 等
会误命中更具体的类目选项（T-Shirts / Polo Shirts 等），导致**商品分组选错**。

## 设计优点（改后带来什么）

1. **精确优先**：页面存在完全一致的选项（如 "Shirts"）时直接命中，杜绝误选
2. **更具体类目排除**：候选词是另一类目词的子串时（Shirts ⊂ T-Shirts / Polo Shirts），
   若选项含候选词不含的"具体类目关键词"（t-shirt/polo/hoodie/...）则拒绝该选项
3. **保留合理的包含匹配**：候选词是选项的合理子串时仍能命中
   （"Polo" → "Polo Shirts"、"Vest" → "Men's Vest"、"Hoodies" → "Hoodies & Sweatshirts"），
   不影响现有短词匹配能力

## 能力边界（能做什么/不能做什么）

**能**：
- 修复 "Shirts" 误命中 "T-Shirts" / "Polo Shirts" 的选错问题
- 保持精确、开头+空格、合理包含三种匹配能力

**不能**：
- 无法解决"页面分组选项本身缺失目标类目"的情况（此时报"未找到匹配选项"，
  提示用户手动选择，比选错安全）
- 关键词排除表（specificKws）需随实际类目扩展维护；新增品类（如裙子/童装）时
  需同步补充，否则该类目间若存在子串关系仍可能误命中（当前覆盖上装/裤装品类）

## 匹配规则（最终实现）

```
1. 精确相等（大小写不敏感）           → 命中
2. 选项以 "候选词+空格" 开头          → 命中（如 "Shirts" → "Shirts Long Sleeve"）
3. 选项包含候选词                     → 需过"更具体类目排除"：
     若选项含 specificKws 中某词而候选词不含 → 拒绝（误命中）
     否则命中
4. 都不满足                          → 不匹配
```

specificKws = ['t-shirt', 't shirts', 'polo', 'hoodie', 'sweatshirt', 'jacket', 'vest', 'pants', 'trouser']

## 测试计划

新增 `tests/test-page3-group-match.js`（独立实现 matchGroupOption 纯逻辑，遵循项目惯例）：
- 核心回归：`matchGroupOption('T-Shirts', 'shirts') === false`、`matchGroupOption('Polo Shirts', 'shirts') === false`
- 精确命中：`matchGroupOption('Shirts', 'shirts') === true`
- 合理包含保留：`('Polo Shirts', 'polo') === true`、`("Men's Vest", 'vest') === true`、`('Hoodies & Sweatshirts', 'hoodies') === true`
- 开头匹配：`('Shirts Long Sleeve', 'shirts') === true`
- 反向不匹配：`('Shirts', 't-shirts') === false`
- 空值兜底
