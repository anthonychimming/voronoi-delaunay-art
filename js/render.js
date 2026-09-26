/* ========= Core render ========= */
const canvas = $('#c'); const ctx = canvas.getContext('2d');

function setAspect(){
  const v = $('#aspect').value;
  const map = { '1x1':[1000,1000], '4x3':[1280,960], '16x9':[1440,810], 'poster':[1200,1600], 'ultra':[1680,720] };
  const [w,h] = map[v] || [1280,960];
  canvas.width = w; canvas.height = h;
  fitCanvasToContainer(canvas);
}

/* Lloyd relaxation: move points to centroids of Voronoi cells */
function lloydRelax(points, bounds, iterations){
  if(iterations<=0) return points;
  let pts = points.map(p=>({x:p.x,y:p.y}));
  for(let k=0;k<iterations;k++){
    const cells = voronoiCells(pts, bounds);
    pts = pts.map((p,i)=>{
      const c = polygonCentroid(cells[i]);
      return {x: c.x, y: c.y};
    });
  }
  return pts;
}

/* Warp field using simplex noise */
function warpPoints(points, noise, warpAmt, scale){
  if (warpAmt<=0) return points;
  return points.map(p=>{
    const nx = noise.noise(p.x/scale, p.y/scale);
    const ny = noise.noise((p.x+1000)/scale, (p.y-333)/scale);
    const a = Math.atan2(ny, nx);
    return { x: p.x + Math.cos(a)*warpAmt, y: p.y + Math.sin(a)*warpAmt };
  });
}

function randomPoints(n, rand, bounds){
  const {minX,minY,maxX,maxY} = bounds;
  const w=maxX-minX, h=maxY-minY;
  const pts=[];
  for(let i=0;i<n;i++) pts.push({x:minX+rand()*w, y:minY+rand()*h});
  return pts;
}

function drawBackground(mode,w,h){
  if(mode==='paper'){
    ctx.fillStyle = '#f6f7fb'; ctx.fillRect(0,0,w,h);
    // subtle paper grain
    const grd = ctx.createLinearGradient(0,0,0,h);
    grd.addColorStop(0,'rgba(0,0,0,0)');
    grd.addColorStop(1,'rgba(0,0,0,0.05)');
    ctx.fillStyle=grd; ctx.fillRect(0,0,w,h);
  } else if(mode==='gradient'){
    const g = ctx.createRadialGradient(w*.5,h*.5,Math.min(w,h)*.1, w*.5,h*.5, Math.hypot(w,h)*.6);
    g.addColorStop(0,'#0c1020'); g.addColorStop(1,'#070a12'); ctx.fillStyle=g; ctx.fillRect(0,0,w,h);
  } else {
    ctx.fillStyle = '#09101d'; ctx.fillRect(0,0,w,h);
  }
}

function pathPolygon(poly){
  ctx.beginPath();
  if(poly.length===0) return;
  ctx.moveTo(poly[0].x, poly[0].y);
  for(let i=1;i<poly.length;i++) ctx.lineTo(poly[i].x, poly[i].y);
  ctx.closePath();
}

/* Hatching fill inside polygon using clip() */
function hatchFill(poly, step, angle, strokeStyle, alpha){
  pathPolygon(poly);
  ctx.save();
  ctx.clip();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = strokeStyle;
  ctx.lineWidth = 1;
  const bb = poly.reduce((b,p)=>({
    minX:Math.min(b.minX,p.x), minY:Math.min(b.minY,p.y),
    maxX:Math.max(b.maxX,p.x), maxY:Math.max(b.maxY,p.y)
  }), {minX:Infinity,minY:Infinity,maxX:-Infinity,maxY:-Infinity});
  const cx=(bb.minX+bb.maxX)/2, cy=(bb.minY+bb.maxY)/2;
  ctx.translate(cx,cy); ctx.rotate(angle); ctx.translate(-cx,-cy);
  for(let y=bb.minY- bb.maxX; y<=bb.maxY+bb.maxX; y+=step){
    ctx.beginPath();
    ctx.moveTo(bb.minX-1000, y);
    ctx.lineTo(bb.maxX+1000, y);
    ctx.stroke();
  }
  ctx.restore();
}

