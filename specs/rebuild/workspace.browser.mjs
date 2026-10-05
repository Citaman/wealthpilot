import { test, expect } from '@playwright/test';
import { readFile, access } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import JSZip from 'jszip';
import { JSDOM } from 'jsdom';
import Papa from 'papaparse';
import './domain.js';

const directory = dirname(fileURLToPath(import.meta.url));
const experience = new URL('./experience.html', import.meta.url).href;
const storageKey = 'wealthpilot-independent-workspace-v1';
const finance = globalThis.WealthDomain;
const euros = cents => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(cents / 100);
const errors = new WeakMap();
const paths = {
  csv: process.env.REBUILD_CSV || resolve(directory, '../../../data/transactions_2026_consolidated.csv'),
  family: process.env.REBUILD_FAMILY_XLSX || resolve(directory, '../../../../life_os/budget_famille_partage_2026.xlsx'),
  treasury: process.env.REBUILD_TREASURY_XLSX || resolve(directory, '../../../../life_os/outputs/01a0e797-2e9b-7f31-aafa-b1eabd44a61d/budget_tresorerie_2026.xlsx'),
};

test.beforeEach(async ({ page }) => {
  const messages = [];
  errors.set(page, messages);
  page.on('pageerror', error => messages.push(error.message));
});
test.afterEach(async ({ page }) => expect(errors.get(page)).toEqual([]));

async function navigate(page, route) {
  const dock = page.locator(`#dock a[href="#${route}"]:visible`);
  if (await dock.count()) await dock.click();
  else {
    await page.locator('#more-trigger').click();
    await page.locator(`#more-menu a[href="#${route}"]`).click();
  }
  await expect(page).toHaveURL(`${experience}#${route}`);
}

async function stored(page) {
  return page.evaluate(key => JSON.parse(localStorage.getItem(key)), storageKey);
}

async function personal(page, names = ['Personne A', 'Personne B']) {
  await page.goto(`${experience}#settings`);
  await page.locator('[data-action="start-personal"]').click();
  const form = page.locator('form[data-form="personal"]');
  await form.locator('[name="a"]').fill(names[0]);
  await form.locator('[name="b"]').fill(names[1]);
  await form.locator('[type="submit"]').click();
  await expect(page).toHaveURL(`${experience}#import`);
}

async function dates(page, start, end) {
  await page.locator('#period-preset').selectOption('custom');
  await page.locator('#period-start').fill(start);
  await page.locator('#period-start').press('Tab');
  await page.locator('#period-end').fill(end);
  await page.locator('#period-end').press('Tab');
}

test('navigation protects and closes transaction drafts', async ({ page }, info) => {
  await page.goto(`${experience}#today`);
  await navigate(page, 'history');
  const open = () => page.getByRole('button', { name: 'Club de sport', exact: true }).filter({ visible: true }).first().click();
  const form = page.locator('form[data-form="transaction"]:visible');
  await open();
  await navigate(page, 'budget');
  await expect(page.locator('form[data-form="transaction"]')).toHaveCount(0);
  await navigate(page, 'history');
  await expect(page.locator('form[data-form="transaction"]')).toHaveCount(0);
  await open();
  await form.locator('[name="note"]').fill('Brouillon de QA');
  await form.locator('summary').click();
  await form.locator('[name="recurrence"]').selectOption('include');
  await form.locator('[name="recurrenceFrequency"]').selectOption('yearly');
  await page.locator('#dock a[href="#budget"]').click();
  await expect(page).toHaveURL(`${experience}#history`);
  await page.locator('[data-action="keep-edit"]:visible').click();
  await expect(form.locator('[name="note"]')).toHaveValue('Brouillon de QA');
  await expect(form.locator('[name="recurrenceFrequency"]')).toBeVisible();
  await expect(form.locator('[name="recurrenceFrequency"]')).toHaveValue('yearly');
  await page.locator('#category-filter').selectOption('Abonnements');
  await page.locator('[data-action="keep-edit"]:visible').click();
  await expect(form.locator('[name="note"]')).toHaveValue('Brouillon de QA');
  await page.screenshot({ path: info.outputPath('compact-editor.png'), fullPage: true });
  await page.locator('#dock a[href="#budget"]').click();
  await page.locator('[data-action="discard-edit"]:visible').click();
  await expect(page).toHaveURL(`${experience}#budget`);
  await expect(page.locator('form[data-form="transaction"]')).toHaveCount(0);
  await navigate(page, 'history');
  await open();
  await form.locator('[name="allocation"]').selectOption('a');
  await form.locator('[type="submit"]').click();
  const saved = (await stored(page)).transactions.find(row => row.merchant === 'Club de sport' && row.date.startsWith('2026-09'));
  expect(saved.splitA).toBe(100);
  expect(saved.amount).toBe(-3500);
  expect(saved.bankLabel).toBe('Club de sport');
  expect(saved.recurrenceFrequency).toBeUndefined();
});

