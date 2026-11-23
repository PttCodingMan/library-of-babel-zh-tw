// Node 測試：node test.js
const fs = require('fs');
global.crypto = require('crypto').webcrypto;
const HANZI = fs.readFileSync(__dirname + '/src/hanzi.txt', 'utf8');
const src = fs.readFileSync(__dirname + '/src/core.js', 'utf8');
const m = { exports: {} }; new Function('HANZI', 'module', 'crypto', src)(HANZI, m, crypto);
const C = m.exports;
const assert = (ok, msg) => { if (!ok) throw new Error(msg); };
const pad = (t) => C.normalize(t).padEnd(C.L, '　');
const randText = (n) => { let s = ''; for (let i = 0; i < n; i++) s += C.ALPHABET[1 + Number(C.randomBelow(C.N - 1n))]; return s; };

console.log('字集', C.N, '總頁數約 10^' + (C.M.toString().length - 1));

// 1. 全空白的那一頁在位址 0
assert(C.addrOfText(pad('')) === 0n, '空白頁不在 0');
assert(C.pageAt(0n) === pad(''), '位址 0 不是空白頁');

// 2. 第一層（只有第 1 個字有內容）窮舉：必須是 [1, N) 上的雙射
{
  const seen = new Set();
  for (let c = 1n; c < C.N; c++) {
    const a = C.contentToAddr(c);
    assert(a >= 1n && a < C.N, `第一層越界 ${c} -> ${a}`);
    assert(!seen.has(a), `第一層撞號 ${a}`);
    seen.add(a);
    assert(C.addrToContent(a) === c, `第一層還原失敗 ${c}`);
  }
  console.log('第一層雙射 OK（' + seen.size + ' 頁）');
}

// 3. 各種長度的文字：搜尋 -> 翻開 -> 一致，且位址落在同一層
let t = Date.now();
for (const n of [1, 2, 3, 5, 18, 40, 100, 777, 3199, 3200]) {
  const text = pad(randText(n));
  const a = C.addrOfText(text);
  assert(C.layerOfAddr(a) === n, `長度 ${n} 落在第 ${C.layerOfAddr(a)} 層`);
  assert(C.pageAt(a) === text, `長度 ${n} 來回失敗`);
  const sp = C.splitAddr(a);
  assert(C.joinAddr(sp) === a, 'split/join 失敗');
  assert(C.parseBase36(sp.hex.toString(36)) === sp.hex, '36 進位失敗');
  console.log(`  長度 ${String(n).padStart(4)} 字 -> 室號 ${sp.hex.toString(36).length} 碼`);
}
console.log('各長度來回 OK', Date.now() - t, 'ms');

// 4. 隨機位址（幾乎都是寫滿的頁）來回
t = Date.now();
for (let i = 0; i < 5; i++) {
  const a = C.randomBelow(C.M);
  assert(C.addrOfText(C.pageAt(a)) === a, '隨機位址來回失敗');
}
console.log('隨機位址來回 OK', Date.now() - t, 'ms');

// 5. 相鄰位址內容無關（目視）
const a = C.addrOfText(pad('天地玄黃，宇宙洪荒。'));
console.log('  ', C.pageAt(a).slice(0, 12), '| 下一頁：', C.pageAt(a + 1n).slice(0, 12));
console.log(C.unsupported('着这个abc'));
console.log('全部通過');
