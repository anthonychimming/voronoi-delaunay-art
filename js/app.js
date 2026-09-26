/* ========= Wire up UI ========= */
const RANGE_IDS = ['nPts','lloyd','strokeW','opacity','warp','hatchD'];
const CUSTOM_PALETTE_KEY = 'voronoiDelaunay.customPalette';
let customPalette = loadCustomPalette();

function loadCustomPalette(){
  try {
    const stored = JSON.parse(localStorage.getItem(CUSTOM_PALETTE_KEY));
    if(Array.isArray(stored) && stored.length === 6 && stored.every(isValidHex)){
      return stored.map(normalizeHex);
    }
  } catch {
    // Storage may be unavailable or contain malformed JSON.
  }
  return [...DEFAULT_CUSTOM_PALETTE];
}

function getActivePalette(){
  const selection = $('#palette').value;
  return selection === 'custom' ? customPalette : PALETTES[selection];
}

function updateCustomColor(index, value, picker, swatch){
  const color = normalizeHex(value);
  if(!color) return;
  customPalette[index] = color;
  picker.value = color;
  swatch.style.backgroundColor = color;
  try {
    localStorage.setItem(CUSTOM_PALETTE_KEY, JSON.stringify(customPalette));
  } catch {
    // Keep editing usable when browser storage is disabled or full.
  }
  generate();
}

function palettePreview(){
  const region = $('#paletteRegion');
  const custom = $('#palette').value === 'custom';
  region.classList.toggle('is-custom', custom);
  region.replaceChildren();
  const label = document.createElement('span');
  label.className = 'palette-preview-label';
  label.textContent = custom ? 'Custom Palette' : 'Palette preview';
  region.appendChild(label);
  const colors = document.createElement('div');
  colors.className = custom ? 'custom-palette-grid' : 'pal';
  if(!custom) colors.setAttribute('aria-hidden', 'true');
  getActivePalette().forEach((color, index)=>{
    if(!custom){
      const swatch = document.createElement('div');
      swatch.className = 'sw';
      swatch.style.backgroundColor = color;
      colors.appendChild(swatch);
      return;
    }
    const control = document.createElement('div');
    control.className = 'custom-color';
    const swatch = document.createElement('label');
    swatch.className = 'custom-color-swatch';
    swatch.style.backgroundColor = color;
    const picker = document.createElement('input');
    picker.type = 'color';
    picker.value = color;
    picker.setAttribute('aria-label', `Choose custom palette color ${index + 1}`);
    swatch.appendChild(picker);
    const field = document.createElement('input');
    field.type = 'text';
    field.value = color;
    field.spellcheck = false;
    field.autocomplete = 'off';
    field.setAttribute('aria-label', `Custom palette color ${index + 1}`);
    field.addEventListener('input', ()=>{
      // Preserve the draft and caret while rendering only complete colors.
      updateCustomColor(index, field.value, picker, swatch);
    });
    field.addEventListener('blur', ()=>{ field.value = customPalette[index]; });
    picker.addEventListener('input', ()=>{
      field.value = normalizeHex(picker.value);
      updateCustomColor(index, picker.value, picker, swatch);
    });
    control.append(swatch, field);
    colors.appendChild(control);
  });
  region.appendChild(colors);
}

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
