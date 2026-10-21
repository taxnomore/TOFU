// Browser smoke test (optional, not part of `npm test`).
//
//   npm run build && npm run start          # in a first terminal
//   npm install --no-save playwright && npx playwright install chromium
//   node scripts/smoke-test.mjs             # in a second terminal
//
// Environment: SMOKE_URL (default http://localhost:8080/), CHROMIUM_PATH (a
// Chromium binary, if Playwright's own browser is not installed).
//
// 1. Solo as a human: walk with the keyboard from the bedroom through the
//    house, open the garden door and the garden gate, go out by the front gate
//    to the street and the square (one continuous world).
// 2. Phone (touch emulation): joystick, Action button, camera swipe.
const URL_BASE = process.env.SMOKE_URL ?? 'http://localhost:8080/';

let pw;
try {
  pw = await import('playwright');
} catch {
  try {
    pw = await import('playwright-core');
  } catch {
    console.error('Playwright manque : npm install --no-save playwright && npx playwright install chromium');
    process.exit(2);
  }
}
const launch = { args: ['--ignore-gpu-blocklist', '--no-proxy-server'] };
if (process.env.CHROMIUM_PATH) launch.executablePath = process.env.CHROMIUM_PATH;
const browser = await pw.chromium.launch(launch);
const url = URL_BASE + (URL_BASE.includes('?') ? '&' : '?') + 'q=low&fast';
let failures = 0;
const check = (ok, what) => {
  console.log(`${ok ? 'OK  ' : 'ÉCHEC'} ${what}`);
  if (!ok) failures++;
};

async function open(viewport, mobile = false) {
  const ctx = await browser.newContext({ viewport, isMobile: mobile, hasTouch: mobile });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => {
    failures++;
    console.log('ERREUR page :', e.message);
  });
  await page.goto(url, { waitUntil: 'load', timeout: 60000 });
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 90000 });
  return { ctx, page };
}

// ---------------------------------------------------------------- 1. route
{
  const { page: P } = await open({ width: 800, height: 450 });
  await P.click('button[data-a=solo]');
  await P.click('.choice[data-role=human]');
  await P.click('button[data-go]');
  await P.waitForFunction(() => window.__tofu.app.session?.state.phase === 'play', null, { timeout: 60000 });
  const me = 1;
  const state = () => P.evaluate((me) => {
    const s = window.__tofu.app.session;
    const c = s.state.chars[me];
    const pr = document.querySelector('.vp-prompt');
    return { x: c.x, z: c.z, yaw: s.locals[0].rig.yaw, prompt: pr && pr.style.display !== 'none' ? pr.textContent : '' };
  }, me);
  const path = (tx, tz) => P.evaluate(([me, tx, tz]) => {
    const g = window.__tofu.app.helper;
    const c = g.state.chars[me];
    return g.world.humanNav.findPath(c.x, c.z, tx, tz, () => 0);
  }, [me, tx, tz]);
  const clear = (ax, az, bx, bz) => P.evaluate(([ax, az, bx, bz]) => window.__tofu.app.helper.world.humanNav.lineClear(ax, az, bx, bz), [ax, az, bx, bz]);
  const held = new Set();
  const keys = async (want) => {
    for (const k of ['w', 'a', 's', 'd']) {
      if (want.has(k) && !held.has(k)) { await P.keyboard.down(k); held.add(k); }
      if (!want.has(k) && held.has(k)) { await P.keyboard.up(k); held.delete(k); }
    }
  };
  async function goTo(tx, tz) {
    let pts = await path(tx, tz);
    if (!pts) return false;
    let i = 0;
    let best = 1e9;
    let stuck = Date.now();
    const t0 = Date.now();
    while (Date.now() - t0 < 90000) {
      const s = await state();
      while (i < pts.length - 1 && Math.hypot(pts[i].x - s.x, pts[i].z - s.z) < 0.8 && await clear(s.x, s.z, pts[i + 1].x, pts[i + 1].z)) i++;
      const end = pts[pts.length - 1];
      const dEnd = Math.hypot(end.x - s.x, end.z - s.z);
      if (dEnd < 0.8) {
        await keys(new Set());
        return true;
      }
      const dx = pts[i].x - s.x;
      const dz = pts[i].z - s.z;
      const d = Math.hypot(dx, dz) || 1;
      const sn = Math.sin(s.yaw);
      const cs = Math.cos(s.yaw);
      const sx = (-cs * dx + sn * dz) / d;
      const sy = (sn * dx + cs * dz) / d;
      const want = new Set();
      if (sy > 0.38) want.add('w');
      if (sy < -0.38) want.add('s');
      if (sx > 0.38) want.add('d');
      if (sx < -0.38) want.add('a');
      await keys(want);
      if (dEnd < best - 0.3) {
        best = dEnd;
        stuck = Date.now();
      }
      if (/Ouvrir/.test(s.prompt) && Date.now() - stuck > 600) {
        await P.keyboard.press('Space');
        await P.waitForTimeout(300);
      }
      if (Date.now() - stuck > 4000) {
        pts = (await path(tx, tz)) ?? pts;
        i = 0;
        best = 1e9;
        stuck = Date.now();
      }
      await P.waitForTimeout(50);
    }
    await keys(new Set());
    return false;
  }
  const route = [
    ['à la chambre', -11, -3], ["à l'entrée", -6.5, 4.2], ['au jardin (porte du jardin)', -4, 10], ['au portillon', 6.8, 7.5],
    ["à l'allée", 8.8, 2], ['au trottoir (portail)', 8.3, -14.6], ['à la rue', -10, -19.5], ['au square', -21, -6],
  ];
  for (const [name, x, z] of route) {
    const ok = await goTo(x, z);
    check(ok, `l'humain marche jusqu'${name}`);
    if (!ok) break;
  }
  await P.context().close();
}

