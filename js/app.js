/* ========= Wire up UI ========= */
const RANGE_IDS = ['nPts','lloyd','strokeW','opacity','warp','hatchD'];

function updateRangeVisual(input){
  const min = Number(input.min || 0);
  const max = Number(input.max || 100);
  const value = Number(input.value);
  const pct = max === min ? 0 : ((value - min) / (max - min)) * 100;
  input.style.setProperty('--range-progress', Math.max(0, Math.min(100, pct)) + '%');
}

function updateControlState(){
  const motif = $('#motif').value;
  const hatchField = $('#hatchField');
  const showHatch = motif === 'hatch';
  hatchField.hidden = !showHatch;
  $('#hatchD').disabled = !showHatch;

  const sites = $('#drawSites');
  const sitesToggle = $('#sitesToggle');
  const sitesRedundant = motif === 'centroids';
  sites.disabled = sitesRedundant;
  sitesToggle.classList.toggle('is-disabled', sitesRedundant);
  sitesToggle.setAttribute('aria-disabled', String(sitesRedundant));
}

function updateStatus(){
  const motifSelect = $('#motif');
  $('#statusSites').textContent = $('#nPts').value + ' sites';
  $('#statusResolution').textContent = canvas.width + '×' + canvas.height;
  $('#statusMotif').textContent = motifSelect.options[motifSelect.selectedIndex].textContent;
  $('#statusSeed').textContent = 'seed · ' + ($('#seed').value.trim() || 'seed');
}

function renderFromUI(){
  readSliders();
  RANGE_IDS.forEach(id => updateRangeVisual($('#' + id)));
  updateControlState();
  generate();
  updateStatus();
}

function main(){
  setAspect();
  palettePreview();
  readSliders();
  RANGE_IDS.forEach(id => updateRangeVisual($('#' + id)));
  updateControlState();
  generate();
  updateStatus();

  $('#motif').addEventListener('change', ()=>{
    updateControlState();
    generate();
    updateStatus();
  });

  $('#palette').addEventListener('change', ()=>{
    palettePreview();
    generate();
    updateStatus();
  });

  $('#bgMode').addEventListener('change', ()=>{
    generate();
    updateStatus();
  });

  $('#aspect').addEventListener('change', ()=>{
    setAspect();
    generate();
    updateStatus();
  });

  RANGE_IDS.forEach(id=>{
    const input = $('#' + id);
    input.addEventListener('input', ()=>{
      readSliders();
      updateRangeVisual(input);
      generate();
      updateStatus();
    });
  });

  $('#drawSites').addEventListener('change', ()=>{
    generate();
    updateStatus();
  });

  $('#seed').addEventListener('change', ()=>{
    generate();
    updateStatus();
  });
  $('#seed').addEventListener('keydown', e=>{
    if(e.key === 'Enter'){
      e.preventDefault();
      generate();
      updateStatus();
    }
  });

  $('#regen').onclick = ()=>{
    generate();
    updateStatus();
  };

  $('#shuffle').onclick = ()=>{
    shuffleSeed();
    generate();
    updateStatus();
  };

  const resizeCanvas = ()=>fitCanvasToContainer(canvas);
  window.addEventListener('resize', resizeCanvas);

  const stage = $('#canvasStage');
  if('ResizeObserver' in window){
    const ro = new ResizeObserver(resizeCanvas);
    ro.observe(stage);
  }

  requestAnimationFrame(resizeCanvas);
}

main();
