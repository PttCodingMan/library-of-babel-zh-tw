// ===== 巴別圖書館・繁體中文館 核心 =====
// 字集：全形空白 + 全形標點 + Big5 (cp950) 全部 13,060 個漢字
const PUNCT = "，。、；：？！「」『』（）《》〈〉—…·";
const ALPHABET = Array.from("　" + PUNCT + HANZI);
const N = BigInt(ALPHABET.length);
const L = 3200;                       // 每頁字數
const WALLS = 4, SHELVES = 5, VOLUMES = 32, PAGES = 410;
const PER_HEX = BigInt(WALLS * SHELVES * VOLUMES * PAGES); // 262,400 頁／室
const INDEX = new Map(ALPHABET.map((c, i) => [c, i]));

// ---- 大數工具 ----
const powMemo = new Map();
function pow(base, e) {
  const key = base + ":" + e;
  let v = powMemo.get(key);
  if (v === undefined) { v = base ** BigInt(e); powMemo.set(key, v); }
  return v;
}
// 小端序位數陣列 -> BigInt
function digitsToBig(d, base, lo = 0, hi = d.length) {
  if (hi - lo <= 24) {
    let x = 0n;
    for (let i = hi - 1; i >= lo; i--) x = x * base + BigInt(d[i]);
    return x;
  }
  const mid = (lo + hi) >> 1;
  return digitsToBig(d, base, lo, mid) + digitsToBig(d, base, mid, hi) * pow(base, mid - lo);
}
// BigInt -> 小端序位數陣列（長度 n）
function bigToDigits(x, base, n, out = new Array(n), off = 0) {
  if (n <= 24) {
    for (let i = 0; i < n; i++) { out[off + i] = Number(x % base); x /= base; }
    return out;
  }
  const h = n >> 1, p = pow(base, h);
  const q = x / p, r = x - q * p;
  bigToDigits(r, base, h, out, off);
  bigToDigits(q, base, n - h, out, off + h);
  return out;
}
function bitLength(x) { return x === 0n ? 0 : x.toString(2).length; }
function parseBase36(s) {
  const d = [];
  for (let i = s.length - 1; i >= 0; i--) {
    const v = parseInt(s[i], 36);
    if (Number.isNaN(v)) throw new Error("室號只能有 0–9 與 a–z");
    d.push(v);
  }
  return digitsToBig(d, 36n);
}

// ---- 圖書館的大小 ----
const M = N ** BigInt(L);            // 總頁數
const K = bitLength(M);              // 位元寬度
const MAX_HEX = (M + PER_HEX - 1n) / PER_HEX;

// ---- 置亂 ----
// 頁面內容看成小端序整數 C ∈ [0, M)，位址 A = f(C)，f 是整個 [0, M) 上一個固定的置換。
// 不分長短一起打散：一句話的頁面和寫滿的頁面，位址一樣是 [0, M) 裡隨便一個數，
// 室號再補零到固定位數，所以每個網址都一樣長。每一頁仍然剛好出現一次；相鄰位址的內容彼此無關。
function sfc32(a, b, c, d) {
  return function () {
    a >>>= 0; b >>>= 0; c >>>= 0; d >>>= 0;
    let t = (a + b) | 0;
    a = b ^ (b >>> 9); b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11); d = (d + 1) | 0;
    t = (t + d) | 0; c = (c + t) | 0;
    return t >>> 0;
  };
}
function invMod2k(a, k) {            // 牛頓法求 a⁻¹ mod 2^k
  let x = a, bits = 3;
  while (bits < k) { x = BigInt.asUintN(k, x * (2n - a * x)); bits *= 2; }
  return BigInt.asUintN(k, x * (2n - a * x));
}
// [0, 2^k) 上的置換：交替「乘奇數常數 mod 2^k」與「x ^ (x >> ⌈k/2⌉)」。常數由固定種子與 k 決定，每個訪客都一樣。
const permMemo = new Map();
function permFor(k) {
  let P = permMemo.get(k);
  if (P) return P;
  const rng = sfc32(0x5df1a3c7, 0x9e3779b9, 0x1941b0e5 ^ k, 0x0b0b0e1a); // 1941：〈巴別圖書館〉發表年
  for (let i = 0; i < 8; i++) rng();
  const constK = () => {
    let hex = "";
    while (hex.length * 4 < k) hex += rng().toString(16).padStart(8, "0");
    return BigInt.asUintN(k, BigInt("0x" + hex)) | 1n;
  };
  const MULS = [constK(), constK(), constK(), constK()];
  const INVS = MULS.map((a) => invMod2k(a, k));
  const ADD = constK() >> 1n;
  const S = BigInt(Math.ceil(k / 2));
  const mul = (x, a) => BigInt.asUintN(k, x * a);
  const xs = (x) => x ^ (x >> S);
  P = {
    f(x) {
      x = mul(x, MULS[0]); x = xs(x);
      x = BigInt.asUintN(k, x + ADD);
      x = mul(x, MULS[1]); x = xs(x);
      x = mul(x, MULS[2]); x = xs(x);
      return mul(x, MULS[3]);
    },
    inv(x) {
      x = mul(x, INVS[3]);
      x = xs(x); x = mul(x, INVS[2]);
      x = xs(x); x = mul(x, INVS[1]);
      x = BigInt.asUintN(k, x - ADD);
      x = xs(x); return mul(x, INVS[0]);
    },
  };
  permMemo.set(k, P);
  return P;
}
// [0, size) 上的置換：在 2^k（k = size−1 的位元數）上置換，用 cycle walking 限制回 [0, size)
function permuteBelow(x, size, inverse) {
  if (size <= 1n) return x;
  const P = permFor(bitLength(size - 1n)), step = inverse ? P.inv : P.f;
  let y = step(x);
  while (y >= size) y = step(y);
  return y;
}
function contentToAddr(c) { return permuteBelow(c, M, false); }
function addrToContent(a) { return permuteBelow(a, M, true); }

