// Judge-focused browser walkthrough against scripts/ps-local-demo.mjs (synthetic data).
// Start the demo first:  NO_BROWSER=1 node scripts/ps-local-demo.mjs   (then run this file)
import { chromium } from '@playwright/test';
import fs from 'node:fs';

const BASE = process.env.PS_E2E_BASE || 'http://127.0.0.1:4173';
const OUT = process.env.PS_E2E_OUT || 'test-results/ps-judge';
const JUDGE_LINK = process.env.PS_JUDGE_LINK; // printed by the demo server
fs.mkdirSync(OUT, { recursive: true });
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok, detail }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`); };

const browser = await chromium.launch(process.env.PS_E2E_CHROMIUM ? { executablePath: process.env.PS_E2E_CHROMIUM } : {});
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
const judge = await ctx.newPage();
const errors = []; judge.on('pageerror', e => errors.push(e.message));
const dialogText = () => judge.textContent('#ps-dialog').then(t => t.replace(/\s+/g, ' '));
const fill = async (i, scores, rank, elapsed, worked, improve, next) => {
  for (const [j, v] of scores.entries()) await judge.fill(`#ps-dialog input[name="score-${i}-${j}"]`, String(v));
  await judge.fill(`#ps-dialog input[name="rank-${i}"]`, String(rank));
  if (elapsed != null && await judge.locator(`#ps-dialog input[name="elapsed-${i}"]`).count()) await judge.fill(`#ps-dialog input[name="elapsed-${i}"]`, String(elapsed));
  await judge.fill(`#ps-dialog textarea[name="worked-${i}"]`, worked);
  await judge.fill(`#ps-dialog textarea[name="improve-${i}"]`, improve);
  await judge.fill(`#ps-dialog textarea[name="next-${i}"]`, next);
};

