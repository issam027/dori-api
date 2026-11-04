/* Real browser only: no route interception, mocked APIs or public-client screens. */
const fs = require('node:fs');
const path = require('node:path');
const { performance } = require('node:perf_hooks');
const { chromium } = require(
  path.resolve('../dori-web/node_modules/playwright'),
);
const directory = path.resolve('.tmp-consolidation/saas-performance');
const fixture = JSON.parse(
  fs.readFileSync(path.join(directory, 'fixture.json')),
);
const base = 'http://127.0.0.1:18080';
const timings = [],
  network = [],
  errors = [],
  actions = [];
const clean = (value) =>
  String(value)
    .replace(/[a-f0-9]{8}-[a-f0-9-]{27,}/gi, ':id')
    .replace(/Bearer\s+\S+/gi, 'Bearer [redacted]')
    .slice(0, 250);
function save() {
  fs.writeFileSync(
    path.join(directory, 'browser-' + (process.argv[2] ?? 'smoke') + '.json'),
    JSON.stringify({ timings, network, errors, actions }, null, 2),
  );
}
async function createPage(browser, account, viewport) {
  const context = await browser.newContext({ viewport, locale: 'fr-FR' });
  await context.addInitScript(
    (site) => localStorage.setItem('dori.activeSiteId', site),
    fixture.site,
  );
  const page = await context.newPage();
  const starts = new Map();
  page.on('framenavigated', (frame) => {
    if (frame === page.mainFrame()) starts.clear();
  });
  let route = 'login';
  page.on('pageerror', (error) =>
    errors.push({
      profile: viewport.width,
      route,
      message: clean(error.message),
    }),
  );
  page.on('request', (request) => {
    if (request.url().includes('/api/')) starts.set(request, performance.now());
  });
  page.on('requestfinished', async (request) => {
    const start = starts.get(request);
    starts.delete(request);
    if (start === undefined) return;
    const response = await request.response();
    network.push({
      profile: viewport.width,
      route,
      path: clean(new URL(request.url()).pathname),
      method: request.method(),
      status: response?.status() ?? 0,
      ms: +(performance.now() - start).toFixed(2),
    });
  });
  page.on('requestfailed', (request) => {
    starts.delete(request);
    const message = request.failure()?.errorText ?? '';
    if (!message.includes('ABORTED'))
      errors.push({
        profile: viewport.width,
        route,
        message: clean(message),
        path: clean(new URL(request.url()).pathname),
      });
  });
  await page.goto(base + '/login', { waitUntil: 'domcontentloaded' });
  await page.locator('input[name="username"]').fill(account.username);
  await page.locator('input[name="password"]').fill(account.password);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL((url) => !url.pathname.includes('login'), {
    timeout: 30000,
  });
  await page.goto(base + '/desk', { waitUntil: 'domcontentloaded' });
  await page
    .locator('main')
    .first()
    .waitFor({ state: 'visible', timeout: 30000 });
  const settle = async () => {
    let stable = 0;
    const deadline = performance.now() + 45000;
    while (performance.now() < deadline) {
      const pending = [...starts.keys()].filter(
        (request) => !request.url().includes('/realtime/'),
      );
      stable = pending.length === 0 ? stable + 1 : 0;
      if (stable >= 4) return;
      await page.waitForTimeout(100);
    }
    throw new Error(
      'Business requests did not settle within 45 seconds: ' +
        [...starts.keys()]
          .map((request) => clean(new URL(request.url()).pathname))
          .join(', '),
    );
  };
  return { page, context, settle, setRoute: (value) => (route = value) };
}
async function navigate(handle, route, viewport, round) {
  const { page } = handle;
  handle.setRoute(route);
  const started = performance.now();
  let method = 'link';
  try {
    if (viewport.width < 768) {
      if (!(await page.locator('.sidebar.is-mobile-open').count())) {
        await page.locator('.mobile-menu-trigger').click();
        await page
          .locator('.sidebar.is-mobile-open')
          .waitFor({ state: 'visible' });
      }
      const section = [
        '/desk',
        '/my-queues',
        '/persons',
        '/appointments',
      ].includes(route)
        ? 'Opérations'
        : ['/control-room', '/reports', '/notifications'].includes(route)
          ? 'Pilotage'
          : ['/audit', '/health', '/admin/translations'].includes(route)
            ? 'Système'
            : 'Administration';
      const toggle = page
        .locator('.sidebar .nav-section-toggle')
        .filter({ hasText: section })
        .first();
      if (
        (await toggle.count()) &&
        (await toggle.getAttribute('aria-expanded')) === 'false'
      )
        await toggle.click();
    }
    const link = page.locator(`a[href="${route}"]`).first();
    if (await link.isVisible().catch(() => false)) {
      if (
        viewport.width < 768 &&
        (await page.locator('.sidebar.is-mobile-open').count()) &&
        !(await link.evaluate((element) =>
          Boolean(element.closest('.sidebar')),
        ))
      ) {
        await page.locator('.sidebar-mobile-close').click();
      }
      await link.click();
      await page.waitForURL((url) => url.pathname === route, {
        timeout: 20000,
      });
    } else {
      method = 'document';
      await page.goto(base + route, { waitUntil: 'domcontentloaded' });
    }
    await page
      .locator('main')
      .first()
      .waitFor({ state: 'visible', timeout: 30000 });
    await handle.settle();
    const expected = {
      '/desk': 'cockpit',
      '/persons': 'annuaire',
      '/appointments': 'rendez-vous',
      '/control-room': 'supervision',
      '/reports': 'rapports',
      '/audit': 'audit',
    }[route];
    if (expected)
      await page.waitForFunction(
        (value) =>
          new RegExp(value, 'i').test(
            document.querySelector('.topbar-title-route h1')?.textContent ?? '',
          ),
        expected,
        { timeout: 30000 },
      );
    const rendered = await page.locator('main').innerText();
    const horizontalOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth + 2,
    );
    timings.push({
      profile: viewport.width,
      route,
      at: new Date().toISOString(),
      round,
      method,
      ms: +(performance.now() - started).toFixed(2),
      characters: rendered.length,
      horizontalOverflow,
      finalPath: new URL(page.url()).pathname,
      visibleAlerts: await page
        .locator('main [role="alert"]')
        .allTextContents(),
    });
    if (rendered.length < 10 || new URL(page.url()).pathname !== route)
      errors.push({
        profile: viewport.width,
        route,
        message: 'Unexpected route or empty main',
      });
    if (round === 0)
      await page.screenshot({
        path: path.join(
          directory,
          `${viewport.width}-${route.replace(/\//g, '_')}.png`,
        ),
        fullPage: true,
      });
    save();
  } catch (error) {
    errors.push({
      profile: viewport.width,
      route,
      message: clean(error.message),
    });
    save();
  }
}
async function controls(handle, viewport) {
  const { page } = handle;
  for (const route of ['/persons', '/audit', '/appointments', '/reports']) {
    await navigate(handle, route, viewport, 1);
    const started = performance.now();
    try {
      if (route === '/persons') {
        const search = page.locator('main input[type="search"]').first();
        if (await search.isVisible()) {
          await search.fill('Amine');
          await page.waitForTimeout(1000);
          await search.fill('');
          actions.push({
            profile: viewport.width,
            name: 'directory-search',
            passed: true,
            ms: performance.now() - started,
          });
        }
      }
      if (route === '/appointments') {
        const buttons = page.locator('main button');
        const next = buttons.filter({ hasText: /suivant/i }).first();
        const labelled = page
          .getByRole('button', {
            name: /semaine suivante|période suivante|jour suivant/i,
          })
          .first();
        const target = (await labelled.isVisible().catch(() => false))
          ? labelled
          : next;
        if (await target.isVisible().catch(() => false)) {
          await target.click();
          await page.waitForTimeout(1000);
          actions.push({
            profile: viewport.width,
            name: 'calendar-next-period',
            passed: true,
            ms: performance.now() - started,
          });
        }
      }
      if (route === '/reports') {
        for (const title of ['Comparaison', 'Répartition', 'Évolution']) {
          const button = page.getByRole('button', { name: title, exact: true });
          if (await button.isVisible().catch(() => false)) {
            await button.click();
            await page.waitForTimeout(300);
            actions.push({
              profile: viewport.width,
              name: 'report-' + title,
              passed: true,
            });
          }
        }
      }
      save();
    } catch (error) {
      actions.push({
        profile: viewport.width,
        name: route,
        passed: false,
        error: clean(error.message),
      });
      save();
    }
  }
}
async function runBrowser() {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const smoke = !['load', 'mobile'].includes(process.argv[2]);
    const views =
      process.argv[2] === 'mobile'
        ? [{ width: 390, height: 844 }]
        : smoke
          ? [{ width: 1440, height: 1000 }]
          : [
              { width: 1440, height: 1000 },
              { width: 1024, height: 768 },
              { width: 390, height: 844 },
            ];
    for (const viewport of views) {
      const handle = await createPage(
        browser,
        fixture.accounts.find((account) => account.role === 'root') ??
          fixture.accounts[0],
        viewport,
      );
      const routes = [
        '/desk',
        '/my-queues',
        '/persons',
        '/appointments',
        '/control-room',
        '/reports',
        '/notifications',
        '/audit',
        '/portfolio',
        '/settings/sites',
        '/settings/queues',
        '/settings/tiers',
        '/admin/users',
        '/admin/translations',
        '/health',
        '/onboarding',
      ];
      for (let round = 0; round < (smoke ? 1 : 2); round++)
        for (const route of routes)
          await navigate(handle, route, viewport, round);
      await controls(handle, viewport);
      await handle.context.close();
    }
    save();
    console.log(
      JSON.stringify({
        navigations: timings.length,
        apiRequests: network.length,
        pageErrors: errors.length,
        httpErrors: network.filter((r) => r.status >= 400).length,
        actions: actions.length,
      }),
    );
  } finally {
    await browser.close();
  }
}
module.exports = { createPage };
if (require.main === module)
  runBrowser().catch((error) => {
    console.error(clean(error.message));
    process.exitCode = 1;
    save();
  });