// 室號固定位數：補零到最大室號的長度
const HEX_DIGITS = (MAX_HEX - 1n).toString(36).length;
function hexStr(h) { return h.toString(36).padStart(HEX_DIGITS, "0"); }

// ---- 頁面 <-> 位址 ----
function pageAt(a) {
  const d = bigToDigits(addrToContent(a), N, L);
  let s = "";
  for (let i = 0; i < L; i++) s += ALPHABET[d[i]];
  return s;
}
function addrOfText(text) {         // text 長度須為 L，且都在字集中
  const chars = Array.from(text);
  return contentToAddr(digitsToBig(chars.map((c) => INDEX.get(c)), N));
}
function splitAddr(a) {
  let loc = Number(a % PER_HEX);
  const hex = a / PER_HEX;
  const page = loc % PAGES; loc = (loc - page) / PAGES;
  const vol = loc % VOLUMES; loc = (loc - vol) / VOLUMES;
  const shelf = loc % SHELVES; const wall = (loc - shelf) / SHELVES;
  return { hex, wall: wall + 1, shelf: shelf + 1, vol: vol + 1, page: page + 1 };
}
function joinAddr({ hex, wall, shelf, vol, page }) {
  const loc = (((wall - 1) * SHELVES + (shelf - 1)) * VOLUMES + (vol - 1)) * PAGES + (page - 1);
  return hex * PER_HEX + BigInt(loc);
}
function randomBelow(limit) {
  const bits = bitLength(limit), bytes = Math.ceil(bits / 8);
  const buf = new Uint8Array(bytes);
  for (;;) {
    crypto.getRandomValues(buf);
    let hex = "";
    for (const b of buf) hex += b.toString(16).padStart(2, "0");
    const x = BigInt.asUintN(bits, BigInt("0x" + hex));
    if (x < limit) return x;
  }
}
function randomChar() { return ALPHABET[Number(randomBelow(N))]; }

// ---- 輸入正規化 ----
const NORMAL = {
  " ": "　", "\n": "　", "\r": "", "\t": "　",
  ",": "，", ".": "。", "?": "？", "!": "！", ":": "：", ";": "；",
  "(": "（", ")": "）", "“": "「", "”": "」", "‘": "『", "’": "』",
  "‧": "·", "・": "·", "•": "·", "﹐": "，", "､": "、", "<": "〈", ">": "〉",
};
function normalize(raw) {
  let s = raw.replace(/\.\.\.|。。。/g, "…").replace(/\r\n/g, "\n");
  return Array.from(s).map((c) => NORMAL[c] ?? c).join("");
}
function unsupported(text) {
  return [...new Set(Array.from(text).filter((c) => !INDEX.has(c)))];
}

if (typeof module !== "undefined") module.exports = {
  ALPHABET, N, L, M, K, MAX_HEX, PER_HEX, pageAt, addrOfText, splitAddr, joinAddr,
  contentToAddr, addrToContent, permuteBelow, HEX_DIGITS, hexStr, parseBase36, randomBelow, normalize, unsupported, digitsToBig, bigToDigits,
};