// ---------------------------------------------------------------- 2. phone
{
  const { ctx, page: C } = await open({ width: 844, height: 390 }, true);
  await C.tap('button[data-a=solo]');
  await C.waitForTimeout(400);
  await C.tap('button[data-go]');
  await C.waitForFunction(() => window.__tofu.app.session?.state.phase === 'play', null, { timeout: 60000 });
  const cdp = await ctx.newCDPSession(C);
  const touch = (type, touchPoints) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints });
  const info = () => C.evaluate(() => {
    const s = window.__tofu.app.session;
    const c = s.state.chars[0];
    return { yaw: s.locals[0].rig.yaw, z: c.z, knocks: s.state.stats.knocks };
  });
  const a = await info();
  await touch('touchStart', [{ x: 150, y: 280, id: 1 }]);
  for (let i = 1; i <= 6; i++) {
    await touch('touchMove', [{ x: 150, y: 280 - i * 8, id: 1 }]);
    await C.waitForTimeout(30);
  }
  await C.waitForTimeout(1200);
  await touch('touchEnd', []);
  await C.waitForTimeout(400);
  const b = await info();
  check(Math.abs(b.z - a.z) > 2, 'le joystick tactile déplace Tofu');
  const box = await C.locator('.tbtn.t-action').boundingBox();
  await touch('touchStart', [{ x: box.x + box.width / 2, y: box.y + box.height / 2, id: 3 }]);
  await C.waitForTimeout(250);
  await touch('touchEnd', []);
  await C.waitForTimeout(800);
  const c = await info();
  check(c.knocks > b.knocks, 'le bouton Action fait tomber le vase');
  await touch('touchStart', [{ x: 600, y: 140, id: 7 }]);
  for (let i = 1; i <= 8; i++) {
    await touch('touchMove', [{ x: 600 - i * 20, y: 140, id: 7 }]);
    await C.waitForTimeout(40);
  }
  await touch('touchEnd', []);
  await C.waitForTimeout(400);
  const d = await info();
  check(Math.abs(d.yaw - c.yaw) > 0.3, 'glisser à droite tourne la caméra');
  await ctx.close();
}

await browser.close();
console.log(failures ? `${failures} échec(s)` : 'Tout est bon.');
process.exit(failures ? 1 : 0);