test('donut uses its center on actual pointer hover and resets', async ({ page }) => {
  await page.goto(experience);
  const chart = page.locator('#chart-categories');
  await chart.scrollIntoViewIfNeeded();
  await chart.locator('svg').waitFor();
  const center = page.locator('#component-categories .ring-center');
  const original = await center.textContent();
  const target = await chart.evaluate(element => {
    const instance = window.echarts.getInstanceByDom(element), option = instance.getOption();
    const items = option.series[0].data, total = items.reduce((sum, item) => sum + item.value, 0);
    const rect = element.getBoundingClientRect(), angle = -Math.PI / 2 + Math.PI * items[0].value / total;
    const radius = Math.min(rect.width, rect.height) * .365;
    return { x: rect.x + rect.width / 2 + Math.cos(angle) * radius, y: rect.y + rect.height / 2 + Math.sin(angle) * radius, name: items[0].name, cents: Math.round(items[0].value * 100), tooltip: option.tooltip[0].show };
  });
  await page.mouse.move(target.x, target.y);
  await expect(center.locator('span')).toHaveText(target.name);
  await expect(center.locator('strong')).toHaveText(euros(target.cents));
  expect(target.tooltip).toBe(false);
  await page.mouse.move(10, 10);
  await expect(center).toHaveText(original);
  await expect(page.locator('[data-chart="balance"][data-grain="month"]')).toBeDisabled();
  await expect(page.locator('[data-chart="balance"][data-grain="quarter"]')).toBeDisabled();
  await page.locator('#period-preset').selectOption('six');
  await page.locator('[data-chart="balance"][data-grain="month"]').click();
  expect(await page.locator('#chart-balance').evaluate(element => window.echarts.getInstanceByDom(element).getOption().series[0].data.length)).toBe(6);
  const week = await page.locator('#component-week .chart-summary').textContent();
  const period = await page.locator('#period-preset').inputValue();
  await page.getByRole('button', { name: 'Semaine précédente', exact: true }).click();
  expect(await page.locator('#component-week .chart-summary').textContent()).not.toBe(week);
  expect(await page.locator('#period-preset').inputValue()).toBe(period);
  await page.getByRole('button', { name: 'Semaine suivante', exact: true }).click();
  expect(await page.locator('#component-week .chart-summary').textContent()).toBe(week);
});

test('dashboard modules, order, sizes and variants survive reload', async ({ page }, info) => {
  await page.goto(experience);
  await page.locator('[data-action="customize-dashboard"]').click();
  await page.locator('[data-widget-toggle="quality"]').uncheck();
  await page.locator('[data-widget-toggle="merchants"]').check();
  await page.locator('[data-widget-toggle="monthly"]').check();
  await page.locator('[data-widget-width="balance"]').selectOption('12');
  await page.locator('[data-widget-variant="envelopes"]').selectOption('rings');
  await page.locator('[data-action="move-widget"][data-widget="balance"][data-step="-1"]').click();
  const order = await page.locator('.grid > section').evaluateAll(elements => elements.map(element => element.id));
  await page.reload();
  await expect(page.locator('#component-quality')).toHaveCount(0);
  await expect(page.locator('#component-balance')).toHaveClass(/span-12/);
  await expect(page.locator('#chart-envelope-rings svg')).toBeVisible();
  await expect(page.locator('#chart-merchants svg')).toBeVisible();
  expect(await page.locator('.grid > section').evaluateAll(elements => elements.map(element => element.id))).toEqual(order);
  await page.screenshot({ path: info.outputPath('custom-dashboard.png'), fullPage: true });
  await navigate(page, 'analytics');
  await expect(page.locator('#component-merchants,#component-monthly')).toHaveCount(0);
  await navigate(page, 'budget');
  await expect(page.locator('#component-budget-envelopes .notice-inline')).toHaveCount(0);
  await page.getByRole('button', { name: 'Tableau', exact: true }).click();
  await expect(page.locator('#component-budget-envelopes .bar-track')).toHaveCount(0);
  await page.getByRole('button', { name: 'Anneaux', exact: true }).click();
  await expect(page.locator('#chart-envelope-rings svg')).toBeVisible();
  await page.screenshot({ path: info.outputPath('budget-rings.png'), fullPage: true });
});

