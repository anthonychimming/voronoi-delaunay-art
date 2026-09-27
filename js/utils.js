/* ========= Utilities ========= */
const $ = sel => document.querySelector(sel);

function fitCanvasToContainer(canvas){
  const wrap = canvas.parentElement;
  if(!wrap) return;

  const styles = getComputedStyle(wrap);
  const padX = (parseFloat(styles.paddingLeft) || 0) + (parseFloat(styles.paddingRight) || 0);
  const padY = (parseFloat(styles.paddingTop) || 0) + (parseFloat(styles.paddingBottom) || 0);
  const availableW = Math.max(1, wrap.clientWidth - padX);
  const availableH = Math.max(1, wrap.clientHeight - padY);

  const scale = Math.min(1, availableW / canvas.width, availableH / canvas.height);
  const cssW = Math.max(1, Math.floor(canvas.width * scale));
  const cssH = Math.max(1, Math.floor(canvas.height * scale));

  canvas.style.width = cssW + 'px';
  canvas.style.height = cssH + 'px';
}

function seededPRNG(seed){
  // xmur3 + mulberry32 combo for human text seeds
  function xmur3(str){
    let h = 1779033703 ^ str.length;
    for (let i=0;i<str.length;i++){
      h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
      h = (h << 13) | (h >>> 19);
    }
    return function(){ h = Math.imul(h ^ (h>>>16), 2246822507); h = Math.imul(h ^ (h>>>13), 3266489909); return (h ^= h>>>16)>>>0; }
  }
  const seedFn = xmur3(seed);
  let a = seedFn();
  return function(){ a += 0x6D2B79F5; let t = Math.imul(a ^ (a>>>15), 1 | a); t ^= t + Math.imul(t ^ (t>>>7), 61 | t); return ((t ^ (t>>>14))>>>0) / 4294967296; }
}
function shuffleSeed(){
  const s = 'seed-' + Math.random().toString(36).slice(2,9);
  $('#seed').value = s;
  return s;
}

/* ===== Simplex Noise (2D) — tiny implementation ===== */
function Simplex2D(seed){
  const rand = seededPRNG(seed+'-noise');
  const grad3 = [
    [1,1],[-1,1],[1,-1],[-1,-1],
    [1,0],[-1,0],[0,1],[0,-1]
  ];
  const p = new Uint8Array(256);
  for(let i=0;i<256;i++) p[i]=i;
  for(let i=255;i>0;i--){ const j = (rand()* (i+1))|0; [p[i],p[j]]=[p[j],p[i]]; }
  const perm = new Uint8Array(512);
  for(let i=0;i<512;i++) perm[i]=p[i&255];

  const F2 = 0.5*(Math.sqrt(3)-1), G2 = (3-Math.sqrt(3))/6;
  function dot(g,x,y){ return g[0]*x + g[1]*y; }
  return {
    noise(xin,yin){
      let n0=0,n1=0,n2=0;
      const s = (xin+yin)*F2;
      const i = Math.floor(xin+s), j = Math.floor(yin+s);
      const t = (i+j)*G2;
      const X0=i-t, Y0=j-t;
      const x0=xin-X0, y0=yin-Y0;
      let i1, j1; if(x0>y0){i1=1;j1=0;} else {i1=0;j1=1;}
      const x1=x0-i1+G2, y1=y0-j1+G2;
      const x2=x0-1+2*G2, y2=y0-1+2*G2;
      const ii=i & 255, jj=j & 255;
      const gi0=grad3[perm[ii+perm[jj]]%8];
      const gi1=grad3[perm[ii+i1+perm[jj+j1]]%8];
      const gi2=grad3[perm[ii+1+perm[jj+1]]%8];
      let t0=0.5 - x0*x0 - y0*y0; if(t0>0){ t0*=t0; n0=t0*t0*dot(gi0,x0,y0); }
      let t1=0.5 - x1*x1 - y1*y1; if(t1>0){ t1*=t1; n1=t1*t1*dot(gi1,x1,y1); }
      let t2=0.5 - x2*x2 - y2*y2; if(t2>0){ t2*=t2; n2=t2*t2*dot(gi2,x2,y2); }
      return 70*(n0+n1+n2); // ~[-1,1]
    }
  }
}
