const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium } = require(
  path.resolve('../dori-web/node_modules/playwright'),
);
const { createPage } = require('./saas-browser.cjs');
const folder = path.resolve('.tmp-consolidation/saas-performance');
const fixture = JSON.parse(fs.readFileSync(path.join(folder, 'fixture.json')));
const checks = [];
async function footer(page, name) {
  const dialog = page.getByRole('dialog');
  await dialog.waitFor();
  const buttons = dialog.locator('.dialog-actions button:visible');
  const rows = [];
  for (let i = 0; i < (await buttons.count()); i++) {
    const button = buttons.nth(i);
    const box = await button.boundingBox();
    assert(box);
    assert(box.height >= 47, 'Touch target too short');
    assert(
      box.x >= 0 && box.x + box.width <= 391,
      'Action clipped horizontally',
    );
    assert(
      box.y >= 0 && box.y + box.height <= 845,
      'Action clipped vertically',
    );
    rows.push({ text: await button.innerText(), ...box });
  }
  assert(
    await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
    'Dialog overflows',
  );
  await page.screenshot({
    path: path.join(folder, name + '.png'),
    fullPage: false,
  });
  checks.push({ name, buttons: rows, passed: true });
}
(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const handle = await createPage(
      browser,
      fixture.accounts.find((a) => a.role === 'root'),
      { width: 390, height: 844 },
    );
    const page = handle.page;
    await page.goto('http://127.0.0.1:18080/appointments', {
      waitUntil: 'domcontentloaded',
    });
    await handle.settle();
    await page.locator('.calendar-toolbar select').waitFor();
    const tomorrow = new Date();
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    await page
      .locator('.agenda-date-controls input')
      .fill(tomorrow.toISOString().slice(0, 10));
    for (const queue of fixture.queues) {
      await page.locator('.calendar-toolbar select').selectOption(queue.id);
      await page.waitForTimeout(250);
      await handle.settle();
      if (await page.locator('.agenda-item button').count()) break;
    }
    await page.locator('.agenda-item button').first().click();
    await footer(page, 'appointment-summary-mobile');
    await page.route(
      '**/availability?**',
      async (route) => {
        await new Promise((resolve) => setTimeout(resolve, 3000));
        await route.continue();
      },
      { times: 1 },
    );
    await page
      .getByRole('dialog')
      .getByRole('button', {
        name: /reprogrammer|replanifier|déplacer|reporter/i,
      })
      .first()
      .click();
    await page.locator('.dorify-loader-compact').waitFor();
    await page
      .locator('.dorify-loader-compact')
      .screenshot({ path: path.join(folder, 'loader-compact-mobile.png') });
    checks.push({ name: 'loader-compact', passed: true });
    await page.locator('.dorify-loader-compact').waitFor({ state: 'hidden' });
    await footer(page, 'appointment-reschedule-mobile');
    await page.locator('.dialog-header-close').click();
    await page.locator('.agenda-item button').first().click();
    await page
      .getByRole('dialog')
      .getByRole('button', { name: /annuler.*rendez-vous/i })
      .click();
    await footer(page, 'appointment-cancel-mobile');
    await page.locator('.dialog-header-close').click();
    const loaderPage = await handle.context.newPage();
    await loaderPage.route(
      '**/api/v1/auth/refresh',
      async (route) => {
        await new Promise((resolve) => setTimeout(resolve, 3000));
        await route.continue();
      },
      { times: 1 },
    );
    await loaderPage.goto('http://127.0.0.1:18080/desk', {
      waitUntil: 'domcontentloaded',
    });
    await loaderPage.locator('.dorify-loader').first().waitFor();
    await loaderPage
      .locator('.dorify-loader')
      .first()
      .screenshot({ path: path.join(folder, 'loader-full-mobile.png') });
    checks.push({
      name: 'loader-full',
      style: await loaderPage
        .locator('.dorify-loader')
        .first()
        .evaluate((el) => ({
          image: getComputedStyle(el).backgroundImage,
          size: getComputedStyle(el).backgroundSize,
        })),
      passed: true,
    });
    await loaderPage.locator('.topbar-title-route').waitFor();
    await handle.context.close();
    const active = JSON.parse(
      fs.readFileSync(path.join(folder, 'active-staff.json')),
    );
    const operator = fixture.accounts
      .filter(
        (a) =>
          a.role === 'operator' && active.some((s) => s.user_id === a.userId),
      )
      .at(-1);
    const op = await createPage(browser, operator, {
      width: 1440,
      height: 1000,
    });
    await op.settle();
    const next = op.page.getByRole('button', {
      name: /appeler le meilleur suivant/i,
    });
    await next.click();
    await op.page
      .getByRole('button', { name: 'Servi', exact: true })
      .first()
      .waitFor();
    await op.page
      .getByRole('button', { name: 'Servi', exact: true })
      .first()
      .click();
    await op.settle();
    const servedResponse = op.page.waitForResponse(
      (response) =>
        response.request().method() === 'POST' &&
        /\/registrations\/[^/]+\/served$/.test(
          new URL(response.url()).pathname,
        ),
    );
    await op.page
      .getByRole('dialog')
      .getByRole('button', { name: 'Servi', exact: true })
      .click();
    assert.equal((await servedResponse).status(), 200);
    await op.settle();
    checks.push({ name: 'browser-call-next-and-served', passed: true });
    await op.context.close();
  } finally {
    await browser.close();
    fs.writeFileSync(
      path.join(folder, 'visual-checks.json'),
      JSON.stringify(checks, null, 2),
    );
  }
})().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
