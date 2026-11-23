const fs=require('fs');
global.crypto=require('crypto').webcrypto;
const HANZI=fs.readFileSync(__dirname+'/src/hanzi.txt','utf8');
const src=fs.readFileSync(__dirname+'/src/core.js','utf8');
const m={exports:{}}; new Function('HANZI','module','crypto',src)(HANZI,m,crypto);
const C=m.exports;
console.log('N',C.N,'K',C.K,'log10 pages',(C.M.toString().length-1),'hex36 len',C.MAX_HEX.toString(36).length);
let t=Date.now();
for(let i=0;i<5;i++){
  const a=C.randomBelow(C.M);
  const p=C.pageAt(a);
  const a2=C.addrOfText(p);
  if(a!==a2) throw 'roundtrip fail';
  const sp=C.splitAddr(a); if(C.joinAddr(sp)!==a) throw 'split fail';
  const hx=sp.hex.toString(36); if(C.parseBase36(hx)!==sp.hex) throw 'b36 fail';
}
console.log('5 roundtrips ms',Date.now()-t);
const txt=C.normalize('天地玄黃，宇宙洪荒。').padEnd(3200,'　');
t=Date.now(); const a=C.addrOfText(txt); console.log('search ms',Date.now()-t);
const pg=C.pageAt(a); console.log(pg.slice(0,15), pg===txt);
console.log(C.pageAt(C.randomBelow(C.M)).slice(0,80));
const sp=C.splitAddr(a); console.log(sp.wall,sp.shelf,sp.vol,sp.page, sp.hex.toString(36).slice(0,40));
console.log(C.unsupported('着这个abc'));
// avalanche: neighbor addr
console.log(C.pageAt(a+1n).slice(0,30));
