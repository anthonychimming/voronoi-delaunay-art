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
    const palette = page.locator('#palette');
    await palette.selectOption('custom');
    const fields = page.locator('.custom-color input[type=text]');
    assert.equal(await fields.count(), 6);
    assert.equal(await page.locator('.pal').count(), 0);
    await fields.first().focus();
    await page.keyboard.press('Shift+Tab');
    assert.equal(await page.evaluate(()=>document.activeElement.type), 'color');
    assert.equal(await page.locator('.custom-color-swatch').first().evaluate(el=>getComputedStyle(el).outlineStyle), 'solid');
    const geometry = ()=>page.evaluate(()=>{
      const paths = [];
      const original = ctx.lineTo;
      ctx.lineTo = function(x,y){ paths.push([x,y]); return original.call(this,x,y); };
      generate();
      ctx.lineTo = original;
      return JSON.stringify(paths);
    });
    const before = await geometry();
    const seed = await page.locator('#seed').inputValue();
    for(const [draft, expected] of [['ff006e','#FF006E'],['457b9d','#457B9D']]){
      await fields.first().fill(draft);
      assert.equal(await fields.first().inputValue(), draft);
      assert.equal(await page.evaluate(()=>getActivePalette()[0]), expected);
      await fields.first().blur();
      assert.equal(await fields.first().inputValue(), expected);
    }
    for(const draft of ['#','#F','#FF','#FF0','#FF00','#FF006','HELLO','']){
      await fields.first().fill(draft);
      assert.equal(await fields.first().inputValue(), draft);
      assert.equal(await page.evaluate(()=>getActivePalette()[0]), '#457B9D');
    }
    await fields.first().blur();
    assert.equal(await fields.first().inputValue(), '#457B9D');
    await page.locator('.custom-color input[type=color]').first().evaluate(input=>{
      input.value = '#abcdef';
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    assert.equal(await fields.first().inputValue(), '#ABCDEF');
    assert.equal(await geometry(), before);
    assert.equal(await page.locator('#seed').inputValue(), seed);
    await palette.selectOption('sakura');
    assert.equal(await page.locator('.sw').count(), 6);
    await palette.selectOption('custom');
    assert.equal(await fields.first().inputValue(), '#ABCDEF');
    await page.reload();
    await palette.selectOption('custom');
    assert.equal(await fields.first().inputValue(), '#ABCDEF');
    const exported = await page.evaluate(async()=>{
      let exportedBlob;
      const original = download;
      download = async(name,url)=>{ exportedBlob = await fetch(url).then(r=>r.blob()); };
      await $('#saveSvg').onclick();
      // download() is intentionally asynchronous in this test harness.
      while(!exportedBlob) await new Promise(resolve=>setTimeout(resolve, 10));
      const svg = await exportedBlob.text();
      exportedBlob = null;
      $('#savePng').onclick();
      while(!exportedBlob) await new Promise(resolve=>setTimeout(resolve, 10));
      const png = exportedBlob;
      const rendered = await new Promise(resolve=>canvas.toBlob(resolve, 'image/png'));
      const pngBytes = new Uint8Array(await png.arrayBuffer());
      const renderedBytes = new Uint8Array(await rendered.arrayBuffer());
      const same = pngBytes.length === renderedBytes.length && pngBytes.every((byte, i)=>byte === renderedBytes[i]);
      download = original;
      return { svg, pngType: png.type, same };
    });
    assert.ok(exported.svg.includes('#ABCDEF'));
    assert.equal(exported.pngType, 'image/png');
    assert.ok(exported.same);
    for(const width of [1440,1180,920,720,480,320]){
      await page.setViewportSize({ width, height: 1000 });
      assert.ok(await page.evaluate(()=>{
        const region = $('#paletteRegion');
        return document.documentElement.scrollWidth <= innerWidth && region.scrollWidth <= region.clientWidth &&
          [...region.querySelectorAll('input[type=text]')].every(input=>input.clientWidth >= 70 && input.scrollWidth <= input.clientWidth);
      }), `Overflow at ${width}px`);
      await page.screenshot({ path: `${process.env.TEMP}/custom-palette-${width}.png`, fullPage: true });
    }
    for(const value of await palette.locator('option').evaluateAll(options=>options.map(o=>o.value))){
      await palette.selectOption(value);
    }
    for(const value of await page.locator('#motif option').evaluateAll(options=>options.map(o=>o.value))){
      await page.locator('#motif').selectOption(value);
    }
    for(const id of ['bgMode','aspect']){
      for(const value of await page.locator(`#${id} option`).evaluateAll(options=>options.map(o=>o.value))){
        await page.locator(`#${id}`).selectOption(value);
      }
    }
    await page.locator('#motif').selectOption('voronoi-fill');
    await page.locator('#drawSites').check();
    for(const [id,value] of [['nPts','80'],['lloyd','2'],['warp','20'],['strokeW','0'],['opacity','0.5']]){
      await page.locator(`#${id}`).fill(value);
    }
    await page.locator('#seed').fill('palette-regression');
    await page.locator('#seed').press('Enter');
    await page.locator('#shuffle').click();
    assert.notEqual(await page.locator('#seed').inputValue(), 'palette-regression');
    for(const malformed of ['{','null','{}','[]','["#FFFFFF"]', JSON.stringify(Array(6).fill('red'))]){
      await page.evaluate(value=>localStorage.setItem('voronoiDelaunay.customPalette', value), malformed);
      await page.reload();
      await palette.selectOption('custom');
      assert.equal(await fields.first().inputValue(), '#264653');
    }
    await page.addInitScript(()=>{
      Storage.prototype.getItem = Storage.prototype.setItem = ()=>{ throw new Error('Storage blocked'); };
    });
    await page.reload();
    await palette.selectOption('custom');
    await fields.first().fill('123456');
    assert.equal(await page.evaluate(()=>getActivePalette()[0]), '#123456');
    assert.deepEqual(errors, []);
    console.log('PASS: validation, persistence, blocked storage, palette switching, geometry, exports, responsive sizes, and existing controls.');
  } finally {
    await browser.close();
  }
})().catch(error=>{ console.error(error); process.exitCode = 1; });
