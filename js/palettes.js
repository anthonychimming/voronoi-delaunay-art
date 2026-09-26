/* ========= Palettes ========= */
const PALETTES = {
  midnight: ['#0EA5E9','#22D3EE','#60A5FA','#A78BFA','#F472B6','#F97316'],
  sakura:   ['#ffd9e2','#ffb3c7','#f77fb0','#b26cd4','#5b7bd5','#2a9d8f'],
  retro:    ['#ffbe0b','#fb5607','#ff006e','#8338ec','#3a86ff','#8ac926'],
  earth:    ['#3d405b','#e07a5f','#81b29a','#f2cc8f','#264653','#5e548e'],
  mono:     ['#e5e7eb','#cbd5e1','#94a3b8','#64748b','#475569','#1f2937']
};
function palettePreview(){ const el=$('#palPrev'); el.innerHTML=''; const pal=PALETTES[$('#palette').value]; pal.forEach(c=>{ const sw=document.createElement('div'); sw.className='sw'; sw.style.background=c; el.appendChild(sw);}); }
