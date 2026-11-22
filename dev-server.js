/*
 * Local preview server (for testing only; not needed on the live host).
 *   node dev-server.js   ->  http://localhost:5502
 * Serves the site and handles POST /submit.php the same way submit.php does,
 * appending rows to data/enquiries.csv.
 */
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const PORT = Number(process.env.PORT) || 5502;
const CSV = path.join(ROOT, 'data', 'enquiries.csv');
const HEADER = 'submitted_at,first_name,last_name,class,whatsapp (+91),email,consent,session,source,page_url,ip_address,user_agent';
// Keep in sync with CLASSES in submit.php.
const CLASSES = ['PG 1', 'PG 2', 'Nursery', 'Prep 1', 'Prep 2'].concat(Array.from({ length: 12 }, (_, i) => 'Class ' + (i + 1)));
const STREAMS = ['Commerce', 'Humanities', 'PCB', 'PCM'];
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml' };

const safe = (v) => {
  v = String(v == null ? '' : v).replace(/[\r\n\t]+/g, ' ').trim();
  if (/^[=+\-@]/.test(v)) v = "'" + v;
  return /[",]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
};

function handleSubmit(req, res) {
  let body = '';
  req.on('data', (c) => { body += c; if (body.length > 20000) req.destroy(); });
  req.on('end', () => {
    const send = (code, obj) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(obj)); };
    let d = {};
    try { d = JSON.parse(body); } catch (e) { return send(400, { success: false, message: 'Bad JSON' }); }
    if (d.website) return send(200, { success: true });
    let phone = String(d.whatsapp || '').replace(/\D/g, '');
    if (phone.length === 12 && phone.startsWith('91')) phone = phone.slice(2);
    const errors = {};
    if (!String(d.first_name || '').trim()) errors.firstName = 'required';
    if (!String(d.last_name || '').trim()) errors.lastName = 'required';
    const needsStream = ['Class 11', 'Class 12'].includes(d.class);
    if (!CLASSES.includes(d.class)) errors.grade = 'invalid';
    if (needsStream && !STREAMS.includes(d.stream)) errors.stream = 'invalid';
    if (!/^[6-9]\d{9}$/.test(phone)) errors.whatsapp = 'invalid';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(d.email || ''))) errors.email = 'invalid';
    if (d.consent !== true) errors.consent = 'required';
    if (Object.keys(errors).length) return send(422, { success: false, errors });
    if (!fs.existsSync(CSV) || fs.statSync(CSV).size === 0) fs.writeFileSync(CSV, '﻿' + HEADER + '\n');
    const label = d.class + (needsStream ? ' (' + d.stream + ')' : '');
    const row = [new Date().toISOString(), d.first_name, d.last_name, label, phone, d.email, 'yes',
      d.session || '2027-28', d.source || 'admissions-landing-page', d.page_url, req.socket.remoteAddress, req.headers['user-agent']];
    fs.appendFileSync(CSV, row.map(safe).join(',') + '\n');
    send(200, { success: true });
  });
}

http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  if (url === '/submit.php' && req.method === 'POST') return handleSubmit(req, res);
  if (url.startsWith('/data/') || url.endsWith('.php')) { res.writeHead(403); return res.end('Forbidden'); }
  const file = path.join(ROOT, url === '/' ? 'index.html' : url);
  if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, buf) => {
    if (err) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
    res.end(buf);
  });
}).listen(PORT, () => console.log('Preview: http://localhost:' + PORT));
