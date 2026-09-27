// Run with Playwright available and the app served at http://127.0.0.1:8765.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {execFileSync}=require('node:child_process');

// Pure-function coverage: fit scaling and rotated hatch bounds/phase.
const fakeCanvas={width:1000,height:750,style:{},parentElement:{clientWidth:3000,clientHeight:2000},getContext:()=>({})};
const sandbox={document:{querySelector:()=>fakeCanvas},getComputedStyle:()=>({})};
vm.createContext(sandbox);
for(const file of ['js/utils.js','js/geometry.js','js/render.js']) vm.runInContext(fs.readFileSync(file,'utf8'),sandbox);
sandbox.fitCanvasToContainer(fakeCanvas);
assert.equal(fakeCanvas.style.width,'1000px'); assert.equal(fakeCanvas.style.height,'750px');
fakeCanvas.parentElement={clientWidth:200,clientHeight:100}; sandbox.fitCanvasToContainer(fakeCanvas);
assert.equal(fakeCanvas.style.width,'133px'); assert.equal(fakeCanvas.style.height,'100px');
for(const bounds of [[0,0,10,1000],[1600,500,1650,550],[-20,-100,20,100],[0,0,1680,720]]){
  const poly=sandbox.rectPolygon(...bounds);
  for(const step of [4,12,30]){
    const hatch=sandbox.hatchGeometry(poly,step);
    const diagonal=Math.hypot(bounds[2]-bounds[0],bounds[3]-bounds[1]);
    assert.ok(hatch.last-hatch.first+1<=Math.ceil((diagonal+2)/step)+1);
    for(const angle of [0,Math.PI/6,Math.PI/2]){
      const rotated=poly.map(p=>({x:Math.cos(angle)*(p.x-hatch.cx)+Math.sin(angle)*(p.y-hatch.cy)+hatch.cx,y:-Math.sin(angle)*(p.x-hatch.cx)+Math.cos(angle)*(p.y-hatch.cy)+hatch.cy}));
      assert.ok(rotated.every(p=>Math.abs(p.x-hatch.cx)<hatch.radius&&Math.abs(p.y-hatch.cy)<hatch.radius));
      const minY=Math.min(...rotated.map(p=>p.y)), maxY=Math.max(...rotated.map(p=>p.y));
      const firstIntersecting=Math.ceil((minY-hatch.origin)/step), lastIntersecting=Math.floor((maxY-hatch.origin)/step);
      assert.ok(hatch.first<=firstIntersecting&&hatch.last>=lastIntersecting);
    }
    // Any original grid line in the new coverage keeps its original position.
    const origin=bounds[1]-bounds[2];
    for(let index=Math.max(0,hatch.first);index<=hatch.last;index++) assert.equal(hatch.origin+index*step,origin+index*step);
  }
}
for(const step of [0,-1,Infinity,NaN]) assert.equal(sandbox.hatchGeometry(sandbox.rectPolygon(0,0,10,10),step),null);
assert.equal(sandbox.hatchGeometry([],12),null);

