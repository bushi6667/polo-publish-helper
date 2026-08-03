// 字段定义配置 - 衬衫/Polo/T恤类目
// 按xlsx表头列顺序定义
//
// 依赖:
//   - 无 (纯配置文件，仅导出函数)

/**
 * 衬衫类目字段配置(共18个属性，按xlsx列顺序)
 * 序号、价格、袖长(cm)、材质、工艺、印花方法、图案类型、衬衫类型、产品特性、
 * 性别、产品类型、衣服门襟、领型、样式、面料克重、编织方法、徽标位置、面料类型、原产地、省份、标题...
 */
const shirtFields = {
    required: [
        { lbl: '袖长(cm)', key: 'sleeve_en', default: 'Full', forceMode: 'auto' },
        { lbl: '材质', key: 'material_en', default: '' },
        { lbl: '工艺', key: 'technics_en', default: '' },
        { lbl: '印花方法', key: 'printing_en', default: '' },
        { lbl: '图案类型', key: 'pattern_en', default: '' },
        { lbl: '衬衫类型', key: 'shirt_type_en', default: '' },
        { lbl: '产品特性', key: 'features_en', default: '' },
        { lbl: '性别', key: 'gender', default: 'Men' },
        { lbl: '产品类型', key: 'product_type_en', default: '' },
        { lbl: '衣服门襟', key: 'placket_en', default: '' },
        { lbl: '领型', key: 'collar_en', default: '' },
        { lbl: '样式', key: 'style_en', default: '' },
        { lbl: '面料克重', key: 'fabric_weight_en', default: '' },
        { lbl: '编织方法', key: 'weaving_method_en', default: '' },
        { lbl: '徽标位置', key: 'logo_position_en', default: '' },
        { lbl: '面料类型', key: 'fabric_type_en', default: '' },
        { lbl: '原产地', key: 'origin', default: 'China' },
        { lbl: '省份', key: 'province', default: 'Zhejiang' },
    ],
    optional: []
};

/**
 * Polo类目字段配置(共17个属性，按xlsx列顺序)
 * 序号、价格、材质、工艺、设计、产品特性、原产地、省份、样式、徽标位置、印花方法、
 * 面料类型、长度、袖子款式、图案类型、性别、面料克重、编织方法、标题...
 */
const poloFields = {
    required: [
        { lbl: '材质', key: 'material_en', default: '' },
        { lbl: '工艺', key: 'technics_en', default: '' },
        { lbl: '设计', key: 'design_en', default: '' },
        { lbl: '产品特性', key: 'features_en', default: '' },
        { lbl: '原产地', key: 'origin', default: 'China' },
        { lbl: '省份', key: 'province', default: 'Zhejiang' },
        { lbl: '样式', key: 'style_en', default: '' },
        { lbl: '徽标位置', key: 'logo_position_en', default: '' },
        { lbl: '印花方法', key: 'printing_en', default: '' },
        { lbl: '面料类型', key: 'fabric_type_en', default: '' },
        { lbl: '长度', key: 'length_en', default: '' },
        { lbl: '袖子款式', key: 'sleeve_en', default: '' },
        { lbl: '图案类型', key: 'pattern_en', default: '' },
        { lbl: '性别', key: 'gender', default: 'Men' },
        { lbl: '面料克重', key: 'fabric_weight_en', default: '' },
        { lbl: '编织方法', key: 'weaving_method_en', default: '' },
    ],
    optional: []
};

/**
 * T恤类目字段配置(共19个属性，按xlsx列顺序)
 * 序号、价格、材质、面料克重、印花方法、工艺、长度、图案类型、样式、产品特性、原产地、
 * 省份、徽标位置、领子、袖子款式、板型、编织方法、面料类型、设计、性别、标题...
 */
const tshirtFields = {
    required: [
        { lbl: '材质', key: 'material_en', default: '' },
        { lbl: '面料克重', key: 'fabric_weight_en', default: '' },
        { lbl: '印花方法', key: 'printing_en', default: '' },
        { lbl: '工艺', key: 'technics_en', default: '' },
        { lbl: '长度', key: 'length_en', default: '' },
        { lbl: '图案类型', key: 'pattern_en', default: '' },
        { lbl: '样式', key: 'style_en', default: '' },
        { lbl: '产品特性', key: 'features_en', default: '' },
        { lbl: '原产地', key: 'origin', default: 'China' },
        { lbl: '省份', key: 'province', default: 'Zhejiang' },
        { lbl: '徽标位置', key: 'logo_position_en', default: '' },
        { lbl: '领子', key: 'collar_en', default: '' },
        { lbl: '袖子款式', key: 'sleeve_en', default: '' },
        { lbl: '板型', key: 'product_type_en', default: '' },
        { lbl: '编织方法', key: 'weaving_method_en', default: '' },
        { lbl: '面料类型', key: 'fabric_type_en', default: '' },
        { lbl: '设计', key: 'design_en', default: '' },
        { lbl: '性别', key: 'gender', default: 'Men' },
    ],
    optional: []
};

/**
 * 有帽卫衣类目字段配置(Hooded sweatshirt)
 * 必填属性: 材质, 种类, 款式, 面料克重, 面料类型, 印花方法, 工艺, 图案类型, 原产地
 * 其他属性: 省份, 徽标位置, 领型, 板型, 设计, 长度, 袖型, 产品特性, 性别, 编织方法
 */
