// ============================================================
// Polo发品助手 - 本地辅助服务器
// 职责：① 接收 Photopea 在线 PS 保存的图片（POST /photopea-save）
//       ② 提供发品助手.html 及项目静态资源的本地文件服务
// 启动：node _server.js （默认端口 8765）
// 注意：仅本地开发使用；CORS 全开（Access-Control-Allow-Origin: *）
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

const server = http.createServer((req, res) => {
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
          res.writeHead(400, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
          res.end(JSON.stringify({ message: 'Invalid JSON' }));
          return;
      }
      // 从 source 字段解析原始文件名（格式：local,<row>,<fileName>）
      const source = meta.source || '';
      const match = source.match(/local,\d+,(.+)/);
      const fileName = match ? match[1] : path.basename(source);
      // 取 png/jpg 版本，按 start/size 从缓冲区切片出图片数据
      const versions = meta.versions || [];
      const pngVer = versions.find(v => v.format === 'png' || v.format === 'jpg');
      if (!pngVer) {
        res.writeHead(400, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
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
          res.writeHead(500, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
          res.end(JSON.stringify({ message: 'Save failed' }));
          return;
        }
        console.log(`✅ Photopea saved: ${fileName}`);
        res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify({ message: '✅ 已保存', script: 'app.echoToOE("已保存到本地");' }));
      });
    });
    return;
  }

  // ---------- CORS 预检 ----------
  if (req.method === 'OPTIONS') {
    res.writeHead(200, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    res.end();
    return;
  }

  // ---------- 静态文件服务 ----------
  // 根路径映射到 index.html；按扩展名返回对应 MIME；文件不存在返回 404
  let filePath = decodeURIComponent(req.url.split('?')[0]);
  if (filePath === '/') filePath = '/index.html';
  filePath = path.join(BASE_DIR, filePath);

  const ext = path.extname(filePath).toLowerCase();
  const mimeType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not Found');
      return;
    }
    res.writeHead(200, { 'Content-Type': mimeType, 'Access-Control-Allow-Origin': '*' });
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}/`);
});
