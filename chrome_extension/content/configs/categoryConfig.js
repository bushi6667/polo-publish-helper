// ============================================================
// categoryConfig —— 类目解析与类目相关配置的统一入口
// 职责：
//   1. classifyCategory()：把 1688 类目字符串归一化为单一产品类型。
//      数字括号优先（Hooded sweatshirt(4) -> (4) 帽衫），无数字时按关键词兜底。
//      关键词优先级：帽衫 > 卫衣 > Polo > T恤 > 衬衫（先匹配先得，互斥，仅命中一个）。
//   2. 各类目对应的模板/公司介绍/分组候选/颜色/尺码等映射集中在此维护。
// 背景：历史代码里类目判断散落在 page3 多处且规则不一致（有的不排除帽衫/卫衣），
//       这里收敛为单一真源，消费方只取 type 与 flags，避免再各写一套。
// 挂载：浏览器侧挂 window.categoryConfig；Node 测试侧走 module.exports。
// ============================================================
(function () {
    // 数字括号 → 类型
    const NUM_TO_TYPE = {
        1: 'tshirt',
        2: 'polo',
        3: 'shirt',
        4: 'hoodie',      // Hooded sweatshirt = 帽衫
        5: 'sweatshirt'   // Sweatshirt = 卫衣（无帽）
    };

    // 关键词判定（按优先级从高到低，先匹配先得；每类一个匹配函数）
    const KEYWORD_RULES = [
        { type: 'hoodie', match: (cat) => cat.includes('hoodie') },
        { type: 'sweatshirt', match: (cat) => cat.includes('sweatshirt') },
        { type: 'polo', match: (cat) => cat.includes('polo') || cat.includes('polo衫') },
        {
            type: 'tshirt',
            match: (cat) =>
                cat.includes('t-shirt') || cat.includes('t shirt') || cat.includes('tshirt') ||
                cat.includes('t恤') || (cat.includes('tee') && !cat.includes('sweat'))
        },
        // shirt 放最后：需排除 Polo/T恤 等（如 "t-shirt"/"polo shirt" 已被上面命中）
        { type: 'shirt', match: (cat) => cat.includes('shirt') || cat.includes('衬衫') || cat.includes('衬衣') }
    ];

    // 由类型产出统一的 flags（只命中一个 type，对应 flag 为 true）
    function buildFlags(type, num) {
        return {
            type,
            num,
            isTshirt: type === 'tshirt',
            isPolo: type === 'polo',
            isShirt: type === 'shirt',
            isHoodie: type === 'hoodie',
            isSweatshirt: type === 'sweatshirt'
        };
    }

    // 归一化类目字符串
    function classifyCategory(category) {
        const cat = String(category || '').toLowerCase();
        const numMatch = cat.match(/\((\d+)\)/);
        if (numMatch) {
            return buildFlags(NUM_TO_TYPE[parseInt(numMatch[1], 10)] || null, parseInt(numMatch[1], 10));
        }
        let type = null;
        for (const rule of KEYWORD_RULES) {
            if (rule.match(cat)) { type = rule.type; break; }
        }
        return buildFlags(type, null);
    }

    // 类型 → 尺码模板（draw：尺码模板选择下拉）
    const SIZE_TEMPLATE_BY_TYPE = {
        tshirt: '男士T恤通用',
        polo: '男士商务正装通用',
        shirt: '男士商务正装通用',
        hoodie: '男士帽衫通用',     // 帽衫（带头帽）与卫衣分开
        sweatshirt: '男士卫衣通用版'
    };

    // 类型 → 公司介绍模板
    const COMPANY_INTRO_BY_TYPE = {
        tshirt: 'T恤',
        polo: 'Polo衫',
        shirt: 'Shirt',
        hoodie: '卫衣有帽',
        sweatshirt: '卫衣无帽'
    };
    const DEFAULT_COMPANY_INTRO = 'Polo衫';

    // 五类服装对应的商品分组候选词（buildGroupCandidates 复用）
    const GROUP_CANDIDATES_BY_TYPE = {
        tshirt: ['T-Shirts', 'T-shirts', 'T Shirts', 'T Shirt'],
        polo: ['Polo shirt', 'Polo shirts', 'Polo'],
        shirt: ['Shirts'],
        hoodie: ['Hoodies & Sweatshirts', 'Hoodies', 'Sweatshirts'],
        sweatshirt: ['Hoodies & Sweatshirts', 'Hoodies', 'Sweatshirts']
    };

    // 颜色下拉候选（fillColorsPage3 复用）
    const DEFAULT_COLORS = [
        { key: 'white', label: 'White', labelAlt: '白色' },
        { key: 'black', label: 'Black', labelAlt: '黑色' },
        { key: 'gray', label: 'Gray', labelAlt: '灰色' },
        { key: 'navy', label: 'Navy', labelAlt: '军蓝色' }
    ];

    // 默认尺码组合与页面标签映射（fillSizesPage3 / fillSizeTemplate 复用）
    const DEFAULT_SIZES = ['S', 'M', 'L', 'XL', '2XL', '3XL'];
    const SIZE_LABEL_MAP = { S: 'S', M: 'M', L: 'L', XL: 'Xl', '2XL': '2 XL', '3XL': '3 XL' };

    const api = {
        classifyCategory,
        NUM_TO_TYPE,
        KEYWORD_RULES,
        SIZE_TEMPLATE_BY_TYPE,
        COMPANY_INTRO_BY_TYPE,
        DEFAULT_COMPANY_INTRO,
        GROUP_CANDIDATES_BY_TYPE,
        DEFAULT_COLORS,
        DEFAULT_SIZES,
        SIZE_LABEL_MAP
    };

    if (typeof window !== 'undefined') window.categoryConfig = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();