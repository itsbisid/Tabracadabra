// Tournament wizard walkthrough: format choice drives settings, menus and saved data.
// Needs: fake Supabase (npm run ps:fake-supabase) + dev server on :4173 (see HANDOVER.md).
import { chromium } from '@playwright/test';
import fs from 'node:fs';

const BASE = process.env.PS_E2E_BASE || 'http://127.0.0.1:4173';
const OUT = process.env.PS_E2E_OUT || 'test-results/wizard';
fs.mkdirSync(OUT, { recursive: true });
const results = [];
const check = (name, ok, detail = '') => { results.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`); };
const user = { id: '11111111-1111-4111-8111-111111111111', email: 'synthetic-owner@example.test', aud: 'authenticated', role: 'authenticated', user_metadata: {} };
const session = { access_token: 'synthetic-token', refresh_token: 'r', token_type: 'bearer', expires_in: 360000, expires_at: Math.floor(Date.now() / 1000) + 360000, user };

const browser = await chromium.launch(process.env.PS_E2E_CHROMIUM ? { executablePath: process.env.PS_E2E_CHROMIUM } : {});
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const errors = []; page.on('pageerror', e => errors.push(e.message));
const alerts = []; page.on('dialog', d => { alerts.push(d.message()); d.accept(); });
await page.goto(BASE + '/');
await page.evaluate(s => localStorage.setItem('sb-127-auth-token', JSON.stringify(s)), session);
const visible = sel => page.locator(sel).isVisible();
const sidebar = () => page.textContent('.sidebar');

async function step1(name) {
  await page.goto(BASE + '/#/create-tournament');
  await page.waitForSelector('#tournament-name', { timeout: 15000 });
  await page.fill('#tournament-name', name);
  await page.fill('#tournament-short-name', name.slice(0, 12));
  await page.fill('#tournament-description', 'Synthetic tournament for automated testing');
  await page.fill('#tournament-start-date', '2026-11-01');
  await page.fill('#tournament-end-date', '2026-11-02');
  await page.fill('#tournament-location', 'Accra');
  await page.click('#wizard-step-1 button:has-text("Next")');
  await page.waitForSelector('#wizard-step-2', { state: 'visible' });
}

// ---- 1. Public speaking only
await step1('Synthetic PS Open');
check('Default (Debate only) shows debate settings, hides public speaking', await visible('#debate-settings') && !(await visible('#ps-settings')));
await page.selectOption('#tournament-tracks', 'Public speaking only');
check('"Public speaking only" hides debate settings', !(await visible('#debate-settings')));
check('"Public speaking only" shows public speaking settings', await visible('#ps-settings'));
await page.selectOption('#ps-settings select[name="preset"]', 'impromptu');
await page.fill('#ps-settings input[name="name"]', 'Synthetic Impromptu');
await page.waitForSelector('#ps-settings #ps-rule-preview table', { timeout: 8000 });
check('Template loads criteria and the live calculation preview works', /Ideas/.test(await page.textContent('#ps-settings #ps-rule-preview')));
// Add a 4th criterion and rebalance the weights to 100.
await page.click('#ps-settings [data-action="criterion"]');
const names = page.locator('#ps-settings input[name="criterionName"]'), weights = page.locator('#ps-settings input[name="criterionWeight"]'), maxes = page.locator('#ps-settings input[name="criterionMax"]');
await names.nth(3).fill('Use of time');
for (const [i, w] of [25, 25, 30, 20].entries()) { await weights.nth(i).fill(String(w)); await maxes.nth(i).fill(String(w)); }
await page.waitForTimeout(700);
check('Organiser can add their own criteria (4 criteria)', await names.count() === 4 && /Use of time/.test(await page.textContent('#ps-settings #ps-rule-preview')));
await weights.nth(0).fill('50');
await page.click('#wizard-step-2 button:has-text("Next")');
check('Invalid weights stop the wizard with a clear message', /weights must total 100/i.test(alerts.at(-1) || ''), alerts.at(-1));
await weights.nth(0).fill('25');
await page.screenshot({ path: `${OUT}/1-ps-settings.png`, fullPage: true });
await page.click('#wizard-step-2 button:has-text("Next")');
check('Breaks step explains public speaking breaks and hides team break categories', await visible('#ps-break-note') && !(await visible('#debate-breaks')));
await page.click('#wizard-step-3 button:has-text("Next")');
const review = await page.textContent('#wizard-step-4');
check('Review shows the public speaking event, not debate settings', /Synthetic Impromptu/.test(review) && /Use of time 20%/.test(review) && !(await visible('#review-debate')));
await page.click('button:has-text("Create Tournament")');
await page.waitForSelector('.ps-stats', { timeout: 15000 });
check('Creates the tournament and its speaking event, then opens Public speaking', /Synthetic Impromptu/.test(await page.textContent('.ps-stats')));
const ps1 = await sidebar();
check('Sidebar hides debate menus for a public-speaking-only tournament', !/Debate rounds|Team break|Speaker tab|Teams/.test(ps1) && /Events & tabulation/.test(ps1));
await page.screenshot({ path: `${OUT}/2-ps-created.png`, fullPage: true });

// ---- 2. Debate + Public speaking, with debate criteria
await step1('Synthetic Mixed Cup');
await page.selectOption('#tournament-tracks', 'Debate + Public speaking');
check('"Debate + Public speaking" shows both settings sections', await visible('#debate-settings') && await visible('#ps-settings'));
await page.check('#debate-settings input[value="criteria"]');
check('Debate "score by criteria" shows the criteria editor', await visible('#debate-criteria') && !(await visible('#debate-single')));
await page.click('#debate-settings [data-debate-add]');
const dn = page.locator('#debate-settings input[name="debateCriterionName"]'), dm = page.locator('#debate-settings input[name="debateCriterionMax"]');
await dn.nth(3).fill('Strategy'); await dm.nth(3).fill('10');
await page.waitForTimeout(200);
const summary = await page.textContent('#debate-scoring-summary');
check('Debate criteria total updates live (4 criteria, out of 110)', /Strategy \/10/.test(summary) && /out of 110/.test(summary), summary);
await page.fill('#ps-settings input[name="name"]', 'Synthetic Prepared');
await page.screenshot({ path: `${OUT}/3-mixed-settings.png`, fullPage: true });
await page.click('#wizard-step-2 button:has-text("Next")');
check('Breaks step shows team break categories and the PS note', await visible('#debate-breaks') && await visible('#ps-break-note'));
await page.click('#wizard-step-3 button:has-text("Next")');
check('Review shows both debate scoring and the speaking event', /Strategy \/10/.test(await page.textContent('#review-speaker-points')) && /Synthetic Prepared/.test(await page.textContent('#review-ps')));
await page.click('button:has-text("Create Tournament")');
await page.waitForURL(/tournament\/dashboard/, { timeout: 15000 });
await page.waitForSelector('.sidebar');
const mixed = await sidebar();
check('Sidebar shows both debate and public speaking menus', /Debate rounds/.test(mixed) && /Events & tabulation/.test(mixed));

// ---- 3. Settings page: scoring is editable and tracks can change
await page.goto(BASE + '/#/tournament/settings');
await page.waitForSelector('#set-tracks', { timeout: 15000 });
const current = await page.textContent('#set-debate-scoring');
check('Settings shows the saved debate criteria', /Strategy/.test(current) && await page.locator('#set-debate-scoring input[name="debateCriterionName"]').count() === 4);
await page.selectOption('#set-tracks', 'Debate only');
await page.click('#save-competition-btn');
await page.waitForSelector('#set-tracks', { timeout: 15000 });
await page.waitForTimeout(800);
check('Switching to Debate only removes the public speaking menu', !/Events & tabulation/.test(await sidebar()) && /Debate rounds/.test(await sidebar()));

console.log('\nPage errors:', JSON.stringify(errors));
console.log(`\n${results.filter(Boolean).length}/${results.length} checks passed`);
await browser.close();
process.exit(results.every(Boolean) ? 0 : 1);
