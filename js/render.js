/* ========= Core render ========= */
const canvas = $('#c'); const ctx = canvas.getContext('2d');
const RENDER_STYLE = {
  voronoiStroke: '#0c1428',
  delaunayStroke: '#0a0f1c',
  dualOverlayStroke: '#ffffff',
  dualOverlayAlpha: 0.55,
  wireframeOverlayAlpha: 0.18,
  hatchAlpha: 0.55,
  siteFill: '#ffffff',
  siteAlpha: 0.9,
  siteRadius: 1.9,
  centroidRadius: 2.2,
  darkBackground: '#09101d',
  paperBackground: '#f6f7fb',
  gradientInner: '#0c1020',
  gradientOuter: '#070a12'
};

function setAspect(){
  const v = $('#aspect').value;
  const map = { '1x1':[1000,1000], '4x3':[1280,960], '3x2':[1440,960], '16x9':[1440,810], 'poster':[1200,1600], '2x3':[1200,1800], 'ultra':[1680,720] };
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
      return c && c.area > 0 ? {x: c.x, y: c.y} : p;
    });
  }
  return pts;
}

/* Warp field using simplex noise */
function warpPoints(points, noise, warpAmt, scale, bounds){
  if (warpAmt<=0) return points;
  return points.map(p=>{
    const nx = noise.noise(p.x/scale, p.y/scale);
    const ny = noise.noise((p.x+1000)/scale, (p.y-333)/scale);
    const a = Math.atan2(ny, nx);
    const epsilon = 1e-6;
    return {
      x: Math.max(bounds.minX+epsilon, Math.min(bounds.maxX-epsilon, p.x + Math.cos(a)*warpAmt)),
      y: Math.max(bounds.minY+epsilon, Math.min(bounds.maxY-epsilon, p.y + Math.sin(a)*warpAmt))
    };
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
    ctx.fillStyle = RENDER_STYLE.paperBackground; ctx.fillRect(0,0,w,h);
    // subtle paper grain
    const grd = ctx.createLinearGradient(0,0,0,h);
    grd.addColorStop(0,'rgba(0,0,0,0)');
    grd.addColorStop(1,'rgba(0,0,0,0.05)');
    ctx.fillStyle=grd; ctx.fillRect(0,0,w,h);
  } else if(mode==='gradient'){
    const g = ctx.createRadialGradient(w*.5,h*.5,Math.min(w,h)*.1, w*.5,h*.5, Math.hypot(w,h)*.6);
    g.addColorStop(0,RENDER_STYLE.gradientInner); g.addColorStop(1,RENDER_STYLE.gradientOuter); ctx.fillStyle=g; ctx.fillRect(0,0,w,h);
  } else {
    ctx.fillStyle = RENDER_STYLE.darkBackground; ctx.fillRect(0,0,w,h);
  }
}

function pathPolygon(poly){
  if(!isValidPolygon(poly)) return false;
  ctx.beginPath();
  ctx.moveTo(poly[0].x, poly[0].y);
  for(let i=1;i<poly.length;i++) ctx.lineTo(poly[i].x, poly[i].y);
  ctx.closePath();
  return true;
}

/* Hatching fill inside polygon using clip() */
function polygonBounds(poly){
  return poly.reduce((b,p)=>({
    minX:Math.min(b.minX,p.x), minY:Math.min(b.minY,p.y),
    maxX:Math.max(b.maxX,p.x), maxY:Math.max(b.maxY,p.y)
  }), {minX:Infinity,minY:Infinity,maxX:-Infinity,maxY:-Infinity});
}
function hatchFill(poly, step, angle, strokeStyle, alpha){
  if(!pathPolygon(poly)) return;
  ctx.save();
  ctx.clip();
  ctx.globalAlpha *= alpha;
  ctx.strokeStyle = strokeStyle;
  ctx.lineWidth = 1;
  const bb = polygonBounds(poly);
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
function polyToSVGPath(poly){
  return isValidPolygon(poly) ? 'M '+poly.map(p=>`${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' L ')+' Z' : '';
}
function hatchToSVG(poly, step, angle, color, opacity, id){
  const path = polyToSVGPath(poly);
  if(!path) return '';
  const bb = polygonBounds(poly);
  const cx=(bb.minX+bb.maxX)/2, cy=(bb.minY+bb.maxY)/2;
  let lines = '';
  // Match the existing Canvas hatch spacing, origin and coverage.
  for(let y=bb.minY-bb.maxX; y<=bb.maxY+bb.maxX; y+=step){
    lines += `<path d="M ${bb.minX-1000} ${y} L ${bb.maxX+1000} ${y}"/>`;
  }
  return `<defs><clipPath id="${id}" clipPathUnits="userSpaceOnUse"><path d="${path}"/></clipPath></defs>` +
    `<g clip-path="url(#${id})"><g transform="rotate(${angle*180/Math.PI} ${cx} ${cy})" fill="none" stroke="${color}" stroke-width="1" stroke-opacity="${opacity*RENDER_STYLE.hatchAlpha}" stroke-linecap="round">${lines}</g></g>`;
}
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
  if (warpAmt>0) pts = warpPoints(pts, noise, warpAmt, 220, bounds);
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
  if(motif==='delaunay-fill' || motif==='wireframe'){
    let i=0;
    for(const t of tris){
      const col = pal[i++ % pal.length];
      const poly = [t.a,t.b,t.c];
      if(!isValidPolygon(poly)) continue;
      if(motif!=='wireframe'){
        ctx.fillStyle = col;
        pathPolygon(poly); ctx.fill();
      }
      if(strokeW > 0){
        ctx.strokeStyle = RENDER_STYLE.delaunayStroke;
        ctx.lineWidth = strokeW;
        pathPolygon(poly);
        ctx.stroke();
      }
    }
  }

  if(motif==='voronoi-fill' || motif==='dual' || motif==='hatch' || motif==='voronoi-outline' || motif==='centroids'){
    let i=0;
    for(const poly of cells){
      const col = pal[i++ % pal.length];
      if(!isValidPolygon(poly)) continue;

      if(motif==='hatch'){
        if(strokeW > 0) hatchFill(poly, hatchDensity, (i%2)*Math.PI/6, col, RENDER_STYLE.hatchAlpha);
      } else if(motif!=='voronoi-outline' && motif!=='centroids'){
        ctx.fillStyle = col; pathPolygon(poly); ctx.fill();
      }

      // edges: CanvasRenderingContext2D ignores lineWidth=0, so do not stroke at all.
      if(motif!=='centroids' && motif!=='dual' && strokeW > 0){
        ctx.strokeStyle = RENDER_STYLE.voronoiStroke;
        ctx.lineWidth = strokeW;
        pathPolygon(poly);
        ctx.stroke();
      }

      if(motif==='centroids'){
        const c = polygonCentroid(poly);
        if(!c) continue;
        ctx.fillStyle = col;
        ctx.beginPath(); ctx.arc(c.x, c.y, RENDER_STYLE.centroidRadius, 0, Math.PI*2); ctx.fill();
      }
    }
  }

  // Dual layers: all fills, then cell edges, then the Delaunay overlay.
  if(motif==='dual' && strokeW > 0){
    ctx.strokeStyle = RENDER_STYLE.voronoiStroke;
    ctx.lineWidth = strokeW;
    for(const poly of cells){ if(pathPolygon(poly)) ctx.stroke(); }
    ctx.globalAlpha = Math.min(1, opacity+0.05) * RENDER_STYLE.dualOverlayAlpha;
    ctx.strokeStyle = RENDER_STYLE.dualOverlayStroke;
    ctx.lineWidth = Math.max(0.6, strokeW*0.7);
    for(const t of tris){ if(pathPolygon([t.a,t.b,t.c])) ctx.stroke(); }
  }

  // Preserve the existing wireframe treatment.
  if(motif==='wireframe' && strokeW > 0){
    ctx.globalAlpha = Math.min(1, opacity+0.05) * RENDER_STYLE.wireframeOverlayAlpha;
    ctx.strokeStyle = RENDER_STYLE.dualOverlayStroke;
    ctx.lineWidth = Math.max(0.6, strokeW*0.7);
    for(const poly of cells){ if(pathPolygon(poly)) ctx.stroke(); }
  }

  // Optional draw sites
  if($('#drawSites').checked && motif!=='centroids'){
    ctx.globalAlpha = RENDER_STYLE.siteAlpha;
    ctx.fillStyle = RENDER_STYLE.siteFill;
    for(const p of pts){ if(!isFinitePoint(p)) continue; ctx.beginPath(); ctx.arc(p.x,p.y,RENDER_STYLE.siteRadius,0,Math.PI*2); ctx.fill(); }
  }

  ctx.restore();

  // Prepare SVG data for export
  const currentSVG = (()=>{
    const w=canvas.width, h=canvas.height;
    let svg = `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">\n`;
    // bg
    if(bgMode==='paper'){
      svg += `<defs><linearGradient id="paper-shade" x1="0" y1="0" x2="0" y2="${h}" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#000000" stop-opacity="0"/><stop offset="1" stop-color="#000000" stop-opacity="0.05"/></linearGradient></defs>`;
      svg += `<rect width="100%" height="100%" fill="${RENDER_STYLE.paperBackground}"/><rect width="100%" height="100%" fill="url(#paper-shade)"/>`;
    } else if(bgMode==='gradient'){
      svg += `<defs><radialGradient id="background-gradient" cx="${w*.5}" cy="${h*.5}" r="${Math.hypot(w,h)*.6}" fr="${Math.min(w,h)*.1}" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="${RENDER_STYLE.gradientInner}"/><stop offset="1" stop-color="${RENDER_STYLE.gradientOuter}"/></radialGradient></defs>`;
      svg += `<rect width="100%" height="100%" fill="url(#background-gradient)"/>`;
    } else {
      svg += `<rect width="100%" height="100%" fill="${RENDER_STYLE.darkBackground}"/>`;
    }
    // content
    // Share the palette resolved for this Canvas render.
    const strokePath = (poly, color, width, alpha)=>{
      const path = polyToSVGPath(poly);
      return path && strokeW > 0 ? `<path d="${path}" fill="none" stroke="${color}" stroke-width="${width}" stroke-opacity="${alpha}" stroke-linejoin="round" stroke-linecap="round"/>` : '';
    };
    if(motif==='delaunay-fill' || motif==='wireframe'){
      let i=0;
      for(const t of tris){
        const col = pal[i++ % pal.length];
        const poly = [t.a,t.b,t.c];
        const path = polyToSVGPath(poly);
        if(!path) continue;
        if(motif!=='wireframe'){
          svg += `<path d="${path}" fill="${col}" fill-opacity="${opacity}"/>`;
        }
        svg += strokePath(poly, RENDER_STYLE.delaunayStroke, strokeW, opacity);
      }
    }
    if(['voronoi-fill','dual','hatch','voronoi-outline','centroids'].includes(motif)){
      let i=0;
      for(const poly of cells){
        const col = pal[i++ % pal.length];
        const path = polyToSVGPath(poly);
        if(!path) continue;
        if(motif==='voronoi-fill' || motif==='dual'){
          svg += `<path d="${path}" fill="${col}" fill-opacity="${opacity}"/>`;
        } else if(motif==='hatch' && strokeW > 0){
          svg += hatchToSVG(poly, hatchDensity, (i%2)*Math.PI/6, col, opacity, `hatch-${i}`);
        } else if(motif==='centroids'){
          const c = polygonCentroid(poly);
          if(c) svg += `<circle cx="${c.x.toFixed(2)}" cy="${c.y.toFixed(2)}" r="${RENDER_STYLE.centroidRadius}" fill="${col}" fill-opacity="${opacity}"/>`;
        }
        if(motif!=='centroids' && motif!=='dual'){
          svg += strokePath(poly, RENDER_STYLE.voronoiStroke, strokeW, opacity);
        }
      }
    }
    if(motif==='dual' && strokeW > 0){
      for(const poly of cells) svg += strokePath(poly, RENDER_STYLE.voronoiStroke, strokeW, opacity);
      for(const t of tris) svg += strokePath([t.a,t.b,t.c], RENDER_STYLE.dualOverlayStroke, Math.max(0.6,strokeW*0.7), Math.min(1,opacity+0.05)*RENDER_STYLE.dualOverlayAlpha);
    }
    if(motif==='wireframe' && strokeW > 0){
      for(const poly of cells) svg += strokePath(poly, RENDER_STYLE.dualOverlayStroke, Math.max(0.6,strokeW*0.7), Math.min(1,opacity+0.05)*RENDER_STYLE.wireframeOverlayAlpha);
    }
    if($('#drawSites').checked && motif!=='centroids'){
      for(const p of pts){
        if(isFinitePoint(p)) svg += `<circle cx="${p.x.toFixed(2)}" cy="${p.y.toFixed(2)}" r="${RENDER_STYLE.siteRadius}" fill="${RENDER_STYLE.siteFill}" fill-opacity="${RENDER_STYLE.siteAlpha}"/>`;
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