const hoodedSweatshirtFields = {
    required: [
        { lbl: '材质', key: 'material_en', default: '' },
        { lbl: '种类', key: 'category_en', default: '' },
        { lbl: '款式', key: 'style_en', default: '' },
        { lbl: '面料克重', key: 'fabric_weight_en', default: '' },
        { lbl: '面料类型', key: 'fabric_type_en', default: '' },
        { lbl: '印花方法', key: 'printing_en', default: '' },
        { lbl: '工艺', key: 'technics_en', default: '' },
        { lbl: '图案类型', key: 'pattern_en', default: '' },
        { lbl: '原产地', key: 'origin', default: 'China' },
        { lbl: '省份', key: 'province', default: 'Zhejiang' },
        { lbl: '徽标位置', key: 'logo_position_en', default: '' },
        { lbl: '领型', key: 'collar_en', default: '' },
        { lbl: '板型', key: 'fit_en', default: '' },
        { lbl: '设计', key: 'design_en', default: '' },
        { lbl: '长度', key: 'length_en', default: '' },
        { lbl: '袖型', key: 'sleeve_en', default: '' },
        { lbl: '产品特性', key: 'features_en', default: '' },
        { lbl: '性别', key: 'gender', default: 'Men' },
        { lbl: '编织方法', key: 'weaving_method_en', default: '' },
    ],
    optional: []
};

/**
 * 无帽卫衣类目字段配置(Non-hooded sweatshirt)
 * 与有帽卫衣表头完全一致
 */
const nonHoodedSweatshirtFields = {
    required: [
        { lbl: '材质', key: 'material_en', default: '' },
        { lbl: '种类', key: 'category_en', default: '' },
        { lbl: '款式', key: 'style_en', default: '' },
        { lbl: '面料克重', key: 'fabric_weight_en', default: '' },
        { lbl: '面料类型', key: 'fabric_type_en', default: '' },
        { lbl: '印花方法', key: 'printing_en', default: '' },
        { lbl: '工艺', key: 'technics_en', default: '' },
        { lbl: '图案类型', key: 'pattern_en', default: '' },
        { lbl: '原产地', key: 'origin', default: 'China' },
        { lbl: '省份', key: 'province', default: 'Zhejiang' },
        { lbl: '徽标位置', key: 'logo_position_en', default: '' },
        { lbl: '领型', key: 'collar_en', default: '' },
        { lbl: '板型', key: 'fit_en', default: '' },
        { lbl: '设计', key: 'design_en', default: '' },
        { lbl: '长度', key: 'length_en', default: '' },
        { lbl: '袖型', key: 'sleeve_en', default: '' },
        { lbl: '产品特性', key: 'features_en', default: '' },
        { lbl: '性别', key: 'gender', default: 'Men' },
        { lbl: '编织方法', key: 'weaving_method_en', default: '' },
    ],
    optional: []
};

/**
 * 根据类目判定返回字段配置
 * @param {string} categoryType - 类目类型('Shirt', 'Polo', 'Tshirt', 'Hooded sweatshirt', 'Non-hooded sweatshirt')
 * @returns {Object} 字段配置 {required, optional}
 */
function getCategoryFields(categoryType) {
    switch (categoryType) {
        case 'Shirt':
            return shirtFields;
        case 'Polo':
            return poloFields;
        case 'Tshirt':
            return tshirtFields;
        case 'Hooded sweatshirt':
            return hoodedSweatshirtFields;
        case 'Non-hooded sweatshirt':
            return nonHoodedSweatshirtFields;
        default:
            // 默认返回Polo配置
            return poloFields;
    }
}

/**
 * 构建字段填入列表(带实际值)
 * @param {Object} product - 产品数据
 * @param {Array} fieldConfigs - 字段配置列表
 * @returns {Array} 带实际值的字段列表 [{lbl, val, fallback, forceMode}]
 */
function buildFieldList(product, fieldConfigs) {
    const hasVal = (v) => v && String(v).trim() && String(v).toLowerCase() !== 'none';
    
    return fieldConfigs.map(field => {
        let val = '';
        
        // 有default的字段使用default，无default的字段使用product值
        if (field.default) {
            // 固定值字段(gender/origin/province)使用default
            if (field.key === 'gender' || field.key === 'origin' || field.key === 'province') {
                val = field.default;
            } else {
                // 有default的其他字段: 优先用product值，其次用default
                val = hasVal(product[field.key]) ? product[field.key] : field.default;
            }
        } else {
            // 无default的字段: 只用product值
            val = hasVal(product[field.key]) ? product[field.key] : '';
        }
        
        return {
            lbl: field.lbl,
            val: val,
            fallback: field.fallback || null,
            forceMode: field.forceMode || null
        };
    }).filter(f => f.val);
}

// 导出
if (typeof window !== 'undefined') {
    window.attributeFields = {
        shirtFields,
        poloFields,
        tshirtFields,
        hoodedSweatshirtFields,
        nonHoodedSweatshirtFields,
        getCategoryFields,
        buildFieldList
    };
}