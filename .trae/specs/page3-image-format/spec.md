# Page3 图片格式选择功能

## 背景

页2 有 JPG/PNG 格式选择功能（存在 `chrome.storage.local.img_ext`），但页3 的图片路径从产品数据里硬编码 `_main.jpg`，用户选了 PNG 也没用。需要让页3 也支持格式选择，和页2 共享配置。

## 设计原因

1. 用户在页2 选择了图片格式，页3 应保持一致
2. 产品数据里的 `imagePath` 硬编码了 `_main.jpg`，无法根据格式动态切换
3. 图片路径需要根据 `IMG_EXT` 动态拼接，像页2 那样

## 设计优点

1. 页2/页3 格式配置统一，通过 `chrome.storage.local.img_ext` 共享
2. 用户在页3 也能随时切换格式，不用回页2
3. 路径动态拼接，不依赖产品数据的硬编码扩展名

## 能力边界

### 能做什么

- 页3 面板新增 JPG/PNG 格式选择按钮，和页2 一致
- 格式配置存 `chrome.storage.local.img_ext`，两页共享
- `fillImagesPage3` 根据 `IMG_EXT` 动态拼接图片路径
- 格式选择器在面板折叠时隐藏，展开时显示

### 不能做什么

- 不自动转换图片格式（需要用户预先准备好对应格式的图片文件）
- 不改变产品数据里 `imagePath` 的存储格式
- 不改变发品助手.html 的产品数据结构
- 颜色图保持 PNG（AI 豆包生成固定 PNG 格式）

## 改动范围

| 文件 | 改动点 |
|---|---|
| `chrome_extension/content/page3.js` | 1. 添加 `IMG_EXT`/`loadImgExt`/`saveImgExt`<br>2. 面板 UI 新增格式选择按钮<br>3. `fillImagesPage3` 动态拼接图片路径<br>4. `togglePanel` 支持格式选择器的显示/隐藏<br>5. 初始化加载格式配置 |
| `tests/test-page3-image-format.js` | 新增测试（26 项） |

## 详细设计

### 图片路径拼接逻辑

```
if (IMAGE_DIR && product.row) {
    path = IMAGE_DIR + sep + 'row' + product.row + '_main.' + IMG_EXT
} else {
    path = product.imagePath  // 回退到产品数据
}
```

### 格式配置共享

- 页2 和页3 都使用 `chrome.storage.local.img_ext` 作为存储 key
- 默认值为 `jpg`
- 用户在任一页切换格式，另一页刷新后自动生效