test('recurring review is reversible without removing bank rows', async ({ page }) => {
  await page.goto(`${experience}#recurring`);
  const before = finance.demo().transactions.map(({ id, date, bankLabel, amount }) => ({ id, date, bankLabel, amount }));
  await expect(page.locator('[data-action="exclude-recurring"]')).toHaveCount(0);
  await page.getByRole('button', { name: 'Spotify', exact: true }).click();
  await page.getByRole('button', { name: 'Écarter de la détection', exact: true }).click();
  await expect(page.locator('#component-excluded')).toContainText('Spotify');
  await page.reload();
  await page.getByRole('button', { name: 'Rétablir le suivi', exact: true }).click();
  await expect(page.locator('#component-excluded')).toHaveCount(0);
  expect((await stored(page)).transactions.map(({ id, date, bankLabel, amount }) => ({ id, date, bankLabel, amount }))).toEqual(before);
});

test('reimbursement is read-only and remains household scoped', async ({ page }) => {
  await page.goto(`${experience}#sharing`);
  const expected = finance.sharing(finance.demo(), { start: '2026-09-01', end: '2026-09-30', scope: 'all' }).owedToA;
  await expect(page.locator('#component-reimbursement .value')).toHaveText(euros(Math.abs(expected)));
  const before = await page.locator('#component-reimbursement').textContent();
  await page.locator('#scope').selectOption('a');
  expect(await page.locator('#component-reimbursement').textContent()).toBe(before);
  await page.locator('[data-action="privacy"]').click();
  await expect(page.locator('#component-reimbursement .value')).toHaveText('••••••');
  expect(await stored(page)).toBeNull();
});

const parser = new (new JSDOM().window.DOMParser)();
const nodes = (document, name) => [...document.getElementsByTagNameNS('*', name)];
async function workbook(path) {
  const zip = await JSZip.loadAsync(await readFile(path));
  const xml = async entry => parser.parseFromString(await zip.file(entry).async('string'), 'application/xml');
  const strings = zip.file('xl/sharedStrings.xml') ? nodes(await xml('xl/sharedStrings.xml'), 'si').map(item => item.textContent) : [];
  const sheets = nodes(await xml('xl/workbook.xml'), 'sheet');
  const relations = nodes(await xml('xl/_rels/workbook.xml.rels'), 'Relationship');
  const sheet = sheets.find(item => item.getAttribute('name') === 'Transactions');
  const id = sheet.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id');
  const target = relations.find(item => item.getAttribute('Id') === id).getAttribute('Target');
  const document = await xml(target.startsWith('/') ? target.slice(1) : `xl/${target}`);
  const rows = nodes(document, 'row').map(row => Object.fromEntries(nodes(row, 'c').map(cell => [cell.getAttribute('r').match(/^[A-Z]+/)[0], cell.getAttribute('t') === 's' ? strings[Number(nodes(cell, 'v')[0]?.textContent)] : nodes(cell, 'is')[0]?.textContent || nodes(cell, 'v')[0]?.textContent || ''])));
  const headerIndex = rows.findIndex(row => Object.values(row).includes('Date') || Object.values(row).includes('date'));
  expect(headerIndex).toBeGreaterThanOrEqual(0);
  const headers = rows[headerIndex];
  const records = rows.slice(headerIndex + 1).map(row => Object.fromEntries(Object.entries(headers).filter(([, value]) => value).map(([column, label]) => [label, row[column] || '']))).filter(row => row.Date || row.date);
  const iso = value => /^\d+(\.\d+)?$/.test(value) ? new Date(Date.UTC(1899, 11, 30) + Number(value) * 86400000).toISOString().slice(0, 10) : value;
  return records.map(row => ({ date: iso(row.Date || row.date), account: row.Compte || row.account, amount: row.Montant || row.amount, direction: row.Sens || row.direction, merchant: row.Marchand || row.merchant, category: row.Catégorie || row.category, bank_label: row.Libellé || row.libelle, detail: row.Détail || row.detail, source_id: row.ID || '', shared: row.Partagé || '', is_internal: row.Interne || row.is_internal }));
}

