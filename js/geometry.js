/* ========= Geometry helpers ========= */
function circumcircle(tri){ // tri: [{x,y},{x,y},{x,y}]
  const [a,b,c]=tri;
  const d = 2*(a.x*(b.y-c.y)+b.x*(c.y-a.y)+c.x*(a.y-b.y));
  if (Math.abs(d) < 1e-9) return {x:Infinity,y:Infinity,r:Infinity};
  const ux = ((a.x*a.x + a.y*a.y)*(b.y-c.y) + (b.x*b.x + b.y*b.y)*(c.y-a.y) + (c.x*c.x + c.y*c.y)*(a.y-b.y)) / d;
  const uy = ((a.x*a.x + a.y*a.y)*(c.x-b.x) + (b.x*b.x + b.y*b.y)*(a.x-c.x) + (c.x*c.x + c.y*c.y)*(b.x-a.x)) / d;
  const r = Math.hypot(a.x-ux,a.y-uy);
  return {x:ux,y:uy,r};
}

/* ========= Delaunay via Bowyer–Watson ========= */
function delaunay(points, bounds){
  // Super triangle big enough to cover bounds
  const {minX, minY, maxX, maxY} = bounds;
  const dx = maxX-minX, dy = maxY-minY, delta = Math.max(dx,dy)*4;
  const midx = (minX+maxX)/2, midy=(minY+maxY)/2;
  const stA = {x:midx - delta, y:midy - delta};
  const stB = {x:midx + delta, y:midy - delta};
  const stC = {x:midx, y:midy + delta};
  let triangles = [{a:stA,b:stB,c:stC}];

  function ccOf(t){ return circumcircle([t.a,t.b,t.c]); }

  for(const p of points){
    const bad = [];
    for(const t of triangles){
      const cc = ccOf(t);
      if (Math.hypot(p.x-cc.x,p.y-cc.y) <= cc.r) bad.push(t);
    }
    // Polygonal hole boundary edges: edges that are not shared by two bad triangles
    const edges = [];
    function addEdge(e){
      // if reverse exists, remove it (internal); else push
      const revIdx = edges.findIndex(ed => (ed[0]===e[1] && ed[1]===e[0]));
      if(revIdx>=0) edges.splice(revIdx,1); else edges.push(e);
    }
    for(const t of bad){
      addEdge([t.a,t.b]); addEdge([t.b,t.c]); addEdge([t.c,t.a]);
    }
    triangles = triangles.filter(t => !bad.includes(t));
    for(const [u,v] of edges){
      triangles.push({a:u,b:v,c:p});
    }
  }
  // Remove triangles connected to super triangle
  triangles = triangles.filter(t => ![t.a,t.b,t.c].some(v => v===stA || v===stB || v===stC));
  return triangles;
}

/* ========= Voronoi via half-plane intersection (closed cells) ========= */
function clipPolygonWithLine(poly, linePoint, lineNormal){
  // Keep points on the side where dot(p - linePoint, lineNormal) <= 0
  const out = [];
  for(let i=0;i<poly.length;i++){
    const a = poly[i], b = poly[(i+1)%poly.length];
    const da = (a.x-linePoint.x)*lineNormal.x + (a.y-linePoint.y)*lineNormal.y;
    const db = (b.x-linePoint.x)*lineNormal.x + (b.y-linePoint.y)*lineNormal.y;
    const ina = da<=1e-9, inb = db<=1e-9;
    if(ina && inb){ out.push(b); }
    else if(ina && !inb){
      // leaving — add intersection
      const t = da/(da-db);
      out.push({x: a.x + (b.x-a.x)*t, y: a.y + (b.y-a.y)*t});
    } else if(!ina && inb){
      // entering — add intersection + b
      const t = da/(da-db);
      out.push({x: a.x + (b.x-a.x)*t, y: a.y + (b.y-a.y)*t}, b);
    }
  }
  return out;
}
function rectPolygon(minX,minY,maxX,maxY){
  return [{x:minX,y:minY},{x:maxX,y:minY},{x:maxX,y:maxY},{x:minX,y:maxY}];
}
function voronoiCells(sites, bounds){
  // For each site, start with rectangle and clip against bisectors with *all* sites.
  // (For many points this is O(n^2); acceptable up to ~200-300.)
  const {minX,minY,maxX,maxY} = bounds;
  return sites.map((s,i)=>{
    let poly = rectPolygon(minX,minY,maxX,maxY);
    for(let j=0;j<sites.length;j++){
      if(i===j) continue;
      const o = sites[j];
      // Perpendicular bisector keeping side closer to s than o
      const mid = {x:(s.x+o.x)/2, y:(s.y+o.y)/2};
      const n = {x:o.x - s.x, y:o.y - s.y}; // normal pointing toward o
      // keep side where dot(p-mid,n) <= 0  (closer to s)
      poly = clipPolygonWithLine(poly, mid, n);
      if(poly.length===0) break;
    }
    return poly;
  });
}
function isFinitePoint(p){
  return !!p && Number.isFinite(p.x) && Number.isFinite(p.y);
}
function isValidPolygon(poly){
  return Array.isArray(poly) && poly.length >= 3 && poly.every(isFinitePoint);
}
function polygonCentroid(poly){
  if(!isValidPolygon(poly)) return null;
  let a=0, cx=0, cy=0;
  for(let i=0;i<poly.length;i++){
    const p = poly[i], q = poly[(i+1)%poly.length];
    const w = p.x*q.y - q.x*p.y;
    a += w; cx += (p.x+q.x)*w; cy += (p.y+q.y)*w;
  }
  a *= 0.5;
  if(Math.abs(a)<1e-7){
    // fallback average
    let sx=0, sy=0; for(const p of poly){ sx+=p.x; sy+=p.y; }
    const n = poly.length;
    const c = {x:sx/n, y:sy/n, area:0};
    return isFinitePoint(c) ? c : null;
  }
  const c = {x:cx/(6*a), y:cy/(6*a), area:Math.abs(a)};
  return isFinitePoint(c) && Number.isFinite(c.area) ? c : null;
}
