// Run with Playwright available and the app served at http://127.0.0.1:8765.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');

(async()=>{
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const errors = [];
    page.on('pageerror', error=>errors.push(error.message));
    await page.goto('http://127.0.0.1:8765');
    await page.evaluate(()=>{
      window.renderCheck = async(settings={})=>{
        for(const [id,value] of Object.entries(settings)){
          const control = $('#'+id);
          if(control.type==='checkbox') control.checked=value;
          else control.value=String(value);
        }
        setAspect(); updateControlState(); readSliders(); updateStatus();
        const events=[];
        const originals={};
        let currentPath=[];
        for(const method of ['beginPath','moveTo','lineTo','arc','fill','stroke']){
          originals[method]=ctx[method];
          ctx[method]=function(...args){
            if(method==='beginPath') currentPath=[];
            if(['moveTo','lineTo','arc'].includes(method)) currentPath.push({method,args});
            if(method==='fill'||method==='stroke') events.push({method,path:[...currentPath],alpha:this.globalAlpha,color:method==='fill'?this.fillStyle:this.strokeStyle,width:this.lineWidth});
            return originals[method].apply(this,args);
          };
        }
        try { generate(); } finally { Object.assign(ctx,originals); }
        let svg;
        const originalDownload=download;
        download=(name,url)=>{ svg=fetch(url).then(r=>r.text()); URL.revokeObjectURL(url); };
        try { $('#saveSvg').onclick(); svg=await svg; } finally { download=originalDownload; }
        const xml=new DOMParser().parseFromString(svg,'image/svg+xml');
        if(xml.querySelector('parsererror')) throw new Error('Invalid SVG XML');
        const paths=[...xml.querySelectorAll('path')];
        const circles=[...xml.querySelectorAll('circle')].map(p=>({x:+p.getAttribute('cx'),y:+p.getAttribute('cy'),r:+p.getAttribute('r')}));
        return {events,svg,circles,viewBox:xml.documentElement.getAttribute('viewBox'),width:canvas.width,height:canvas.height,strokes:paths.filter(p=>p.hasAttribute('stroke')||p.closest('g[stroke]')).length};
      };
      window.checkGeometry = seed=>{
        const bounds={minX:0,minY:0,maxX:canvas.width,maxY:canvas.height};
        const random=randomPoints(400,seededPRNG(seed),bounds);
        const warped=warpPoints(random,Simplex2D(seed),40,220,bounds);
        const points=lloydRelax(warped,bounds,5);
        const cells=voronoiCells(points,bounds);
        return {serialized:JSON.stringify({points,cells,tris:delaunay(points,bounds)}),valid:warped.every(p=>isFinitePoint(p)&&p.x>0&&p.y>0&&p.x<canvas.width&&p.y<canvas.height)&&points.every(isFinitePoint)&&cells.every(isValidPolygon)};
      };
    });
    const render = settings=>page.evaluate(s=>renderCheck(s),settings);
    const motifs=['voronoi-fill','voronoi-outline','delaunay-fill','wireframe','dual','centroids','hatch'];
    const ratios={'1x1':[1000,1000],'4x3':[1280,960],'3x2':[1440,960],'16x9':[1440,810],poster:[1200,1600],'2x3':[1200,1800],ultra:[1680,720]};
    for(const [aspect,[width,height]] of Object.entries(ratios)){
      for(const motif of motifs){
        const result=await render({aspect,motif,nPts:20,lloyd:1,warp:40,strokeW:1.2,opacity:1,drawSites:true});
        assert.equal(result.viewBox,`0 0 ${width} ${height}`);
        assert.equal(result.width,width); assert.equal(result.height,height);
        assert.ok(!/NaN|Infinity|M\s*Z/.test(result.svg));
      }
      const geometry=await page.evaluate(()=>checkGeometry('stress-pass-one'));
      assert.ok(geometry.valid,`400 points / Lloyd 5 / Warp 40: ${aspect}`);
    }
    const first=await page.evaluate(()=>checkGeometry('determinism'));
    const repeat=await page.evaluate(()=>checkGeometry('determinism'));
    const different=await page.evaluate(()=>checkGeometry('different-seed'));
    assert.equal(first.serialized,repeat.serialized);
    assert.notEqual(first.serialized,different.serialized);
    for(const motif of motifs){
      const result=await render({motif,strokeW:0,nPts:20,lloyd:0,warp:0});
      assert.equal(result.events.filter(e=>e.method==='stroke').length,0,motif);
      assert.equal(result.strokes,0,motif);
    }
    for(const motif of ['voronoi-fill','voronoi-outline','hatch','dual','delaunay-fill','wireframe','centroids']){
      const result=await render({motif,strokeW:1.2,drawSites:true});
      const arcs=result.events.flatMap(e=>e.path.filter(p=>p.method==='arc'));
      const expectedRadius=motif==='centroids'?2.2:1.9;
      assert.equal(arcs.length,20,motif);
      assert.ok(arcs.every(p=>p.args[2]===expectedRadius),motif);
      assert.equal(result.circles.length,20);
      assert.ok(result.circles.every(p=>p.r===expectedRadius));
      for(let i=0;i<20;i++){
        assert.ok(Math.abs(arcs[i].args[0]-result.circles[i].x)<0.006);
        assert.ok(Math.abs(arcs[i].args[1]-result.circles[i].y)<0.006);
      }
      if(motif==='centroids') assert.ok(await page.locator('#drawSites').isDisabled());
      else assert.ok(result.events.slice(-20).every(e=>e.path[0].method==='arc'));
    }
    const dual=await render({motif:'dual',opacity:1,drawSites:true});
    const fills=dual.events.filter(e=>e.method==='fill'&&e.path[0].method!=='arc');
    const edges=dual.events.filter(e=>e.method==='stroke'&&e.color==='#0c1428');
    const overlay=dual.events.filter(e=>e.method==='stroke'&&e.color==='#ffffff');
    assert.equal(fills.length,20); assert.equal(edges.length,20); assert.ok(overlay.length>0);
    assert.ok(dual.events.indexOf(fills.at(-1))<dual.events.indexOf(edges[0]));
    assert.ok(dual.events.indexOf(edges.at(-1))<dual.events.indexOf(overlay[0]));
    assert.ok(dual.svg.lastIndexOf('fill-opacity="1"')<dual.svg.indexOf('stroke="#0c1428"'));
    assert.ok(dual.svg.lastIndexOf('stroke="#0c1428"')<dual.svg.indexOf('stroke="#ffffff"'));
    for(const opacity of [1,0.5,0.05]){
      const hatch=await render({motif:'hatch',opacity,drawSites:false});
      const lines=hatch.events.filter(e=>e.method==='stroke'&&e.width===1);
      assert.ok(lines.length>0);
      assert.ok(lines.every(e=>Math.abs(e.alpha-opacity*0.55)<1e-6));
      assert.ok(hatch.svg.includes('clipPath'));
      assert.ok(hatch.svg.includes(`stroke-opacity="${opacity*0.55}"`));
    }
    for(const bgMode of ['paper','gradient','dark']){
      const result=await render({bgMode});
      assert.ok(result.svg.includes(bgMode==='paper'?'linearGradient':bgMode==='gradient'?'radialGradient':'#09101d'));
    }
    // Rasterize the vector export in the browser and compare it with the Canvas.
    // Allow small antialiasing differences from SVG's two-decimal coordinates.
    for(const motif of motifs){
      const result=await render({motif,aspect:'4x3',nPts:20,opacity:0.5,drawSites:true,bgMode:'gradient'});
      const difference=await page.evaluate(async svg=>{
        const image=new Image();
        const url=URL.createObjectURL(new Blob([svg],{type:'image/svg+xml'}));
        try {
          image.src=url; await image.decode();
          const copy=document.createElement('canvas'); copy.width=canvas.width; copy.height=canvas.height;
          const context=copy.getContext('2d'); context.drawImage(image,0,0);
          const actual=ctx.getImageData(0,0,canvas.width,canvas.height).data;
          const exported=context.getImageData(0,0,canvas.width,canvas.height).data;
          let total=0;
          for(let i=0;i<actual.length;i++) total+=Math.abs(actual[i]-exported[i]);
          return total/actual.length;
        } finally { URL.revokeObjectURL(url); }
      },result.svg);
      assert.ok(difference<1,`${motif}: Canvas/SVG mean channel difference ${difference}`);
    }
    const invalid=await page.evaluate(async()=>{
      const originalCells=voronoiCells, originalTris=delaunay;
      try {
        voronoiCells=()=>[[],[{x:NaN,y:0},{x:1,y:1},{x:0,y:1}],null,[{x:10,y:10},{x:30,y:10},{x:10,y:30}]];
        delaunay=()=>[{a:{x:Infinity,y:0},b:{x:1,y:1},c:{x:0,y:1}},{a:{x:10,y:10},b:{x:30,y:10},c:{x:10,y:30}}];
        const point={x:8,y:9};
        const kept=lloydRelax([point],{minX:0,minY:0,maxX:100,maxY:100},1)[0];
        const results=[];
        for(const motif of ['voronoi-fill','voronoi-outline','delaunay-fill','wireframe','dual','hatch','centroids']) results.push(await renderCheck({motif,lloyd:0,drawSites:false}));
        return {kept,centroid:polygonCentroid([]),invalid:polygonCentroid([{x:NaN,y:0},{x:1,y:1},{x:0,y:1}]),path:polyToSVGPath([]),results};
      } finally { voronoiCells=originalCells; delaunay=originalTris; }
    });
    assert.deepEqual(invalid.kept,{x:8,y:9});
    assert.equal(invalid.centroid,null); assert.equal(invalid.invalid,null); assert.equal(invalid.path,'');
    for(const result of invalid.results) assert.ok(!/NaN|Infinity|M\s*Z/.test(result.svg));
    await render({motif:'dual',aspect:'4x3',nPts:150,lloyd:1,warp:10,opacity:1,drawSites:true,bgMode:'dark'});
    await page.screenshot({path:`${process.env.TEMP}/pass-one-dual.png`,fullPage:true});
    await render({motif:'hatch',drawSites:false,opacity:0.5});
    await page.screenshot({path:`${process.env.TEMP}/pass-one-hatch.png`,fullPage:true});
    assert.deepEqual(errors,[]);
    console.log('PASS: all motifs/aspects, stress geometry, determinism, zero strokes, sites/centroids, Dual ordering, hatch opacity, SVG XML/backgrounds, and invalid geometry.');
  } finally { await browser.close(); }
})().catch(error=>{ console.error(error); process.exitCode=1; });