async function realAvailable() {
  try { await Promise.all(Object.values(paths).map(path => access(path))); return true; } catch { return false; }
}
let real;
async function realData() {
  if (!real) {
    const csv = Papa.parse(await readFile(paths.csv, 'utf8'), { header: true, skipEmptyLines: 'greedy' });
    expect(csv.errors).toEqual([]);
    real = { csv: csv.data, family: await workbook(paths.family), treasury: await workbook(paths.treasury) };
  }
  return real;
}

test('real workbook and CSV inventories are parsed without cached formula assumptions', async () => {
  test.skip(!await realAvailable(), 'Set REBUILD_CSV, REBUILD_FAMILY_XLSX and REBUILD_TREASURY_XLSX to run private-data QA.');
  const data = await realData();
  for (const rows of Object.values(data)) {
    expect(rows.length).toBeGreaterThan(1000);
    expect(new Set(rows.map(row => row.account)).size).toBe(2);
    expect(rows.every(row => /^2026-\d{2}-\d{2}$/.test(row.date) && Number.isFinite(Number(row.amount)))).toBe(true);
  }
  console.log('REAL_DATA_ROWS', JSON.stringify(Object.fromEntries(Object.entries(data).map(([key, rows]) => [key, rows.length]))));
});

for (const source of ['csv', 'family', 'treasury']) test(`real ${source} data: click import both accounts, compare source rows and reject reimport`, async ({ page }) => {
  test.skip(!await realAvailable(), 'Private files are unavailable; this test is not counted as verified.');
  const rows = (await realData())[source], owners = [...new Set(rows.map(row => row.account))];
  const file = paths[source];
  await personal(page, owners);
  for (const [index, owner] of owners.entries()) {
    if (index) await navigate(page, 'import');
    await page.locator('#csv-file').setInputFiles(file);
    await expect(page.locator('#source-account').or(page.locator('#notice:not(:empty)'))).toBeVisible();
    await expect(page.locator('#notice')).toBeEmpty();
    await page.locator('#source-account').selectOption(owner);
    await page.locator('#new-account-owner').selectOption(index === 0 ? 'a' : 'b');
    await page.locator('#new-opening').fill('0');
    await page.locator('#include-duplicates').check();
    expect((await stored(page)).accounts.length).toBe(index);
    await page.locator('[data-action="check-import"]').click();
    await expect(page.locator('[data-action="commit-import"]')).toBeEnabled();
    await page.locator('[data-action="commit-import"]').click();
  }
  const state = await stored(page);
  expect(state.accounts).toHaveLength(2);
  expect(state.transactions).toHaveLength(rows.length);
  const reference = rows.map(row => [row.account, row.date, Math.round(Number(row.amount) * 100), row.bank_label || row.libelle || row.merchant, row.detail || ''].join('|')).sort();
  const imported = state.transactions.map(row => [state.accounts.find(item => item.id === row.account).sourceKey, row.date, row.amount, row.bankLabel, row.bankDetail].join('|')).sort();
  expect(imported).toEqual(reference);
  const chronological = rows.map(row => row.date).sort();
  await dates(page, chronological[0], chronological.at(-1));
  const income = rows.filter(row => !['Y', 'Oui', 'oui', 'true', '1'].includes(row.is_internal) && ['income', 'Revenu', 'revenu'].includes(row.direction)).reduce((sum, row) => sum + Math.round(Number(row.amount) * 100), 0);
  const expenses = -rows.filter(row => !['Y', 'Oui', 'oui', 'true', '1'].includes(row.is_internal) && ['expense', 'Dépense', 'dépense'].includes(row.direction)).reduce((sum, row) => sum + Math.round(Number(row.amount) * 100), 0);
  expect(finance.metrics(state, { start: chronological[0], end: chronological.at(-1), scope: 'all', granularity: 'day' })).toMatchObject({ income, expenses });
  await navigate(page, 'analytics');
  await expect(page.locator('.metric .value').nth(0)).toHaveText(euros(income));
  await expect(page.locator('.metric .value').nth(1)).toHaveText(euros(expenses));
  await navigate(page, 'sharing');
  const reimbursement = finance.sharing(state, { start: chronological[0], end: chronological.at(-1), scope: 'all' }).owedToA;
  await expect(page.locator('#component-reimbursement .value')).toHaveText(euros(Math.abs(reimbursement)));
  await navigate(page, 'import');
  await page.locator('#csv-file').setInputFiles(file);
  await page.locator('#source-account').selectOption(owners[0]);
  await page.locator('[data-action="check-import"]').click();
  await expect(page.locator('[data-action="commit-import"]')).toBeDisabled();
  expect((await stored(page)).transactions).toHaveLength(rows.length);
});