(async()=>{
  const browser=await chromium.launch({channel:'chrome',headless:true});
  try {
    const page=await browser.newPage({viewport:{width:1440,height:1000}});
    const errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    await page.goto('http://127.0.0.1:8765');
    assert.equal(await page.locator('#c').getAttribute('role'),'img');
    assert.equal(await page.getByRole('img',{name:'Generated Voronoi and Delaunay artwork'}).count(),1);
    assert.equal(await page.locator('#c').getAttribute('aria-describedby'),'statusSites statusResolution statusMotif statusSeed');
    assert.equal(await page.locator('#artworkAnnouncement').getAttribute('aria-live'),'polite');
    // Raw slider inputs must not mutate the live region, including across frames.
    await page.evaluate(()=>{
      window.announcements=0;
      window.statusObserver=new MutationObserver(records=>announcements+=records.length);
      statusObserver.observe($('#artworkAnnouncement'),{childList:true,characterData:true,subtree:true});
    });
    for(const value of [0.1,0.5,0.9]){
      await page.locator('#opacity').evaluate((input,value)=>{ input.value=String(value); input.dispatchEvent(new Event('input',{bubbles:true})); },value);
      await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    }
    assert.equal(await page.evaluate(()=>announcements),0);
    await page.locator('#opacity').dispatchEvent('change');
    await page.waitForFunction(()=>announcements>0);
    assert.ok((await page.locator('#artworkAnnouncement').textContent()).startsWith('Artwork updated.'));
    await page.locator('#opacity').focus();
    const before=await page.locator('#opacity').inputValue();
    await page.keyboard.press('ArrowLeft');
    assert.notEqual(await page.locator('#opacity').inputValue(),before);
    await page.locator('#motif').selectOption('centroids');
    assert.ok(await page.locator('#drawSites').isDisabled());
    await page.locator('#bgMode').focus(); await page.keyboard.press('Tab');
    assert.equal(await page.evaluate(()=>document.activeElement.id),'seed');
    await page.locator('#motif').selectOption('hatch');
    assert.ok(await page.locator('#hatchD').isEnabled());
    await page.locator('#opacity').focus(); await page.keyboard.press('Tab');
    assert.equal(await page.evaluate(()=>document.activeElement.id),'hatchD');
    await page.locator('#palette').selectOption('custom');
    const field=page.locator('.custom-color input[type=text]').first();
    assert.equal(await field.getAttribute('aria-describedby'),'customPaletteHelp');
    await field.focus(); await page.keyboard.press('Shift+Tab');
    assert.equal(await page.evaluate(()=>document.activeElement.type),'color');
    await page.keyboard.press('Tab'); await field.fill('abcdef'); await page.keyboard.press('Tab');
    assert.equal(await field.inputValue(),'#ABCDEF');
    await page.locator('#seed').fill('keyboard-stability'); await page.locator('#seed').press('Enter');
    await page.waitForFunction(()=>currentScene.state.seedStr==='keyboard-stability');
    await page.locator('#shuffle').focus(); await page.keyboard.press('Enter');
    await page.waitForFunction(()=>currentScene.state.seedStr!=='keyboard-stability');
    // All aspect ratios keep backing/export dimensions at large and small previews.
    for(const viewport of [{width:3840,height:2160},{width:480,height:900}]){
      await page.setViewportSize(viewport);
      for(const aspect of ['1x1','4x3','3x2','16x9','poster','2x3','ultra']){
        await page.locator('#aspect').selectOption(aspect);
        const dimensions=await page.evaluate(()=>{
          flushPendingRender(); fitCanvasToContainer(canvas);
          const svg=new DOMParser().parseFromString(buildSVG(currentScene.state,currentScene.geometry),'image/svg+xml');
          return {width:canvas.width,height:canvas.height,cssW:parseFloat(canvas.style.width),cssH:parseFloat(canvas.style.height),viewBox:svg.documentElement.getAttribute('viewBox')};
        });
        assert.ok(dimensions.cssW<=dimensions.width&&dimensions.cssH<=dimensions.height);
        assert.equal(dimensions.viewBox,`0 0 ${dimensions.width} ${dimensions.height}`);
      }
    }
    // Direct file usage continues to work without a server or module loading.
    const filePage=await browser.newPage();
    await filePage.goto(require('node:url').pathToFileURL(require('node:path').resolve('index.html')).href);
    assert.equal(await filePage.evaluate(()=>currentScene.geometry.pts.length),150);
    await filePage.close();
    const baseline=await browser.newPage();
    for(const file of ['js/utils.js','js/geometry.js','js/render.js','js/app.js']){
      const source=execFileSync('git',['-c','safe.directory=C:/Users/ghett/OneDrive/Documents/ChatGPT/voronoi-delaunay-art','show',`18c6c83:${file}`],{encoding:'utf8'});
      await baseline.route(`**/${file}*`,route=>route.fulfill({contentType:'text/javascript',body:source}));
    }
    await baseline.goto('http://127.0.0.1:8765');
    const snapshot=(target,settings)=>target.evaluate(settings=>{
      for(const [id,value] of Object.entries(settings)) $('#'+id).value=String(value);
      $('#drawSites').checked=false;
      setAspect();
      let strokes=0; const original=ctx.stroke;
      ctx.stroke=function(...args){ strokes++; return original.apply(this,args); };
      try { generate(); } finally { ctx.stroke=original; }
      palettePreview(); readSliders(); updateControlState(); updateStatus();
      const svg=buildSVG(currentScene.state,currentScene.geometry);
      return {png:canvas.toDataURL(),geometry:JSON.stringify(currentScene.geometry),strokes,svgBytes:svg.length};
    },settings);
    const metrics=[];
    for(const stress of [false,true]){
      const settings={motif:'hatch',nPts:stress?400:150,lloyd:stress?5:1,warp:stress?40:10,aspect:stress?'ultra':'4x3',seed:'voronoi-love-108',opacity:0.85,strokeW:1.2,hatchD:12,palette:'midnight',bgMode:'dark'};
      const actual=await snapshot(page,settings), previous=await snapshot(baseline,settings);
      assert.equal(actual.geometry,previous.geometry,'Pass 2 geometry remains exact');
      assert.ok(actual.strokes<previous.strokes/4,'At least 75% fewer hatch strokes');
      assert.ok(actual.svgBytes<previous.svgBytes/3,'At least 66% smaller hatch SVG');
      const meanDifference=await page.evaluate(async oldPNG=>{
        const image=new Image(); image.src=oldPNG; await image.decode();
        const copy=document.createElement('canvas'); copy.width=canvas.width; copy.height=canvas.height;
        const context=copy.getContext('2d'); context.drawImage(image,0,0);
        const before=context.getImageData(0,0,copy.width,copy.height).data;
        const after=ctx.getImageData(0,0,canvas.width,canvas.height).data;
        let total=0;
        for(let i=0;i<before.length;i++) total+=Math.abs(before[i]-after[i]);
        return total/before.length;
      },previous.png);
      assert.ok(meanDifference<0.5,`Hatch visual similarity: ${meanDifference}`);
      metrics.push({stress,oldStrokes:previous.strokes,newStrokes:actual.strokes,oldSVGBytes:previous.svgBytes,newSVGBytes:actual.svgBytes,meanDifference});
    }
    await page.setViewportSize({width:1440,height:1000});
    await page.screenshot({path:`${process.env.TEMP}/pass-three-hatch.png`,fullPage:true});
    assert.deepEqual(errors,[]);
    console.log('PASS: hatch coverage/phase, unchanged geometry, reduced strokes/SVG, preview/export sizing, file usage, keyboard controls, and quiet status semantics.');
    console.log('Hatch optimization:',JSON.stringify(metrics));
  } finally { await browser.close(); }
})().catch(error=>{ console.error(error); process.exitCode=1; });
