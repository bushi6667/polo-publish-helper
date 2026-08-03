// ============================================================
// selectors —— 1688 发品页 DOM 选择器配置库
// 数据结构：selectors[页面][元素] = [{ sel, desc }, ...]
//   - sel：CSS 选择器（按优先级排列，越靠前越精确）
//   - desc：中文说明（用于日志与排障）
// 页面分组：page2（easyListing 页）、page3（publish 页）、boxRule（箱规 iframe）
// 页面侧通过 window.selectors.get(page, element) 取配置
// ============================================================
const selectors = {
    version: '1.0.0',
    page2: {
        titleInput: [
            { sel: 'input#productTitle', desc: '产品标题输入框' },
            { sel: 'input[name="title"]', desc: '产品标题输入框(name)' },
            { sel: '.title-input input', desc: '产品标题输入框(通用类名)' },
            { sel: '[placeholder*="产品标题"], [placeholder*="Product Title"]', desc: '产品标题输入框(占位符)' }
        ],
        imageUploadArea: [
            { sel: '#image-placeholder', desc: '图片上传占位区域' },
            { sel: '.image-upload-photobank-placeholder', desc: '图片上传占位区域(photobank)' },
            { sel: '.upload-select-inner', desc: '图片上传选择区域' },
            { sel: '[class*="image-upload"]', desc: '图片上传区域(模糊匹配)' }
        ],
        imageUploaded: [
            { sel: '.image-upload-list-item img', desc: '已上传图片列表项' },
            { sel: '.image-item img', desc: '图片项' },
            { sel: '.image-previewer img', desc: '图片预览' },
            { sel: '.image-uploader img', desc: '图片上传器图片' }
        ],
        categoryTab: [
            { sel: 'li[role="tab"]', desc: '类目Tab项' },
            { sel: '.next-tabs-tab', desc: 'Next UI Tab项' },
            { sel: '[class*="tabs-tab"]', desc: 'Tab项(模糊匹配)' }
        ],
        categoryTabInner: [
            { sel: '.next-tabs-tab-inner', desc: 'Next UI Tab内部元素' },
            { sel: '[class*="tab-inner"]', desc: 'Tab内部元素(模糊匹配)' }
        ],
        categoryList: [
            { sel: 'ul.category-list', desc: '类目列表' },
            { sel: '.next-tree', desc: 'Next UI 树组件' },
            { sel: '.category-tree', desc: '类目树' },
            { sel: '[class*="tree"]', desc: '树组件(模糊匹配)' }
        ],
        categoryItem: [
            { sel: 'ul.category-list li', desc: '类目列表项' },
            { sel: 'li.next-tree-node', desc: 'Next UI 树节点' },
            { sel: 'li', desc: '通用列表项(兜底)' }
        ],
        publishButton: [
            { sel: 'button.next-btn-primary', desc: 'Next UI 主按钮' },
            { sel: '[class*="primary"]', desc: '主按钮(模糊匹配)' },
            { sel: 'button', desc: '所有按钮(兜底)' }
        ],
        fileInput: [
            { sel: '.upload-select-inner input[type="file"]', desc: '上传区域文件输入框' },
            { sel: 'input#hidden-upload-input[type="file"]', desc: '隐藏上传输入框' },
            { sel: 'input[type="file"]', desc: '所有文件输入框(兜底)' }
        ],
        uploadButton: [
            { sel: '.upload-select-inner button', desc: '上传区域按钮' },
            { sel: '.upload-select-inner .next-btn', desc: '上传区域Next按钮' },
            { sel: '[role="button"]', desc: '按钮角色元素' },
            { sel: 'span', desc: 'span元素(兜底)' }
        ],
        uploadTextButton: [
            { sel: '*', desc: '包含"本地上传"文字的元素' }
        ]
    },
    page3: {
        mainImageSection: [
            { sel: '.sell-card', desc: '商品卡片' },
            { sel: '#struct-image', desc: '图片结构区域' },
            { sel: '[class*="main-image"]', desc: '主图区域(模糊匹配)' },
            { sel: '[class*="image-section"]', desc: '图片区域(模糊匹配)' }
        ],
        fieldContainer: [
            { sel: '.sell-catProp-item', desc: '商品属性项' },
            { sel: 'div[id^="struct-p-"]', desc: '结构属性项(id前缀)' },
            { sel: '.com-struct', desc: '通用结构项' },
            { sel: '.next-form-item', desc: 'Next UI 表单项' },
            { sel: '[class*="form-item"]', desc: '表单项(模糊匹配)' },
            { sel: '[class*="FormItem"]', desc: '表单项(大写模糊匹配)' },
            { sel: '[role="gridcell"]', desc: '表格单元格' }
        ],
        fieldLabel: [
            { sel: '.label', desc: '标签' },
            { sel: '.oly-label-container', desc: 'Oly标签容器' },
            { sel: 'label', desc: '原生label' },
            { sel: '.next-form-item-label', desc: 'Next UI 表单标签' },
            { sel: '[class*="label"]', desc: '标签(模糊匹配)' }
        ],
        selectComponent: [
            { sel: '.next-select', desc: 'Next UI 选择器' },
            { sel: '[role="combobox"]', desc: '组合框角色' },
            { sel: '[class*="select"]', desc: '选择器(模糊匹配)' }
        ],
        selectTag: [
            { sel: '.next-select-tag', desc: 'Next UI 标签选择器' },
            { sel: '[class*="select-tag"]', desc: '标签选择器(模糊匹配)' }
        ],
        selectNoSearch: [
            { sel: '.next-no-search', desc: 'Next UI 无搜索选择器' },
            { sel: '[class*="no-search"]', desc: '无搜索选择器(模糊匹配)' }
        ],
        selectAutoComplete: [
            { sel: '.next-select-auto-complete', desc: 'Next UI 自动完成选择器' },
            { sel: '[class*="auto-complete"]', desc: '自动完成(模糊匹配)' },
            { sel: '[aria-autocomplete="list"]', desc: '自动完成(ARIA属性)' }
        ],
        selectTrigger: [
            { sel: '.next-select-trigger', desc: 'Next UI 选择器触发按钮' },
            { sel: '.next-select-inner', desc: 'Next UI 选择器内部' },
            { sel: '[class*="select-trigger"]', desc: '选择器触发按钮(模糊匹配)' }
        ],
        numberInput: [
            { sel: 'input[type="number"]', desc: '数字输入框' },
            { sel: '.next-number-picker input', desc: 'Next UI 数字选择器' },
            { sel: 'input[aria-valuemax]', desc: '数字输入框(ARIA属性)' }
        ],
        checkbox: [
            { sel: '.next-checkbox-wrapper .next-checkbox-label', desc: 'Next UI 复选框' },
            { sel: '[type="checkbox"]', desc: '原生复选框' },
            { sel: '[class*="checkbox"]', desc: '复选框(模糊匹配)' }
        ],
        radio: [
            { sel: 'input[type="radio"]', desc: '原生单选框' },
            { sel: '.next-radio-wrapper', desc: 'Next UI 单选框' },
            { sel: '[class*="radio"]', desc: '单选框(模糊匹配)' }
        ],
        groupInput: [
            { sel: 'input[placeholder="请选择分组"]', desc: '分组输入框' },
            { sel: 'input[placeholder*="分组"]', desc: '分组输入框(模糊匹配)' },
            { sel: '[class*="group"] input', desc: '分组输入框(类名)' }
        ],
        treeNode: [
            { sel: '.next-tree-node-label', desc: 'Next UI 树节点标签' },
            { sel: '[class*="tree-node"]', desc: '树节点(模糊匹配)' },
            { sel: '[role="treeitem"]', desc: '树节点(ARIA)' }
        ],
        clearPredictButton: [
            { sel: '.predict-click-clear button', desc: '清除预测按钮' },
            { sel: '.catProp-predict-click-clear button', desc: '清除预测按钮(属性)' },
            { sel: '.sell-catProp-ai-top button', desc: 'AI顶部按钮' },
            { sel: '.sell-catProp-ai-top .next-btn', desc: 'AI顶部Next按钮' }
        ],
        expandOtherButton: [
            { sel: '.sell-catProp-ai-other-expand', desc: '展开其他属性按钮' },
            { sel: '.catProp-ai-other-expand', desc: '展开其他属性按钮(简写)' },
            { sel: '[class*="other-expand"]', desc: '展开其他(模糊匹配)' }
        ],
        otherAttributeSection: [
            { sel: '.sell-catProp-ai-other', desc: '其他属性区域' },
            { sel: '[class*="ai-other"]', desc: '其他属性区域(模糊匹配)' }
        ],
        attributeSection: [
            { sel: '[role="all"]', desc: '全量区域' },
            { sel: '.sell-card', desc: '商品卡片' },
            { sel: '#struct-attribute', desc: '属性结构区域' },
            { sel: '[class*="attribute"]', desc: '属性区域(模糊匹配)' }
        ],
        dropdownMenu: [
            { sel: '.next-overlay-wrapper', desc: 'Next UI 浮层' },
            { sel: '.next-select-popup', desc: 'Next UI 选择器弹窗' },
            { sel: '.next-menu', desc: 'Next UI 菜单' },
            { sel: '.options-list', desc: '选项列表' },
            { sel: '[class*="dropdown"]', desc: '下拉框(模糊匹配)' },
            { sel: '[class*="popup"]', desc: '弹窗(模糊匹配)' }
        ],
        dropdownOption: [
            { sel: '.options-item', desc: '选项项' },
            { sel: '.next-menu-item', desc: 'Next UI 菜单项' },
            { sel: 'li[role="option"]', desc: '选项(ARIA)' },
            { sel: '.next-option', desc: 'Next UI 选项' },
            { sel: '.next-select-menu-item', desc: 'Next UI 选择器菜单项' },
            { sel: '.next-menu-item-inner', desc: 'Next UI 菜单项内部' },
            { sel: 'li', desc: '列表项(兜底)' }
        ],
        dropdownSearchInput: [
            { sel: '.next-select-search input', desc: 'Next UI 选择器搜索框' },
            { sel: '.options-search input', desc: '选项搜索框' },
            { sel: '.next-select-popup input', desc: '选择器弹窗搜索框' },
            { sel: '.next-overlay-wrapper input', desc: '浮层搜索框' },
            { sel: '.next-menu input', desc: '菜单搜索框' },
            { sel: 'input[placeholder*="搜索"]', desc: '搜索输入框(占位符)' },
            { sel: 'input[placeholder*="输入"]', desc: '输入框(占位符)' }
        ],
        tagList: [
            { sel: '.next-select-tag-list', desc: 'Next UI 标签列表' },
            { sel: '[class*="tag-list"]', desc: '标签列表(模糊匹配)' }
        ],
        tagItem: [
            { sel: '.next-tag', desc: 'Next UI 标签' },
            { sel: '[class*="tag"]', desc: '标签(模糊匹配)' }
        ],
        fileInput: [
            { sel: '.upload-select-inner input[type="file"]', desc: '上传区域文件输入框' },
            { sel: 'input[type="file"]', desc: '所有文件输入框(兜底)' }
        ],
        uploadButton: [
            { sel: '.upload-select-inner button.upload-image', desc: '上传图片按钮' },
            { sel: '.upload-select-inner .next-btn.upload-image', desc: '上传图片Next按钮' },
            { sel: '.upload-select-inner button', desc: '上传区域按钮' },
            { sel: '.upload-select-inner [role="button"]', desc: '上传区域按钮(角色)' }
        ],
        uploadTextButton: [
            { sel: '*', desc: '包含"本地上传"文字的元素' }
        ],
        skuColorItem: [
            { sel: '.posting-field-color .item', desc: 'SKU颜色项' },
            { sel: '.item[role="item"]', desc: 'SKU颜色项(角色)' },
            { sel: '[class*="color"] .item', desc: '颜色项(模糊匹配)' }
        ],
        skuColorUploadIcon: [
            { sel: '.custom-upload-image', desc: '自定义上传图片图标' },
            { sel: '[class*="upload-image"]', desc: '上传图片图标(模糊匹配)' }
        ],
        skuColorUploadHandle: [
            { sel: '.custom-upload-image-handle', desc: '自定义上传图片处理区域' },
            { sel: '[class*="upload-handle"]', desc: '上传处理区域(模糊匹配)' }
        ],
        skuColorUploadBtn: [
            { sel: '.image-upload-button', desc: '图片上传按钮' },
            { sel: '.handle-options-item.upload-container button', desc: '处理选项上传按钮' },
            { sel: 'button', desc: '所有按钮(兜底)' }
        ],
        submitButton: [
            { sel: '.next-btn-primary', desc: 'Next UI 主按钮' },
            { sel: '[class*="primary"]', desc: '主按钮(模糊匹配)' },
            { sel: 'button[type="submit"]', desc: '提交按钮' },
            { sel: 'button', desc: '所有按钮(兜底)' }
        ]
    },
    boxRule: {
        formElement: [
            { sel: 'button', desc: '按钮' },
            { sel: '.next-btn', desc: 'Next UI 按钮' },
            { sel: 'label', desc: '标签' },
            { sel: '.next-radio-wrapper', desc: 'Next UI 单选框包装器' },
            { sel: '.ant-radio-wrapper', desc: 'Ant Design 单选框包装器' },
            { sel: '[class*="radio"]', desc: '单选框(模糊匹配)' }
        ],
        tableRow: [
            { sel: 'tr', desc: '表格行' },
            { sel: '.next-table-row', desc: 'Next UI 表格行' },
            { sel: '[class*="table-row"]', desc: '表格行(模糊匹配)' }
        ],
        numberInput: [
            { sel: 'input[type="number"]', desc: '数字输入框' },
            { sel: '.next-number-picker input', desc: 'Next UI 数字选择器' },
            { sel: 'input[aria-valuemax]', desc: '数字输入框(ARIA属性)' }
        ],
        button: [
            { sel: 'button', desc: '按钮' },
            { sel: '.next-btn', desc: 'Next UI 按钮' },
            { sel: '[class*="btn"]', desc: '按钮(模糊匹配)' }
        ]
    },
    doubao: {
        imageGenButton: [
            { sel: 'button[data-skill-id="skill_bar_button_3"]', desc: '图像生成技能按钮' },
            { sel: 'div[data-skill-id="skill_bar_button_3"]', desc: '图像生成技能按钮(div)' },
            { sel: 'button', desc: '所有按钮(兜底)' }
        ],
        chatInput: [
            { sel: 'textarea', desc: '文本域' },
            { sel: '[contenteditable="true"]', desc: '可编辑内容' },
            { sel: 'div[role="textbox"]', desc: '文本框(角色)' },
            { sel: '.chat-input textarea', desc: '聊天输入框' },
            { sel: '.input-box textarea', desc: '输入框(通用)' }
        ],
        sendButton: [
            { sel: 'button', desc: '所有按钮' }
        ],
        fileInput: [
            { sel: 'input[type="file"]', desc: '文件输入框' }
        ],
        uploadButton: [
            { sel: 'button', desc: '按钮' },
            { sel: 'div', desc: 'div元素' },
            { sel: 'span', desc: 'span元素' },
            { sel: 'label', desc: '标签' }
        ],
        messageItem: [
            { sel: '.chat-message', desc: '聊天消息' },
            { sel: '[class*="message-item"]', desc: '消息项(模糊匹配)' },
            { sel: '[class*="msg-content"]', desc: '消息内容(模糊匹配)' },
            { sel: '[class*="message"]', desc: '消息(模糊匹配)' },
            { sel: '[class*="chat-item"]', desc: '聊天项(模糊匹配)' },
            { sel: '[class*="conversation-item"]', desc: '对话项(模糊匹配)' },
            { sel: 'div[data-message-id]', desc: '消息项(数据属性)' },
            { sel: 'div[data-testid*="message"]', desc: '消息项(测试属性)' }
        ],
        imageElement: [
            { sel: 'img', desc: '图片元素' },
            { sel: 'source', desc: 'source元素' }
        ]
    },
    common: {
        overlay: [
            { sel: '.next-overlay-wrapper', desc: 'Next UI 浮层' },
            { sel: '.next-overlay', desc: 'Next UI 覆盖层' },
            { sel: '[class*="overlay"]', desc: '覆盖层(模糊匹配)' }
        ],
        input: [
            { sel: 'input:not([readonly]):not([type="hidden"])', desc: '可编辑输入框' },
            { sel: 'input', desc: '所有输入框(兜底)' }
        ],
        anyElement: [
            { sel: '*', desc: '任何元素(兜底)' }
        ]
    }
};

// 取某页面某元素的完整选择器配置（含 desc），未配置时返回空数组
function getSelectors(page, element) {
    if (!selectors[page] || !selectors[page][element]) {
        console.warn(`[选择器] 未找到配置: ${page}.${element}`);
        return [];
    }
    return selectors[page][element];
}

// 取纯 CSS 选择器列表（供 querySelector 直接使用）
function getSelectorList(page, element) {
    const configs = getSelectors(page, element);
    return configs.map(c => c.sel);
}

if (typeof window !== 'undefined') {
    window.selectors = {
        config: selectors,
        get: getSelectors,
        getList: getSelectorList
    };
}