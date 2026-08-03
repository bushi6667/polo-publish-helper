// ============================================================
// Polo发品助手 - 本地辅助服务器
// 职责：① 接收 Photopea 在线 PS 保存的图片（POST /photopea-save）
//       ② 提供发品助手.html 及项目静态资源的本地文件服务
// 启动：node _server.js （默认端口 8765，仅监听本机 127.0.0.1）
// 安全边界（security_review 修复）：
//   - 仅监听 127.0.0.1，不暴露到局域网
//   - CORS 白名单：仅 photopea.com 与 file:// 页面（Origin: null），其余跨源请求 403
//   - 静态服务路径归一化后强制在 BASE_DIR 内（防路径遍历读取）
//   - /photopea-save 文件名强制 basename（防任意文件写入）
//   - decodeURIComponent 异常兜底（防本地 DoS）
// ============================================================
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 8765;
const BASE_DIR = __dirname;

// 静态资源 MIME 类型映射（支持中文页面的 charset）
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
};

// CORS 来源白名单：photopea.com（在线 PS 保存请求）与 'null'（file:// 本地页面）
const ALLOWED_ORIGINS = new Set(['https://www.photopea.com', 'null']);

// 解析请求来源：返回 允许的 Origin 字符串 / null（无 Origin，无需 CORS 头）/ false（拒绝）
function resolveCorsOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return null; // 同源/curl：无跨源语义
  if (ALLOWED_ORIGINS.has(origin)) return origin;
  return false;
}

// 静态文件安全路径：URL 解码异常返回 null；路径归一化后强制在 BASE_DIR 内（防 ../ 穿越），否则 null
// 注意：前缀比较需带 path.sep 边界，防止「兄弟目录同名前缀」绕过（如 ..\xlsx发品-备份\x）
function buildSafeFilePath(urlPath) {
  let decoded;
  try {
    decoded = decodeURIComponent(urlPath);
  } catch (e) {
    return null;
  }
  const p = path.normalize(path.join(BASE_DIR, decoded));
  if (p !== BASE_DIR && !p.startsWith(BASE_DIR + path.sep)) return null;
  return p;
}

// Photopea 保存文件名净化：剥离一切目录部分（防任意文件写入），空名兜底 image.png
function sanitizeFileName(source) {
  const s = String(source || ''); // 先统一为字符串（path.basename 对 undefined 会抛错）
  const match = s.match(/local,\d+,(.+)/);
  return path.basename(match ? match[1] : path.basename(s)) || 'image.png';
}

const server = http.createServer((req, res) => {
  // ---------- 统一：跨源来源校验（带 Origin 的请求必须命中白名单） ----------
  const origin = resolveCorsOrigin(req);
  if (origin === false) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Forbidden');
    return;
  }
  // 组装响应头（无 Origin 的请求不加 CORS 头；白名单来源回显其 Origin）
  const corsHeaders = origin === null ? {} : { 'Access-Control-Allow-Origin': origin };

  // ---------- Photopea 保存图片接收 ----------
  // Photopea 的保存协议：请求体 = 前 2000 字节 JSON 元数据 + 图片二进制数据，
  // 元数据含 versions[]（每版 format/start/size），按 png/jpg 版本切片取图落盘。
  if (req.method === 'POST' && req.url === '/photopea-save') {
    let body = [];
    req.on('data', chunk => body.push(chunk));
    req.on('end', () => {
      const buf = Buffer.concat(body);
      // 解析头部 JSON 元数据（最多取前 2000 字节，去掉 NUL 填充）
      const jsonStr = buf.slice(0, 2000).toString('utf-8').replace(/\0/g, '').trim();
      let jsonEnd = jsonStr.lastIndexOf('}');
      let meta;
      try {
        meta = JSON.parse(jsonStr.slice(0, jsonEnd + 1));
      } catch (e) {
          res.writeHead(400, { 'Content-Type': 'application/json', ...corsHeaders });
          res.end(JSON.stringify({ message: 'Invalid JSON' }));
          return;
      }
      // 从 source 字段解析原始文件名（格式：local,<row>,<fileName>）
      // 安全：sanitizeFileName 强制 basename，剥离一切目录部分，防任意文件写入
      const fileName = sanitizeFileName(meta.source);
      // 取 png/jpg 版本，按 start/size 从缓冲区切片出图片数据
      const versions = meta.versions || [];
      const pngVer = versions.find(v => v.format === 'png' || v.format === 'jpg');
      if (!pngVer) {
        res.writeHead(400, { 'Content-Type': 'application/json', ...corsHeaders });
        res.end(JSON.stringify({ message: 'No image version' }));
        return;
      }
      const jsonPad = 2000; // 与元数据截断长度一致
      const imgStart = jsonPad + pngVer.start;
      const imgEnd = imgStart + pngVer.size;
      const imgData = buf.slice(imgStart, imgEnd);
      // 落盘到 extracted_images 目录（与发品助手.html 的图片提取目录一致）
      const targetPath = path.join(BASE_DIR, 'extracted_images', fileName);
      fs.writeFile(targetPath, imgData, err => {
        if (err) {
          res.writeHead(500, { 'Content-Type': 'application/json', ...corsHeaders });
          res.end(JSON.stringify({ message: 'Save failed' }));
          return;
        }
        console.log(`✅ Photopea saved: ${fileName}`);
        res.writeHead(200, { 'Content-Type': 'application/json', ...corsHeaders });
        res.end(JSON.stringify({ message: '✅ 已保存', script: 'app.echoToOE("已保存到本地");' }));
      });
    });
    return;
  }

  // ---------- CORS 预检 ----------
  if (req.method === 'OPTIONS') {
    res.writeHead(200, {
      ...corsHeaders,
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    res.end();
    return;
  }

  // ---------- 静态文件服务 ----------
  // 根路径映射到 index.html；按扩展名返回对应 MIME；文件不存在返回 404
  // 安全：URL 解码统一在 buildSafeFilePath 内完成（单次解码 + 异常兜底 + BASE_DIR 前缀校验）
  let rawPath = req.url.split('?')[0];
  if (rawPath === '/') rawPath = '/index.html';
  const filePath = buildSafeFilePath(rawPath);
  if (!filePath) {
    // 路径逃逸 BASE_DIR（../ 穿越）、畸形 URL 编码或兄弟前缀绕过
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8', ...corsHeaders });
    res.end('Forbidden');
    return;
  }

  const ext = path.extname(filePath).toLowerCase();
  const mimeType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8', ...corsHeaders });
      res.end('Not Found');
      return;
    }
    res.writeHead(200, { 'Content-Type': mimeType, ...corsHeaders });
    res.end(data);
  });
});

// 仅监听本机回环地址，不暴露到局域网；被 require 时导出纯逻辑供单元测试
if (require.main === module) {
  server.listen(PORT, '127.0.0.1', () => {
    console.log(`Server running at http://127.0.0.1:${PORT}/`);
  });
} else {
  module.exports = { resolveCorsOrigin, buildSafeFilePath, sanitizeFileName };
}
