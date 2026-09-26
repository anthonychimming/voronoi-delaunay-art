/* ========= Palettes ========= */
const PALETTES = {
  midnight: ['#0EA5E9','#22D3EE','#60A5FA','#A78BFA','#F472B6','#F97316'],
  sakura:   ['#ffd9e2','#ffb3c7','#f77fb0','#b26cd4','#5b7bd5','#2a9d8f'],
  retro:    ['#ffbe0b','#fb5607','#ff006e','#8338ec','#3a86ff','#8ac926'],
  earth:    ['#3d405b','#e07a5f','#81b29a','#f2cc8f','#264653','#5e548e'],
  editorial:['#000000','#fffffc','#beb7a4','#087e8b','#2081c3'],
  desert:   ['#a35c64','#23261c','#6f5642','#a67458','#d9a485'],
  digital:  ['#004e64','#00a5cf','#9fffcb','#25a18e','#7ae582'],
  mono:     ['#e5e7eb','#cbd5e1','#94a3b8','#64748b','#475569','#1f2937']
};
const DEFAULT_CUSTOM_PALETTE = [
  '#264653', '#2A9D8F', '#E9C46A', '#F4A261', '#E76F51', '#F1FAEE'
];

function isValidHex(value){
  return typeof value === 'string' && /^#?[0-9a-f]{6}$/i.test(value);
}

function normalizeHex(value){
  return isValidHex(value) ? '#' + value.replace(/^#/, '').toUpperCase() : null;
}
