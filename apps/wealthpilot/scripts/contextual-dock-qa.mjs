// Fresh browser context and synthetic IndexedDB only. No build, sync, or user profile.
import { chromium } from '../../../node_modules/@playwright/test/index.mjs';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
const out = path.resolve('../../tmp/contextual-dock-qa');
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1512, height: 982 }, locale: 'fr-FR', recordVideo: { dir: out } });
const page = await context.newPage();
page.setDefaultTimeout(6000);
const checks = [], errors = [];
page.on('pageerror', e => errors.push(e.message));
const check = (name, pass, detail) => { checks.push({ name, pass, detail }); console.log(JSON.stringify(checks.at(-1))); };
const screenshot = name => page.screenshot({ path: path.join(out, name + '.png') });
const nav = () => page.getByRole('navigation', { name: 'Navigation principale' });
const dock = () => page.getByRole('region', { name: 'Commandes de la page' });
const visit = async name => { await nav().getByRole('button', { name, exact: true }).click(); };
const select = async (label, name) => { await page.getByRole('combobox', { name: label, exact: true }).click(); await page.getByRole('option', { name, exact: true }).click(); };
const prefs = () => page.evaluate(async () => (await import('/src/store.ts')).db.preferences.get('main'));
const cards = () => page.locator('.react-grid-item[data-widget], .react-grid-item [data-widget]').count();
async function addCard() {
  await dock().getByRole('button', { name: 'Ajouter une carte' }).click();
  await page.getByRole('searchbox', { name: 'Chercher une carte' }).fill('Répartition');
  await page.getByRole('button', { name: 'Ajouter Répartition des dépenses', exact: true }).click();
}
try {
  await page.clock.setFixedTime(new Date('2026-10-05T12:00:00Z'));
  await page.goto('http://127.0.0.1:5201');
  await page.evaluate(async () => {
    const { db } = await import('/src/store.ts'), { defaultPreferences } = await import('/src/types.ts');
    const { migrateBoard, makeInstance, initialLayout } = await import('/src/layout.ts');
    const types = ['balance', 'transactions', 'flows'];
    const instances = types.map(type => ({ ...makeInstance(type, type), size: 'medium' }));
    const board = migrateBoard({ ...defaultPreferences, widgets: [] });
    board.views[0] = { ...board.views[0], instances, mobileOrder: types, layouts: Object.fromEntries(['laptop', 'desktop', 'wide'].map(bp => [bp, initialLayout(instances, bp)])) };
    await db.accounts.bulkPut(['A', 'B'].map(id => ({ id, checkpoint: { date: '2026-10-05', amount: 100000 } })));
    await db.transactions.bulkPut([
      ['a-oct', 'A', '2026-10-02', 'Commerce A octobre', -1000], ['a-sep', 'A', '2026-09-15', 'Commerce A septembre', -2000], ['a-aug', 'A', '2026-08-14', 'Commerce A août', -3000],
      ['b-oct', 'B', '2026-10-03', 'Commerce B octobre', -4000], ['b-sep', 'B', '2026-09-15', 'Commerce B septembre', -5000],
    ].map(([id, account, date, merchant, amount]) => ({ id, account, date, merchant, label: merchant, amount, category: 'Courses', raw: {}, internal: false, fingerprint: id, batchId: 'test' })));
    await db.preferences.put({ ...defaultPreferences, setupDone: true, goal: null, extraGoals: [], board });
    localStorage.setItem('wealthpilot-next-month', '2026-10');
    localStorage.setItem('wealthpilot-next-period', '1');
  });
  await page.goto('http://127.0.0.1:5201/#dashboard');
  await dock().getByRole('button', { name: 'Organiser mon dashboard' }).waitFor();
  check('Four destinations; one organize action', (await nav().getByRole('button').count()) === 4 && (await dock().getByRole('button', { name: 'Organiser mon dashboard' }).count()) === 1);
  check('No visible page header/title', await page.locator('.page > h1').evaluateAll(nodes => nodes.every(n => n.getBoundingClientRect().height <= 1)));
  await screenshot('dashboard');
  await select('Compte affiché', 'A');
  await select('Période affichée', 'Trois mois');
  await page.getByText('Commerce A août', { exact: true }).first().waitFor();
  check('Dashboard scoped source and period affect transactions', await page.getByText('Commerce A août', { exact: true }).first().isVisible() && !(await page.getByText('Commerce B octobre', { exact: true }).first().isVisible().catch(() => false)));
  const before = await prefs();
  await dock().getByRole('button', { name: 'Organiser mon dashboard' }).click();
  check('Editing controls present only once', (await dock().getByRole('button', { name: 'Terminer', exact: true }).count()) === 1 && (await dock().getByRole('button', { name: 'Organiser mon dashboard' }).count()) === 0);
  await addCard();
  check('Added card visible in draft', await page.locator('[data-widget="categories"]').count() > 0);
  await screenshot('editing');
  await visit('Transactions');
  await dock().getByRole('button', { name: 'Exporter le résultat filtré' }).waitFor();
  check('Inactive dashboard editor actions absent on transactions', (await dock().getByRole('button', { name: 'Terminer', exact: true }).count()) === 0 && (await dock().getByRole('button', { name: 'Ajouter une carte' }).count()) === 0);
  await select('Compte affiché', 'B');
  await select('Période affichée', 'Un mois');
  await page.getByRole('searchbox', { name: 'Rechercher une opération' }).fill('octobre');
  await page.locator('.ledger-entry').first().waitFor();
  const ledger = await page.locator('.ledger-entry').allTextContents();
  check('Transaction account/period/search filters produce one matching row', ledger.length === 1 && ledger[0].includes('Commerce B octobre'), ledger);
  await screenshot('transactions');
  const downloadPromise = page.waitForEvent('download');
  await dock().getByRole('button', { name: 'Exporter le résultat filtré' }).click();
  check('Filtered export starts real download', (await downloadPromise).suggestedFilename().includes('wealthpilot'));
  await visit('Ma semaine');
  await dock().getByRole('button', { name: 'Prochaine', exact: true }).waitFor();
  await dock().getByRole('button', { name: 'Cette semaine', exact: true }).click();
  const weekBefore = await dock().locator('summary').innerText();
  await dock().getByRole('button', { name: 'Prochaine', exact: true }).click();
  check('Week control changes dates; no inactive actions/month filter', (await dock().locator('summary').innerText()) !== weekBefore && (await dock().getByRole('button', { name: 'Exporter le résultat filtré' }).count()) === 0 && (await page.getByRole('combobox', { name: 'Mois affiché' }).count()) === 0);
  await screenshot('week');
  await dock().locator('summary').click();
  await page.getByLabel('Semaine du', { exact: true }).fill('2026-10-26');
  check('Custom week date changes actual selected week', (await dock().locator('summary').innerText()).includes('26 oct.'));
  await page.getByLabel('Semaine du', { exact: true }).press('Escape');
  check('Week date popover closes and restores focus on Escape', await dock().locator('summary').evaluate(el => document.activeElement === el && !el.parentElement.open));
  await visit('Import CSV');
  await dock().getByRole('button', { name: 'Sauvegarder ou restaurer mes données' }).waitFor();
  check('Import has example and backup only; no financial filters', (await dock().getByRole('button').count()) === 2 && (await page.getByRole('combobox', { name: 'Compte affiché' }).count()) === 0, await dock().getByRole('button').allTextContents());
  await dock().getByRole('button', { name: 'Sauvegarder ou restaurer mes données' }).click();
  await page.getByRole('heading', { name: 'Données et sauvegarde' }).waitFor();
  check('Backup opens inline on import', new URL(page.url()).hash === '#import');
  await screenshot('import');
  await visit('Dashboard');
  await dock().getByRole('button', { name: 'Annuler', exact: true }).waitFor();
  check('Unfinished dashboard draft preserved across navigation', await page.locator('[data-widget="categories"]').count() > 0);
  await dock().getByRole('button', { name: 'Annuler', exact: true }).click();
  await page.evaluate(() => new Promise(requestAnimationFrame));
  check('Cancel restores focus to Organiser', await dock().getByRole('button', { name: 'Organiser mon dashboard' }).evaluate(el => document.activeElement === el));
  check('Cancel does not persist draft', JSON.stringify((await prefs()).board) === JSON.stringify(before.board));
  await dock().getByRole('button', { name: 'Organiser mon dashboard' }).click();
  await addCard();
  await dock().getByRole('button', { name: 'Terminer', exact: true }).click();
  await dock().getByRole('button', { name: 'Organiser mon dashboard' }).waitFor();
  await page.evaluate(() => new Promise(requestAnimationFrame));
  check('Finish restores focus to Organiser', await dock().getByRole('button', { name: 'Organiser mon dashboard' }).evaluate(el => document.activeElement === el));
  const saved = await prefs();
  check('Finish persists added card', saved.board.views[0].instances.some(x => x.type === 'categories'));
  await page.reload();
  await dock().getByRole('button', { name: 'Organiser mon dashboard' }).waitFor();
  check('Reload retains saved board and single actions', JSON.stringify((await prefs()).board) === JSON.stringify(saved.board) && (await dock().getByRole('button', { name: 'Organiser mon dashboard' }).count()) === 1);
  await select('Période affichée', 'Période personnalisée');
  await select('Début de période', 'sept. 2026');
  check('Custom global range reflected in dashboard transactions', await page.getByText('Commerce A septembre', { exact: true }).first().isVisible() && !(await page.getByText('Commerce A août', { exact: true }).first().isVisible().catch(() => false)));
  await nav().getByRole('button', { name: 'Dashboard', exact: true }).focus();
  await page.keyboard.press('Tab');
  check('Dock keyboard order reaches next destination', await nav().getByRole('button', { name: 'Ma semaine', exact: true }).evaluate(el => document.activeElement === el));
  await page.keyboard.press('Enter');
  await dock().getByRole('button', { name: 'Prochaine', exact: true }).waitFor();
  check('Dock keyboard activation changes route', new URL(page.url()).hash === '#week');
  await page.getByRole('combobox', { name: 'Compte affiché' }).focus();
  await page.keyboard.press('Enter');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Escape');
  await page.getByRole('listbox').waitFor({ state: 'hidden' });
  await page.evaluate(() => new Promise(requestAnimationFrame));
  check('Account dropdown Escape restores trigger focus', await page.getByRole('combobox', { name: 'Compte affiché' }).evaluate(el => document.activeElement === el), await page.evaluate(() => ({ tag: document.activeElement.tagName, label: document.activeElement.getAttribute('aria-label'), text: document.activeElement.textContent?.slice(0, 100) })));
  const filterStyle = await page.getByRole('combobox', { name: 'Compte affiché' }).evaluate(el => { const s = getComputedStyle(el); return { color: s.color, background: s.backgroundColor, border: s.borderColor, className: el.className }; });
  check('Inspect dock filter styling', true, filterStyle);
  for (const [width, height] of [[390, 844], [3840, 2160]]) {
    await page.setViewportSize({ width, height });
    for (const route of ['Dashboard', 'Ma semaine', 'Transactions', 'Import CSV']) {
      await visit(route);
      const box = await page.locator('.wp-dock').boundingBox();
      check(`Dock fits ${route} ${width}`, box && box.x >= -1 && box.x + box.width <= width + 1 && box.y >= 0 && box.y + box.height <= height + 1, box);
      await screenshot(route.replaceAll(' ', '-') + '-' + width);
      if (width === 390 && route === 'Ma semaine') {
        await dock().locator('summary').click();
        const dateBox = await page.getByLabel('Semaine du', { exact: true }).boundingBox();
        check('Mobile custom week date field fits viewport', dateBox && dateBox.x >= 0 && dateBox.x + dateBox.width <= width && dateBox.y >= 0 && dateBox.y + dateBox.height <= height, dateBox);
        await screenshot('week-date-mobile');
        await page.getByLabel('Semaine du', { exact: true }).press('Escape');
      }
    }
  }
} catch (error) {
  check('Journey interrupted', false, String(error.stack));
  await screenshot('failure').catch(() => {});
} finally {
  check('No uncaught runtime error', errors.length === 0, errors);
  await writeFile(path.join(out, 'report.json'), JSON.stringify({ checks, errors, url: page.url() }, null, 2));
  await context.close();
  await browser.close();
}
