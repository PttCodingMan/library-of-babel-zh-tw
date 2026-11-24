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

// 1. 置換機制：在小範圍窮舉，必須是雙射（cycle walking 正確）
for (const size of [2n, 3n, 1000n, C.N, 70000n]) {
  const seen = new Set();
  for (let c = 0n; c < size; c++) {
    const a = C.permuteBelow(c, size, false);
    assert(a >= 0n && a < size, `越界 ${c} -> ${a}（範圍 ${size}）`);
    assert(!seen.has(a), `撞號 ${a}（範圍 ${size}）`);
    seen.add(a);
    assert(C.permuteBelow(a, size, true) === c, `還原失敗 ${c}（範圍 ${size}）`);
  }
}
console.log('小範圍窮舉雙射 OK');

// 2. 室號位數固定
console.log('室號固定', C.HEX_DIGITS, '碼');
assert(C.hexStr(0n).length === C.HEX_DIGITS && C.hexStr(C.MAX_HEX - 1n).length === C.HEX_DIGITS, '室號位數不固定');
assert(C.parseBase36(C.hexStr(5n)) === 5n, '補零的室號解析失敗');

// 3. 各種長度的文字（含全空白）：搜尋 -> 翻開 -> 一致，室號都一樣長
let t = Date.now();
for (const n of [0, 1, 2, 3, 5, 18, 40, 100, 255, 399, 400]) {
  const text = pad(randText(n));
  const a = C.addrOfText(text);
  assert(a >= 0n && a < C.M, `長度 ${n} 越界`);
  assert(C.pageAt(a) === text, `長度 ${n} 來回失敗`);
  const sp = C.splitAddr(a);
  assert(C.joinAddr(sp) === a, 'split/join 失敗');
  const hs = C.hexStr(sp.hex);
  assert(hs.length === C.HEX_DIGITS, `長度 ${n} 的室號是 ${hs.length} 碼`);
  assert(C.parseBase36(hs) === sp.hex, '36 進位失敗');
  console.log(`  長度 ${String(n).padStart(4)} 字 -> 室號 ${hs.length} 碼，開頭 ${hs.slice(0, 12)}…`);
}
console.log('各長度來回 OK', Date.now() - t, 'ms');

// 3b. 短文字的位址不會擠在一起：位址的最高位應該像隨機數
{
  let hi = 0;
  for (let i = 0; i < 200; i++) if (C.addrOfText(pad(randText(10))) >= C.M / 2n) hi++;
  assert(hi > 60 && hi < 140, `短文字位址分布偏斜（${hi}/200 在上半段）`);
  console.log('短文字位址分布 OK（' + hi + '/200 落在上半段）');
}

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