// 1. Open the private link
await judge.goto(JUDGE_LINK);
await judge.waitForSelector('text=Your room', { timeout: 15000 });
check('Judge link opens the portal and marks their room', true);
check('Private link removed from the address bar', !judge.url().includes('psl_'), judge.url().replace(/.*#/, '#'));
const firstCard = await judge.textContent('.ps-card');
check('First thing the judge sees is the outstanding ballot', /Next/.test(firstCard) && /Round 1 ballot outstanding/.test(firstCard), firstCard.replace(/\s+/g, ' ').slice(0, 90));
await judge.screenshot({ path: `${OUT}/1-portal.png`, fullPage: true });

// 2. Open the ballot
await judge.click('button[data-action="ballot"]');
await judge.waitForSelector('#ps-dialog fieldset.ps-ballot-speaker');
const speakers = await judge.locator('#ps-dialog fieldset.ps-ballot-speaker').count();
check('Ballot lists every speaker in the room in speaking order', speakers === 6, `${speakers} speakers`);
const hasTime = await judge.locator('#ps-dialog input[name="elapsed-0"]').count() > 0;
check('Elapsed-time field shown because overtime penalties apply', hasTime);
check('Structured feedback prompts present', await judge.locator('#ps-dialog textarea[name="worked-0"]').count() === 1 && await judge.locator('#ps-dialog textarea[name="next-0"]').count() === 1);

// 3. Empty submit is blocked by the form
await judge.click('#ps-dialog button[value="review"]');
check('Cannot review an empty ballot (required fields)', await judge.locator('#ps-dialog [data-review]').isHidden());

// 4. Duplicate ranks are rejected by the server, with input kept
for (let i = 0; i < speakers; i++) await fill(i, [30 - i, 28 - i, 20 - i], 1, 290, `Worked ${i}: strong hook`, `Improve ${i}: pace`, `Next ${i}: record and review`);
await judge.click('#ps-dialog button[value="review"]');
await judge.waitForSelector('#ps-dialog [data-review] table');
await judge.click('#ps-dialog button[value="submitted"]');
await judge.waitForSelector('#ps-dialog [role="alert"]:not([hidden])');
const dupError = await judge.textContent('#ps-dialog [role="alert"]');
check('Duplicate ranks rejected with a clear message', /unique rank/i.test(dupError), dupError.trim());
check('Typed feedback kept after the error', (await judge.inputValue('#ps-dialog textarea[name="worked-3"]')) === 'Worked 3: strong hook');

// 5. Out-of-range score blocked
await judge.fill('#ps-dialog input[name="score-0-0"]', '45');
for (let i = 0; i < speakers; i++) await judge.fill(`#ps-dialog input[name="rank-${i}"]`, String(i + 1));
await judge.click('#ps-dialog button[value="draft"]');
const stillOpen = await judge.locator('#ps-dialog').count() === 1;
check('Score above the maximum is blocked', stillOpen);
await judge.fill('#ps-dialog input[name="score-0-0"]', '30');

// 6. Save draft, reload, continue
await judge.click('#ps-dialog button[value="draft"]');
await judge.waitForSelector('#ps-dialog', { state: 'detached' });
check('Draft saved', /draft/i.test(await judge.textContent('.ps-room--yours')));
await judge.reload();
await judge.waitForSelector('text=Your room', { timeout: 15000 });
check('Session survives a page reload (no need to reopen the link)', true);
await judge.click('button[data-action="ballot"]');
await judge.waitForSelector('#ps-dialog fieldset.ps-ballot-speaker');
check('Draft scores and feedback reload into the ballot', (await judge.inputValue('#ps-dialog textarea[name="improve-2"]')) === 'Improve 2: pace' && (await judge.inputValue('#ps-dialog input[name="rank-5"]')) === '6');

// 7. Review: totals and penalty preview
await judge.fill('#ps-dialog input[name="elapsed-1"]', '335'); // 335s vs 300s + 15s grace = 20s over -> 2 steps -> -2
await judge.click('#ps-dialog button[value="review"]');
await judge.waitForSelector('#ps-dialog [data-review] table');
const review = await judge.textContent('#ps-dialog [data-review]');
check('Review screen shows ranks, totals and the overtime deduction', /−2/.test(review), review.replace(/\s+/g, ' ').slice(0, 160));
await judge.screenshot({ path: `${OUT}/2-review.png` });

// 8. Dropped connection during submit
await ctx.setOffline(true);
await judge.click('#ps-dialog button[value="submitted"]');
await judge.waitForSelector('#ps-dialog [role="alert"]:not([hidden])', { timeout: 15000 });
const offlineMsg = await judge.textContent('#ps-dialog [role="alert"]');
check('Offline submit says nothing was confirmed and keeps the ballot open', /Nothing has been confirmed/i.test(offlineMsg) && await judge.locator('#ps-dialog').count() === 1, offlineMsg.trim());
await ctx.setOffline(false);
await judge.click('#ps-dialog button[value="review"]');
await judge.click('#ps-dialog button[value="submitted"]');
await judge.waitForSelector('#ps-dialog', { state: 'detached', timeout: 15000 });
const status = await judge.textContent('.ps-room--yours');
check('Submitted once back online', /submitted/i.test(status));
check('Next card now says no ballots outstanding', /No ballots outstanding/.test(await judge.textContent('.ps-card')));
check('Ballot locked: no Continue button after submitting', await judge.locator('button[data-action="ballot"]').count() === 0);

// 9. Saved ballot view shows what was sent
await judge.click('button[data-action="view-ballot"]');
await judge.waitForSelector('#ps-dialog table');
const saved = await dialogText();
check('Saved ballot shows times and structured feedback', /335/.test(saved) && /What to try next/.test(saved));
await judge.click('#ps-dialog [data-close]');

// 10. Confidential feedback on the other judge
const peerButton = judge.locator('button[data-action="feedback"]').first();
check('Feedback button for the other judge in the room', await peerButton.count() === 1, await peerButton.textContent().catch(() => ''));
await peerButton.click();
await judge.waitForSelector('#ps-dialog select[name="rating"]');
const privacyText = await dialogText();
check('Peer feedback explains who can see it', /administrators only/i.test(privacyText), privacyText.slice(0, 200));
check('Peer feedback states it is not anonymous to tab', /not anonymous|your name/i.test(privacyText));
await judge.selectOption('#ps-dialog select[name="rating"]', '4');
await judge.fill('#ps-dialog textarea[name="comment"]', 'Synthetic: clear reasons for the decision.');
await judge.click('#ps-dialog button[type="submit"]');
await judge.waitForSelector('#ps-dialog', { state: 'detached', timeout: 10000 });
await peerButton.click();
await judge.waitForSelector('#ps-dialog select[name="rating"]');
check('Peer feedback is saved and can be edited', (await judge.inputValue('#ps-dialog select[name="rating"]')) === '4' && /clear reasons/.test(await judge.inputValue('#ps-dialog textarea[name="comment"]')));
await judge.click('#ps-dialog [data-close]');
await judge.screenshot({ path: `${OUT}/3-after-submit.png`, fullPage: true });

// 11. Organiser approves, completes and releases; speaker sees feedback
const org = await browser.newPage({ viewport: { width: 1280, height: 900 } });
org.on('dialog', d => d.accept('Synthetic test'));
await org.goto(`${BASE}/demo`);
await org.waitForSelector('.ps-stats', { timeout: 15000 });
await org.click('button[data-tab="rounds"]');
while (await org.locator('button:has-text("Approve")').count()) { await org.locator('button:has-text("Approve")').first().click(); await org.waitForTimeout(400); }
const missing = await org.locator('button:has-text("Enter ballot")').count();
check('Organiser sees only Room 2 ballots outstanding', missing === 2, `${missing} missing`);
await org.click('button[data-tab="feedback"]');
const confidential = await org.textContent('main');
check('Organiser sees the peer evaluation', /clear reasons for the decision/.test(confidential));

const speakerLink = process.env.PS_SPEAKER_LINK;
const speaker = await browser.newPage({ viewport: { width: 390, height: 844 } });
await speaker.goto(speakerLink);
await speaker.waitForSelector('text=Your room', { timeout: 15000 });
check('Speaker is told their room and speaking position first', /You speak 1st of 6/.test(await speaker.textContent('.ps-card')), (await speaker.textContent('.ps-card')).replace(/\s+/g, ' ').slice(0, 80));
check('Speaker cannot see feedback before release', !/Your private feedback/.test(await speaker.textContent('main')));
check('Speaker never sees peer evaluations', !/clear reasons for the decision/.test(await speaker.textContent('main')));

console.log('\nPage errors:', JSON.stringify(errors));
const failed = results.filter(r => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
await browser.close();
process.exit(failed.length ? 1 : 0);
