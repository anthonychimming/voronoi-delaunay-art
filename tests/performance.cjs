// Run with Playwright available and the app served at http://127.0.0.1:8765.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');

(async()=>{
  const browser=await chromium.launch({channel:'chrome',headless:true});
  try {
    const page=await browser.newPage();
    const errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    await page.goto('http://127.0.0.1:8765');
    await page.evaluate(()=>{
      window.calls={compute:0,cells:0,tris:0,canvas:0,svg:0};
      const originalCompute=computeGeometry, originalCells=voronoiCells, originalTris=delaunay;
      const originalCanvas=renderCanvas, originalSVG=buildSVG;
      window.renderDurations=[];
      computeGeometry=function(...args){ calls.compute++; return originalCompute(...args); };
      voronoiCells=function(...args){ calls.cells++; return originalCells(...args); };
      delaunay=function(...args){ calls.tris++; return originalTris(...args); };
      renderCanvas=function(...args){
        calls.canvas++; const start=performance.now();
        try { return originalCanvas(...args); }
        finally { renderDurations.push(performance.now()-start); }
      };
      buildSVG=function(...args){ calls.svg++; return originalSVG(...args); };
      window.resetCalls=()=>Object.keys(calls).forEach(key=>calls[key]=0);
      window.setControl=(id,value,event)=>{
        const input=$('#'+id);
        if(input.type==='checkbox') input.checked=value;
        else input.value=String(value);
        input.dispatchEvent(new Event(event||(['nPts','lloyd','warp','opacity','strokeW','hatchD'].includes(id)?'input':'change'),{bubbles:true}));
      };
      window.waitForRender=()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
    });
    const initial=await page.evaluate(()=>{
      for(const [id,value] of [['nPts',400],['lloyd',5],['warp',40],['aspect','ultra']]) setControl(id,value);
      const before={...calls};
      flushPendingRender();
      return {before,after:{...calls},sites:currentScene.geometry.pts.length,width:canvas.width,height:canvas.height};
    });
    assert.equal(initial.before.compute,0);
    assert.deepEqual(initial.after,{compute:1,cells:6,tris:1,canvas:1,svg:0});
    assert.equal(initial.sites,400); assert.equal(initial.width,1680); assert.equal(initial.height,720);
    const timings=[];
    for(const [id,value] of [['opacity',0.5],['strokeW',2],['palette','sakura'],['bgMode','gradient'],['motif','dual'],['drawSites',true],['motif','hatch'],['hatchD',30]]){
      const result=await page.evaluate(async({id,value})=>{
        resetCalls(); const geometry=currentScene.geometry;
        const start=performance.now(); setControl(id,value);
        await waitForRender();
        return {calls:{...calls},same:currentScene.geometry===geometry,ms:performance.now()-start,drawMs:renderDurations.at(-1)};
      },{id,value});
      assert.deepEqual(result.calls,{compute:0,cells:0,tris:0,canvas:1,svg:0},id);
      assert.ok(result.same,id); timings.push({id,frameMs:Math.round(result.ms),drawMs:Math.round(result.drawMs)});
    }
    const custom=await page.evaluate(async()=>{
      setControl('palette','custom'); await waitForRender(); resetCalls();
      const geometry=currentScene.geometry;
      const oldPalette=currentScene.state.pal;
      const field=$('.custom-color input[type=text]');
      field.value='#123456'; field.dispatchEvent(new Event('input',{bubbles:true}));
      const oldUnchanged=oldPalette[0]!=='#123456';
      await waitForRender();
      return {calls:{...calls},same:currentScene.geometry===geometry,oldUnchanged,color:currentScene.state.pal[0]};
    });
    assert.deepEqual(custom.calls,{compute:0,cells:0,tris:0,canvas:1,svg:0});
    assert.ok(custom.same&&custom.oldUnchanged); assert.equal(custom.color,'#123456');
    const burst=await page.evaluate(async()=>{
      resetCalls();
      for(let i=0;i<100;i++) setControl('opacity',i%2?0.5:1);
      const before={...calls};
      await waitForRender();
      return {before,after:{...calls},opacity:currentScene.state.opacity,pending:renderRequestId};
    });
    assert.equal(burst.before.canvas,0);
    assert.deepEqual(burst.after,{compute:0,cells:0,tris:0,canvas:1,svg:0});
    assert.equal(burst.opacity,0.5); assert.equal(burst.pending,null);
    for(const [id,value] of [['seed','pass-two'],['nPts',399],['lloyd',4],['warp',39],['aspect','poster']]){
      const result=await page.evaluate(async({id,value})=>{
        resetCalls(); setControl(id,value); await waitForRender(); return {...calls};
      },{id,value});
      assert.equal(result.compute,1,id); assert.equal(result.tris,1,id);
      assert.equal(result.cells,id==='seed'||id==='nPts'?6:5,id);
      assert.equal(result.svg,0,id);
    }
    for(const dimension of ['width','height']){
      const result=await page.evaluate(dimension=>{
        resetCalls(); canvas[dimension]++; generate(); return {...calls};
      },dimension);
      assert.equal(result.compute,1,dimension);
    }
    const svgExport=await page.evaluate(async()=>{
      const handlers=[$('#saveSvg').onclick,$('#savePng').onclick];
      const originalDownload=download;
      let svgPromise;
      download=(filename,url)=>{ svgPromise=fetch(url).then(r=>r.text()); };
      try {
        resetCalls(); setControl('opacity',0.05); setControl('drawSites',false);
        $('#saveSvg').click();
        const svg=await svgPromise;
        await waitForRender();
        return {calls:{...calls},svg,pending:renderRequestId,stable:handlers[0]===$('#saveSvg').onclick&&handlers[1]===$('#savePng').onclick};
      } finally { download=originalDownload; }
    });
    assert.deepEqual(svgExport.calls,{compute:0,cells:0,tris:0,canvas:1,svg:1});
    assert.ok(svgExport.svg.includes('stroke-opacity="0.027500000000000004"'));
    assert.equal(svgExport.pending,null); assert.ok(svgExport.stable);
    const nullPNG=await page.evaluate(()=>{
      const original=canvas.toBlob, originalCreate=URL.createObjectURL;
      let urls=0;
      canvas.toBlob=callback=>callback(null);
      URL.createObjectURL=(...args)=>{ urls++; return originalCreate.apply(URL,args); };
      try {
        resetCalls(); setControl('seed','pending-png'); $('#savePng').click();
        return {urls,calls:{...calls},seed:currentScene.state.seedStr,pending:renderRequestId};
      }
      finally { canvas.toBlob=original; URL.createObjectURL=originalCreate; }
    });
    assert.equal(nullPNG.urls,0);
    assert.deepEqual(nullPNG.calls,{compute:1,cells:5,tris:1,canvas:1,svg:0});
    assert.equal(nullPNG.seed,'pending-png'); assert.equal(nullPNG.pending,null);
    // Exercise real browser downloads and observe eventual cleanup for both types.
    await page.evaluate(()=>{
      window.createdURLs=[]; window.revokedURLs=[];
      const create=URL.createObjectURL, revoke=URL.revokeObjectURL;
      URL.createObjectURL=function(blob){ const url=create.call(this,blob); createdURLs.push(url); return url; };
      URL.revokeObjectURL=function(url){ revokedURLs.push(url); return revoke.call(this,url); };
    });
    for(const id of ['saveSvg','savePng']){
      const [download]=await Promise.all([page.waitForEvent('download'),page.locator('#'+id).click()]);
      assert.equal(await download.failure(),null);
      assert.ok(download.suggestedFilename().endsWith(id==='saveSvg'?'.svg':'.png'));
    }
    await page.waitForFunction(()=>createdURLs.length===2&&createdURLs.every(url=>revokedURLs.includes(url)));
    // Keep exact parity with Pass 1 for motifs unaffected by hatch optimization.
    const baseline=await browser.newPage();
    const gitArgs=['-c','safe.directory=C:/Users/ghett/OneDrive/Documents/ChatGPT/voronoi-delaunay-art','show'];
    for(const file of ['js/render.js','js/app.js']){
      const source=execFileSync('git',[...gitArgs,`58bf412:${file}`],{encoding:'utf8'});
      await baseline.route(`**/${file}*`,route=>route.fulfill({contentType:'text/javascript',body:source}));
    }
    await baseline.goto('http://127.0.0.1:8765');
    const snapshots=async(target,motif)=>target.evaluate(async motif=>{
      for(const [id,value] of [['nPts',80],['lloyd',2],['warp',40],['seed','pass-two-parity'],['aspect','ultra'],['motif',motif],['opacity',0.5],['strokeW',1.2],['hatchD',12],['bgMode','gradient'],['palette','midnight']]) $('#'+id).value=String(value);
      $('#drawSites').checked=true;
      setAspect(); generate();
      const png=canvas.toDataURL();
      let promise; const originalDownload=download;
      download=(filename,url)=>{ promise=fetch(url).then(r=>r.text()); };
      try { $('#saveSvg').onclick(); return {png,svg:await promise}; }
      finally { download=originalDownload; }
    },motif);
    for(const motif of ['voronoi-fill','voronoi-outline','delaunay-fill','wireframe','dual','centroids']){
      const actual=await snapshots(page,motif), expected=await snapshots(baseline,motif);
      assert.ok(actual.png===expected.png,`${motif}: exact Pass 1 Canvas pixels`);
      assert.ok(actual.svg===expected.svg,`${motif}: exact Pass 1 SVG output`);
    }
    assert.deepEqual(errors,[]);
    console.log('PASS: cache invalidation/reuse at stress settings, frame coalescing, lazy SVG, pending-export flush, stable handlers, null PNG, URL cleanup, and exact Pass 1 pixel/SVG parity for non-hatch motifs.');
    console.log('Appearance control end-to-end frame timings (ms):',JSON.stringify(timings));
  } finally { await browser.close(); }
})().catch(error=>{ console.error(error); process.exitCode=1; });