for (const width of [1440, 1024, 768, 390]) test(`visual workflows and dock hit targets at ${width}px`, async ({ page }, info) => {
  await page.setViewportSize({ width, height: width < 600 ? 844 : 1000 });
  await page.goto(experience);
  for (const route of ['today', 'history', 'budget', 'analytics', 'sharing', 'recurring', 'accounts', 'import', 'settings']) {
    await navigate(page, route);
    const dock = await page.locator('.dock-link:visible,#scope,#more-trigger').evaluateAll(elements => elements.map(element => { const rect = element.getBoundingClientRect(); return { name: element.textContent.trim(), x: rect.x, y: rect.y, right: rect.right, bottom: rect.bottom, width: rect.width, height: rect.height }; }));
    for (const target of dock) {
      expect(target.x).toBeGreaterThanOrEqual(0);
      expect(target.right).toBeLessThanOrEqual(width);
      expect(target.height).toBeGreaterThanOrEqual(36);
    }
    for (const [index, first] of dock.entries()) for (const second of dock.slice(index + 1)) expect(first.x < second.right && first.right > second.x && first.y < second.bottom && first.bottom > second.y, `${first.name} overlaps ${second.name}`).toBe(false);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await expect(page.locator('dialog,[role="dialog"]')).toHaveCount(0);
    if (['today', 'budget', 'history'].includes(route)) await page.screenshot({ path: info.outputPath(`${route}.png`), fullPage: true });
  }
  await navigate(page, 'history');
  await page.getByRole('button', { name: 'Club de sport', exact: true }).filter({ visible: true }).first().click();
  const form = page.locator('form[data-form="transaction"]:visible');
  await form.locator('[name="allocation"]').selectOption('custom');
  await form.locator('[name="splitA"]').fill('42.5');
  await form.locator('summary').click();
  await form.locator('[name="recurrence"]').selectOption('include');
  await expect(form.locator('[name="recurrenceFrequency"]')).toBeVisible();
  const fields = await form.locator('input:visible,select:visible,textarea:visible').evaluateAll(elements => elements.map(element => { const box = element.getBoundingClientRect(), parent = element.closest('form').getBoundingClientRect(); return box.x >= parent.x && box.right <= parent.right; }));
  expect(fields.every(Boolean)).toBe(true);
  await page.screenshot({ path: info.outputPath('editor.png'), fullPage: true });
  await form.locator('[type="submit"]').click();
  await navigate(page, 'budget');
  await page.getByRole('button', { name: 'Anneaux', exact: true }).click();
  await expect(page.locator('#chart-envelope-rings svg')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath('rings.png'), fullPage: true });
});