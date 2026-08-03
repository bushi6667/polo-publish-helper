// _server.js 安全逻辑单元测试（security_review CRITICAL/HIGH 修复验证）
// 对应 _server.js 的 resolveCorsOrigin / buildSafeFilePath / sanitizeFileName
// 运行：node tests/test-server-security.js
// 说明：_server.js 用 require.main === module 区分主脚本与导出，可直接 require 纯逻辑。

const assert = require('assert');
const path = require('path');
const { resolveCorsOrigin, buildSafeFilePath, sanitizeFileName } = require('../_server.js');

const BASE_DIR = path.resolve(__dirname, '..');

console.log('[resolveCorsOrigin 来源白名单]');
assert.strictEqual(resolveCorsOrigin({ headers: {} }), null, '无 Origin（同源/curl）返回 null');
assert.strictEqual(resolveCorsOrigin({ headers: { origin: 'https://www.photopea.com' } }), 'https://www.photopea.com', 'photopea.com 白名单放行');
assert.strictEqual(resolveCorsOrigin({ headers: { origin: 'null' } }), 'null', 'file:// 页面（Origin: null）放行');
assert.strictEqual(resolveCorsOrigin({ headers: { origin: 'https://evil.com' } }), false, '任意网页拒绝');
assert.strictEqual(resolveCorsOrigin({ headers: { origin: 'http://localhost:3000' } }), false, '其他本地源拒绝');
console.log('  ✅ 5/5');

console.log('[buildSafeFilePath 路径穿越防护]');
assert.strictEqual(typeof buildSafeFilePath('/index.html'), 'string', '正常路径返回路径');
assert.strictEqual(buildSafeFilePath('/index.html').startsWith(BASE_DIR), true, '正常路径在 BASE_DIR 内');
assert.strictEqual(buildSafeFilePath('/../secret.txt'), null, '.. 穿越拒绝');
assert.strictEqual(buildSafeFilePath('/%2e%2e/secret.txt'), null, 'URL 编码 .. 拒绝');
assert.strictEqual(buildSafeFilePath('/../../etc/passwd'), null, '多级穿越拒绝');
assert.strictEqual(buildSafeFilePath('/%E0%A4%A'), null, '畸形 URL 编码拒绝（不抛异常）');
assert.strictEqual(buildSafeFilePath('..\\..\\evil.txt'), null, '反斜杠穿越拒绝');
// 兄弟目录同名前缀绕过（security_review 复核发现的残留 HIGH）：..\xlsx发品-副本-xx\ 不得放行
const siblingPath = '/../' + path.basename(BASE_DIR) + '-sibling/evil.txt';
assert.strictEqual(buildSafeFilePath(siblingPath), null, '兄弟目录同名前缀绕过拒绝');
console.log('  ✅ 8/8');

console.log('[sanitizeFileName 任意文件写防护]');
assert.strictEqual(sanitizeFileName('local,10,row10_main.jpg'), 'row10_main.jpg', '正常 source 格式');
assert.strictEqual(sanitizeFileName('../../evil.png'), 'evil.png', '路径穿越被剥离为 basename');
assert.strictEqual(sanitizeFileName('..\\..\\evil.png'), 'evil.png', '反斜杠穿越被剥离');
assert.strictEqual(sanitizeFileName(''), 'image.png', '空 source 兜底 image.png');
assert.strictEqual(sanitizeFileName('C:\\Windows\\system32\\evil.png'), 'evil.png', '绝对路径被剥离');
assert.strictEqual(sanitizeFileName('local,5,../escape/row.png'), 'row.png', 'local 格式中混入穿越被剥离');
assert.strictEqual(sanitizeFileName(undefined), 'image.png', 'undefined 兜底');
console.log('  ✅ 7/7');

console.log('\n----------------------------------------');
console.log('通过 20 / 失败 0');
