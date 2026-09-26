/* ========= Wire up UI ========= */
function main(){
  setAspect();
  palettePreview();
  readSliders();
  generate();
  window.addEventListener('resize', ()=>fitCanvasToContainer(canvas));

  ['motif','palette','bgMode','aspect'].forEach(id=> $(id.startsWith('#')?id:'#'+id).addEventListener('change',()=>{ setAspect(); palettePreview(); generate(); }));
  ['nPts','lloyd','strokeW','opacity','warp','hatchD'].forEach(id=> $('#'+id).addEventListener('input',()=>{ readSliders(); generate(); }));
  ;['jitter','shadow','drawSites'].forEach(id=> $('#'+id).addEventListener('change',generate));

  $('#regen').onclick = generate;
  $('#shuffle').onclick = ()=>{ shuffleSeed(); generate(); };

  fitCanvasToContainer(canvas);
}
main();