/* SVG export helpers */
function polyToSVGPath(poly){ return 'M '+poly.map(p=>`${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' L ')+' Z'; }
function download(filename, dataUrl){
  const a=document.createElement('a'); a.href=dataUrl; a.download=filename; document.body.appendChild(a); a.click(); a.remove();
}

/* Main generate/render */
function generate(){
  const motif = $('#motif').value;
  const n = +$('#nPts').value;
  const seedStr = $('#seed').value.trim() || 'seed';
  const strokeW = +$('#strokeW').value;
  const opacity = +$('#opacity').value;
  const warpAmt = +$('#warp').value;
  const hatchDensity = +$('#hatchD').value;
  const bgMode = $('#bgMode').value;
  const pal = getActivePalette();

  const rand = seededPRNG(seedStr);
  const noise = Simplex2D(seedStr);
  const bounds = {minX:0,minY:0,maxX:canvas.width,maxY:canvas.height};

  // points
  let pts = randomPoints(n, rand, bounds);
  if (warpAmt>0) pts = warpPoints(pts, noise, warpAmt, 220);
  const lloydIters = +$('#lloyd').value;
  if (lloydIters>0) pts = lloydRelax(pts, bounds, lloydIters);

  // structures
  const tris = delaunay(pts, bounds);
  const cells = voronoiCells(pts, bounds);

  // draw
  ctx.save();
  drawBackground(bgMode, canvas.width, canvas.height);

  ctx.globalAlpha = opacity;
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';

  // Render motifs
  if(motif==='delaunay-fill' || motif==='dual' || motif==='wireframe'){
    let i=0;
    for(const t of tris){
      const col = pal[i++ % pal.length];
      if(motif!=='wireframe'){
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.moveTo(t.a.x,t.a.y); ctx.lineTo(t.b.x,t.b.y); ctx.lineTo(t.c.x,t.c.y); ctx.closePath(); ctx.fill();
      }
      if(strokeW > 0){
        ctx.strokeStyle = '#0a0f1c';
        ctx.lineWidth = strokeW;
        ctx.beginPath();
        ctx.moveTo(t.a.x,t.a.y); ctx.lineTo(t.b.x,t.b.y); ctx.lineTo(t.c.x,t.c.y); ctx.closePath();
        ctx.stroke();
      }
    }
  }

  if(motif==='voronoi-fill' || motif==='dual' || motif==='hatch' || motif==='voronoi-outline' || motif==='centroids'){
    let i=0;
    for(const poly of cells){
      const col = pal[i++ % pal.length];

      if(motif==='hatch'){
        hatchFill(poly, hatchDensity, (i%2)*Math.PI/6, col, 0.55);
      } else if(motif!=='voronoi-outline' && motif!=='centroids'){
        ctx.fillStyle = col; pathPolygon(poly); ctx.fill();
      }

      // edges: CanvasRenderingContext2D ignores lineWidth=0, so do not stroke at all.
      if(motif!=='centroids' && strokeW > 0){
        ctx.strokeStyle = '#0c1428';
        ctx.lineWidth = strokeW;
        pathPolygon(poly);
        ctx.stroke();
      }

      if(motif==='centroids' || $('#drawSites').checked){
        const c = polygonCentroid(poly);
        ctx.fillStyle = col;
        ctx.beginPath(); ctx.arc(c.x, c.y, 2.2, 0, Math.PI*2); ctx.fill();
      }
    }
  }

  // Wireframe overlay (dual). Respect a zero stroke width as "no lines".
  if((motif==='dual' || motif==='wireframe') && strokeW > 0){
    ctx.globalAlpha = Math.min(1, opacity+0.05);
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.lineWidth = Math.max(0.6, strokeW*0.7);
    for(const poly of cells){ pathPolygon(poly); ctx.stroke(); }
  }

  // Optional draw sites
  if($('#drawSites').checked && motif!=='centroids'){
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = '#ffffff';
    for(const p of pts){ ctx.beginPath(); ctx.arc(p.x,p.y,1.9,0,Math.PI*2); ctx.fill(); }
  }

  ctx.restore();

  // Prepare SVG data for export
  const currentSVG = (()=>{
    const w=canvas.width, h=canvas.height;
    let svg = `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">\n`;
    // bg
    if($('#bgMode').value==='paper'){
      svg += `<rect width="100%" height="100%" fill="#f6f7fb"/>`;
    } else {
      svg += `<rect width="100%" height="100%" fill="#09101d"/>`;
    }
    // content
    // Share the palette resolved for this Canvas render.
    const stroke = '#0c1428';
    if(motif==='delaunay-fill' || motif==='dual' || motif==='wireframe'){
      let i=0;
      for(const t of tris){
        const col = pal[i++ % pal.length];
        if(motif!=='wireframe'){
          svg += `<path d="M ${t.a.x.toFixed(2)} ${t.a.y.toFixed(2)} L ${t.b.x.toFixed(2)} ${t.b.y.toFixed(2)} L ${t.c.x.toFixed(2)} ${t.c.y.toFixed(2)} Z" fill="${col}" fill-opacity="${$('#opacity').value}"/>`;
        }
        svg += `<path d="M ${t.a.x.toFixed(2)} ${t.a.y.toFixed(2)} L ${t.b.x.toFixed(2)} ${t.b.y.toFixed(2)} L ${t.c.x.toFixed(2)} ${t.c.y.toFixed(2)} Z" fill="none" stroke="${stroke}" stroke-width="${$('#strokeW').value}"/>`;
      }
    }
    if(motif!=='delaunay-fill'){
      let i=0;
      for(const poly of cells){
        const col = pal[i++ % pal.length];
        if(motif==='voronoi-fill' || motif==='dual'){
          svg += `<path d="${polyToSVGPath(poly)}" fill="${col}" fill-opacity="${$('#opacity').value}"/>`;
        } else if(motif==='voronoi-outline'){
          // no fill
        } else if(motif==='centroids'){
          const c = polygonCentroid(poly);
          svg += `<circle cx="${c.x.toFixed(2)}" cy="${c.y.toFixed(2)}" r="2.2" fill="${col}" fill-opacity="${$('#opacity').value}"/>`;
        }
        if(motif!=='centroids'){
          svg += `<path d="${polyToSVGPath(poly)}" fill="none" stroke="${stroke}" stroke-width="${$('#strokeW').value}" stroke-opacity="${$('#opacity').value}"/>`;
        }
      }
    }
    svg += `\n</svg>`;
    return svg;
  })();

  // wire up export buttons (late-bind so they grab latest state)
  $('#savePng').onclick = ()=>{
    canvas.toBlob(b=> download(`tessellation-${Date.now()}.png`, URL.createObjectURL(b)), 'image/png', 0.95);
  };
  $('#saveSvg').onclick = ()=>{
    const blob = new Blob([currentSVG], {type:'image/svg+xml'});
    download(`tessellation-${Date.now()}.svg`, URL.createObjectURL(blob));
  };
}

function readSliders(){
  $('#nPtsV').textContent = $('#nPts').value;
  $('#lloydV').textContent = $('#lloyd').value;
  $('#strokeWV').textContent = $('#strokeW').value;
  $('#opacityV').textContent = $('#opacity').value;
  $('#warpV').textContent = $('#warp').value;
  $('#hatchDV').textContent = $('#hatchD').value;
}
