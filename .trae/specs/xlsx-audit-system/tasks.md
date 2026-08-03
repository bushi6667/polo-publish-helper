# XLSX产品数据审核系统 - 实施计划

## [x] Task 1: 构建品牌词黑名单数据结构
- **Priority**: high
- **Depends On**: None
- **Description**: 
  - 解析品牌商标黑名单.txt文件，提取所有品牌词和替换词
  - 构建一级风险（注册商标材质词、知名品牌名）和二级风险（需确认词汇）的数据结构
  - 实现完整词匹配算法，避免子串误报
- **Acceptance Criteria Addressed**: AC-1, AC-6
- **Test Requirements**:
  - `programmatic` TR-1.1: 能正确识别Coolmax、Lycra、Tencel等注册商标材质词
  - `programmatic` TR-1.2: "GU"不会匹配"Regular"中的子串
  - `programmatic` TR-1.3: 大小写不敏感检测（Nike/nike/NIKE都能识别）

## [x] Task 2: 构建材质大全数据结构
- **Priority**: high
- **Depends On**: None
- **Description**: 
  - 解析材质大全.txt文件，提取所有安全材质词
  - 构建材质分类数据结构（天然纤维、合成纤维、混纺、功能面料等）
  - 实现材质词模糊匹配和验证功能
- **Acceptance Criteria Addressed**: AC-2
- **Test Requirements**:
  - `programmatic` TR-2.1: 能正确匹配"棉"、"涤纶"、"天丝"等常见材质词
  - `programmatic` TR-2.2: 不在列表中的材质词能被标记为二级风险
  - `programmatic` TR-2.3: 支持中英文材质词匹配

## [x] Task 3: 实现审核核心逻辑
- **Priority**: high
- **Depends On**: Task 1, Task 2
- **Description**: 
  - 实现产品文案扫描功能，遍历标题、卖点、FAQ、材质等列
  - 集成品牌词检测和材质词验证逻辑
  - 实现风险分级标记功能（🔴一级/🟡二级/🟢安全）
- **Acceptance Criteria Addressed**: AC-1, AC-2, AC-3
- **Test Requirements**:
  - `programmatic` TR-3.1: 能扫描所有指定列（标题、卖点、FAQ、材质等）
  - `programmatic` TR-3.2: 能正确标记一级风险和二级风险词汇
  - `programmatic` TR-3.3: 100行数据审核时间不超过3秒

## [x] Task 4: 实现审核报告生成功能
- **Priority**: high
- **Depends On**: Task 3
- **Description**: 
  - 实现审核报告生成逻辑，按规范格式输出
  - 包含汇总统计、一级风险详情、二级风险详情、修改建议
  - 支持按行号和列名定位问题位置
- **Acceptance Criteria Addressed**: AC-4
- **Test Requirements**:
  - `human-judgment` TR-4.1: 报告格式符合XLSX审核提示词中的规范
  - `human-judgment` TR-4.2: 问题位置描述清晰，包含行号和列名
  - `programmatic` TR-4.3: 报告能正确统计各风险等级数量

## [x] Task 5: 集成审核界面到发品助手
- **Priority**: medium
- **Depends On**: Task 4
- **Description**: 
  - 在发品助手页面添加"审核"标签页
  - 实现审核按钮和审核结果展示区域
  - 实现问题定位跳转功能（点击问题跳转到对应产品）
- **Acceptance Criteria Addressed**: AC-3, AC-4
- **Test Requirements**:
  - `human-judgment` TR-5.1: 审核标签页界面清晰，操作便捷
  - `human-judgment` TR-5.2: 风险等级颜色区分明显
  - `programmatic` TR-5.3: 点击问题能正确跳转到对应产品

## [x] Task 6: 测试和优化
- **Priority**: medium
- **Depends On**: Task 5
- **Description**: 
  - 使用真实Excel数据进行测试
  - 优化审核性能，确保100行数据审核时间不超过3秒
  - 修复误报和漏报问题
- **Acceptance Criteria Addressed**: AC-1, AC-2, AC-5
- **Test Requirements**:
  - `programmatic` TR-6.1: 100行数据审核时间不超过3秒
  - `human-judgment` TR-6.2: 审核结果准确，无明显误报和漏报
