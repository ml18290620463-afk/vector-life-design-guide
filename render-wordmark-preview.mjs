import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';

const require = createRequire('/Users/leeyto/.codex/worktrees/24d1/T0 -vector（矢量人生经验进化系统）/package.json');
const { chromium } = require('playwright');

const out = '/private/tmp/vector-word-flow';
await mkdir(out, { recursive: true });

const palette = { ink: '#203641', flow: '#7197a7', now: '#587f91' };

const glyphsA = `
  <g id="v"><path d="M2 5H25L51 84 77 5H100L62 108H40Z"/></g>
  <g id="e"><path d="M2 0H61L57 10H21Q13 10 13 19V31Q13 39 21 39H40Q49 39 57 36V48Q49 50 40 50H21Q13 50 13 58V70Q13 78 22 78H57L64 88H2Z"/></g>
  <g id="c"><path d="M95 17Q82 8 63 8Q28 8 12 30Q0 46 0 64Q0 84 13 98Q29 114 62 114Q81 114 96 105L89 88Q77 96 62 96Q42 96 33 83Q27 74 27 61Q27 45 36 34Q46 22 63 22Q78 22 88 30Z"/></g>
  <g id="t"><path d="M0 4H96V23H61V108H36V23H0Z"/></g>
  <g id="o"><path fill-rule="evenodd" d="M55 7Q79 7 94 23Q108 39 108 61Q108 83 94 99Q79 115 55 115Q31 115 16 99Q2 83 2 61Q2 39 16 23Q31 7 55 7ZM55 27Q42 27 34 37Q27 47 27 61Q27 75 34 85Q42 95 55 95Q68 95 76 85Q83 75 83 61Q83 47 76 37Q68 27 55 27Z"/></g>
  <g id="r"><path d="M2 4H45Q69 4 80 16Q89 26 89 42Q89 58 76 67L105 108H76L52 73H27V108H2ZM27 22V55H43Q54 55 59 49Q63 44 63 38Q63 31 59 27Q54 22 43 22Z"/></g>`;

const glyphsB = `
  <g id="v"><path d="M1 5H25Q29 38 51 85Q73 39 78 5H101Q90 47 62 109H40Q12 46 1 5Z"/></g>
  <g id="e"><path d="M2 0H61L57 10H21Q12 10 12 20V31Q12 39 21 39H40Q49 39 57 36V48Q49 51 40 51H21Q12 51 12 59V70Q12 79 22 79H57L64 88H2Z"/></g>
  <g id="c"><path d="M96 17Q83 7 63 9Q27 9 11 31Q0 47 1 65Q3 84 16 98Q31 112 62 112Q81 112 96 103L88 87Q77 95 62 95Q43 95 34 82Q28 73 28 61Q28 45 37 34Q47 22 63 22Q78 22 88 30Z"/></g>
  <g id="t"><path d="M0 5Q37 2 96 5V23H61Q59 66 61 108H36Q38 66 36 23H0Z"/></g>
  <g id="o"><path fill-rule="evenodd" d="M55 7Q79 8 95 24Q108 40 107 62Q106 84 92 99Q78 114 55 114Q31 114 16 98Q3 82 3 60Q3 39 17 23Q32 7 55 7ZM55 27Q42 27 34 37Q27 47 27 61Q27 76 35 85Q42 94 55 95Q68 95 76 85Q84 75 83 61Q83 47 76 37Q68 27 55 27Z"/></g>
  <g id="r"><path d="M2 4H45Q69 4 80 17Q89 28 88 43Q87 58 75 67L106 108H76L52 73H27V108H2ZM27 22V55H43Q54 55 59 49Q63 44 63 38Q63 31 59 27Q54 22 43 22Z"/></g>`;

const glyphsC = `
  <g id="v"><path d="M1 5H25Q30 39 51 87Q73 42 79 5H101Q91 47 62 109H40Q11 47 1 5Z"/></g>
  <g id="e"><path d="M2 0H61L57 10H21Q12 10 12 20V31Q12 39 21 39H40Q49 39 57 36V48Q49 51 40 51H21Q12 51 12 59V70Q12 79 22 79H57L64 88H2Z"/></g>
  <g id="c"><path d="M96 17Q83 6 63 9Q28 9 11 31Q-1 48 2 66Q5 85 18 99Q33 112 62 112Q82 112 96 102L87 86Q76 95 61 95Q42 95 33 81Q27 72 28 60Q29 44 38 33Q48 22 63 22Q79 22 88 31Z"/></g>
  <g id="t"><path d="M0 4H96V23H61Q58 63 61 108H36Q39 63 36 23H0Z"/></g>
  <g id="o"><path fill-rule="evenodd" d="M55 7Q80 8 95 25Q108 42 106 62Q104 84 91 99Q77 114 55 114Q31 114 16 98Q3 82 3 60Q3 39 17 23Q32 7 55 7ZM55 27Q42 27 34 37Q27 47 27 61Q27 76 35 85Q42 94 55 95Q68 95 76 85Q84 75 83 61Q83 47 76 37Q68 27 55 27Z"/></g>
  <g id="r"><path d="M2 4H45Q70 4 81 17Q90 29 87 44Q85 59 74 67L106 108H76L52 73H27V108H2ZM27 22V55H43Q54 55 59 49Q63 44 63 38Q63 31 59 27Q54 22 43 22Z"/></g>`;

function wordmark(variant) {
  if (variant === 'g2') return wordmarkG2();
  if (variant === 'g') return wordmarkG();
  if (variant === 'e') return wordmarkE();
  if (variant === 'd') return wordmarkD();
  const glyphs = variant === 'c' ? glyphsC : variant === 'b' ? glyphsB : glyphsA;
  const placements = [
    ['v', 0], ['e', 117], ['c', 202], ['t', 315], ['o', 421], ['r', 543],
  ].map(([id, x]) => `<use href="#${id}" transform="translate(${x} 0)"/>`).join('');
  return `<svg class="flow-mark flow-mark--${variant}" viewBox="0 0 650 116" role="img" aria-label="VECTOR" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="flow-${variant}" x1="0" x2="1" y1="0" y2="0"><stop offset="0" stop-color="${palette.flow}" stop-opacity="0"/><stop offset=".17" stop-color="${palette.flow}" stop-opacity=".22"/><stop offset=".52" stop-color="${palette.flow}" stop-opacity=".82"/><stop offset=".83" stop-color="${palette.flow}" stop-opacity=".2"/><stop offset="1" stop-color="${palette.flow}" stop-opacity="0"/></linearGradient>
      <linearGradient id="material-${variant}" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#203641"/><stop offset=".13" stop-color="#294753"/><stop offset=".27" stop-color="#203641"/><stop offset=".42" stop-color="#557b8c"/><stop offset=".54" stop-color="#294653"/><stop offset=".69" stop-color="#587e8e"/><stop offset=".83" stop-color="#203641"/><stop offset="1" stop-color="#203641"/></linearGradient>
      <filter id="soft-${variant}" x="-10%" width="120%"><feGaussianBlur stdDeviation="5"/></filter>
      <clipPath id="clip-${variant}">${placements}</clipPath>
      ${glyphs}
    </defs>
    <g fill="url(#material-${variant})">${placements}</g>
    <g clip-path="url(#clip-${variant})">
      <path d="M-12 81C104 17 177 101 283 56S465 8 670 63" fill="none" stroke="url(#flow-${variant})" stroke-width="25" filter="url(#soft-${variant})" opacity=".72"/>
      <path d="M-12 81C104 17 177 101 283 56S465 8 670 63" fill="none" stroke="url(#flow-${variant})" stroke-width="9" opacity=".94"/>
    </g>
    <path d="M136 39H156Q165 39 173 36V48Q165 51 156 51H136Z" fill="${palette.now}"/>
  </svg>`;
}

// G / 回构的此刻：E 的中横从竖笔直接长出，在右端上扬后回收。
// 回构存在于一个可辨认的 E 内部，不另加独立光带或附属符号。
function wordmarkG() {
  return `<span class="vector-word-g" role="img" aria-label="VECTOR">
    <span class="vector-word-g__lead" aria-hidden="true">V</span>
    <svg class="vector-word-g__e" viewBox="0 0 67 84" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="g-material" gradientUnits="userSpaceOnUse" x1="0" y1="79" x2="67" y2="5">
          <stop offset="0" stop-color="#203641"/>
          <stop offset=".32" stop-color="#2d4d58"/>
          <stop offset=".62" stop-color="#63818b"/>
          <stop offset="1" stop-color="#203641"/>
        </linearGradient>
      </defs>
      <path fill="url(#g-material)" d="M2 0H59V8.5H12V75.5H59V84H2Z"/>
      <path fill="url(#g-material)" d="M2 35.6H51.5C57.1 35.6 62 34.4 65.5 31.8L62.7 39.6C61.6 42.4 59.3 43.8 55.7 43.8H2Z"/>
    </svg>
    <span class="vector-word-g__tail" aria-hidden="true">CTOR</span>
  </span>`;
}

// G2 / 内联上扬：将回构收进中横的自然弧度中。
// 竖笔、此刻（中横）和右端回收同为一笔连续结构，仍清楚读作 E。
function wordmarkG2() {
  return `<span class="vector-word-g vector-word-g--g2" role="img" aria-label="VECTOR">
    <span class="vector-word-g__lead" aria-hidden="true">V</span>
    <svg class="vector-word-g__e" viewBox="0 0 67 84" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="g2-material" gradientUnits="userSpaceOnUse" x1="0" y1="79" x2="67" y2="5">
          <stop offset="0" stop-color="#203641"/>
          <stop offset=".34" stop-color="#294954"/>
          <stop offset=".62" stop-color="#62808a"/>
          <stop offset="1" stop-color="#203641"/>
        </linearGradient>
      </defs>
      <path fill="url(#g2-material)" d="M2 0H59V8.5H12V75.5H59V84H2Z"/>
      <path fill="url(#g2-material)" d="M2 35.7H49.5C55.7 35.7 60.7 34.55 65.25 31.65C63.35 35.35 62.4 38.15 61.55 40.15C60.35 42.75 58.15 43.85 54.75 43.85H2Z"/>
    </svg>
    <span class="vector-word-g__tail" aria-hidden="true">CTOR</span>
  </span>`;
}

// E / 连续雾潮：字形完全回归标准骨架。流动只来自一条贯穿整组字标的
// 低饱和雾蓝灰材质；每个字母只是自然地截取同一片连续色彩场。
function wordmarkE() {
  const placements = [
    ['v', 0], ['e', 117], ['c', 202], ['t', 315], ['o', 421], ['r', 543],
  ].map(([id, x]) => `<use href="#${id}" transform="translate(${x} 0)"/>`).join('');

  return `<svg class="flow-mark flow-mark--e" viewBox="0 0 650 116" role="img" aria-label="VECTOR" xmlns="http://www.w3.org/2000/svg">
    <defs>
      ${glyphsA}
      <linearGradient id="e-material" gradientUnits="userSpaceOnUse" x1="16" y1="108" x2="634" y2="4">
        <stop offset="0" stop-color="#203641"/>
        <stop offset=".24" stop-color="#2b4955"/>
        <stop offset=".48" stop-color="#557985"/>
        <stop offset=".66" stop-color="#66828c"/>
        <stop offset=".82" stop-color="#365561"/>
        <stop offset="1" stop-color="#203641"/>
      </linearGradient>
    </defs>
    <g fill="url(#e-material)">${placements}</g>
  </svg>`;
}

function wordmarkD() {
  const placements = `<use href="#v" transform="translate(0 0)" fill="url(#d-v-fill)"/><use href="#e" transform="translate(117 0)" fill="url(#d-e-fill)"/><use href="#c" transform="translate(202 0)" fill="url(#d-c-fill)"/><use href="#t" transform="translate(315 0)" fill="url(#d-t-fill)"/><use href="#o" transform="translate(421 0)" fill="url(#d-o-fill)"/><use href="#r" transform="translate(543 0)" fill="url(#d-r-fill)"/>`;
  return `<svg class="flow-mark flow-mark--d" viewBox="0 0 650 116" role="img" aria-label="VECTOR" xmlns="http://www.w3.org/2000/svg">
    <defs>
      ${glyphsC}
      <linearGradient id="d-v-fill" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#1e3540"/><stop offset=".54" stop-color="#577987"/><stop offset="1" stop-color="#203641"/></linearGradient>
      <linearGradient id="d-e-fill" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#203641"/><stop offset=".46" stop-color="#294753"/><stop offset=".7" stop-color="#496c79"/><stop offset="1" stop-color="#203641"/></linearGradient>
      <linearGradient id="d-c-fill" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#537987"/><stop offset=".38" stop-color="#203641"/><stop offset="1" stop-color="#2b4b57"/></linearGradient>
      <linearGradient id="d-t-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#557884"/><stop offset=".4" stop-color="#203641"/><stop offset="1" stop-color="#294754"/></linearGradient>
      <radialGradient id="d-o-fill" cx="36%" cy="30%" r="75%"><stop offset="0" stop-color="#5f8491"/><stop offset=".48" stop-color="#203641"/><stop offset="1" stop-color="#2b4a56"/></radialGradient>
      <linearGradient id="d-r-fill" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="#274653"/><stop offset=".52" stop-color="#203641"/><stop offset="1" stop-color="#577b88"/></linearGradient>
      <linearGradient id="d-mist" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#7f9eaa" stop-opacity="0"/><stop offset=".44" stop-color="#7499a8" stop-opacity=".52"/><stop offset="1" stop-color="#456775" stop-opacity="0"/></linearGradient>
      <linearGradient id="d-now" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#365966"/><stop offset=".5" stop-color="#6d96a5"/><stop offset="1" stop-color="#365966"/></linearGradient>
      <filter id="d-blur" x="-18%" width="136%" y="-18%" height="136%"><feGaussianBlur stdDeviation="2.7"/></filter>
      <clipPath id="d-v"><use href="#v"/></clipPath><clipPath id="d-e"><use href="#e"/></clipPath><clipPath id="d-c"><use href="#c"/></clipPath><clipPath id="d-t"><use href="#t"/></clipPath><clipPath id="d-o"><use href="#o"/></clipPath><clipPath id="d-r"><use href="#r"/></clipPath>
    </defs>
    <g>${placements}</g>
    <g transform="translate(0 0)" clip-path="url(#d-v)"><path d="M7 8C24 31 32 71 49 102" stroke="url(#d-mist)" stroke-width="13" filter="url(#d-blur)"/><path d="M7 8C24 31 32 71 49 102" stroke="#8caab3" stroke-opacity=".26" stroke-width="3"/></g>
    <g transform="translate(117 0)" clip-path="url(#d-e)"><path d="M6 12C24 9 39 10 56 7M8 43C27 39 40 43 58 39M9 76C25 80 43 79 60 84" fill="none" stroke="url(#d-mist)" stroke-width="9" filter="url(#d-blur)"/><path d="M19 39H56Q64 39 71 36V48Q64 51 56 51H19Z" fill="url(#d-now)"/></g>
    <g transform="translate(202 0)" clip-path="url(#d-c)"><path d="M90 23C64 13 27 30 22 61C19 84 38 101 66 102" fill="none" stroke="url(#d-mist)" stroke-width="15" filter="url(#d-blur)"/><path d="M90 23C64 13 27 30 22 61" fill="none" stroke="#88a7b0" stroke-opacity=".22" stroke-width="3"/></g>
    <g transform="translate(315 0)" clip-path="url(#d-t)"><path d="M47 5C52 34 44 74 49 106" fill="none" stroke="url(#d-mist)" stroke-width="16" filter="url(#d-blur)"/><path d="M6 14C34 17 64 12 91 14" fill="none" stroke="#82a2ac" stroke-opacity=".17" stroke-width="3"/></g>
    <g transform="translate(421 0)" clip-path="url(#d-o)"><path d="M54 18C82 24 91 52 77 77C66 96 38 99 24 78" fill="none" stroke="url(#d-mist)" stroke-width="15" filter="url(#d-blur)"/><path d="M54 18C82 24 91 52 77 77" fill="none" stroke="#87a7b1" stroke-opacity=".22" stroke-width="3"/></g>
    <g transform="translate(543 0)" clip-path="url(#d-r)"><path d="M20 13C57 17 72 33 57 56C45 66 58 82 91 106" fill="none" stroke="url(#d-mist)" stroke-width="14" filter="url(#d-blur)"/><path d="M45 66C57 79 71 91 91 106" fill="none" stroke="#88a7b0" stroke-opacity=".23" stroke-width="3"/></g>
  </svg>`;
}

const css = `
  .flow-mark { width: min(650px, 58vw); height:auto; display:block; overflow:visible; }
  .vector-brush-cover__wordmark { margin-bottom: 25px!important; font-size: initial!important; letter-spacing:0!important; }
  .vector-word-g { display:flex; align-items:baseline; width:min(630px,57vw); color:#203641; font-family:Inter,'Helvetica Neue',sans-serif; font-size:clamp(102px,8.9vw,128px); font-weight:400; letter-spacing:.021em; line-height:.9; white-space:nowrap; }
  .vector-word-g__lead,.vector-word-g__tail { display:inline-block; background:linear-gradient(108deg,#203641 0%,#294954 28%,#587985 50%,#65838d 64%,#385762 82%,#203641 100%); -webkit-background-clip:text; background-clip:text; color:transparent; }
  .vector-word-g__e { width:.52em; height:.66em; margin:0 .014em 0 .006em; transform:translateY(.015em); overflow:visible; flex:none; }
  .vector-brush-cover__rising-wash { display:none!important; }
  @media (max-width: 640px) { .flow-mark { width: min(316px, 85vw); } .vector-word-g { width:min(316px,84vw); font-size:clamp(54px,15.3vw,60px); letter-spacing:.018em; } .vector-word-g__e { margin-left:.004em; } }
`;

async function capture(variant, width, height, file) {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
  await page.goto('http://127.0.0.1:3000/', { waitUntil: 'networkidle' });
  await page.waitForSelector('.vector-brush-cover__wordmark');
  await page.addStyleTag({ content: css });
  await page.locator('.vector-brush-cover__wordmark').evaluate((el, html) => { el.innerHTML = html; }, wordmark(variant));
  await page.screenshot({ path: `${out}/${file}`, fullPage: false });
  await browser.close();
}

await capture('a', 1440, 900, 'vector-flow-a-home.png');
await capture('b', 1440, 900, 'vector-flow-b-home.png');
await capture('c', 1440, 900, 'vector-flow-c-home.png');
await capture('d', 1440, 900, 'vector-flow-d-home.png');
await capture('e', 1440, 900, 'vector-flow-e-home.png');
await capture('g', 1440, 900, 'vector-flow-g-home.png');
await capture('g2', 1440, 900, 'vector-flow-g2-home.png');
await capture('a', 390, 844, 'vector-flow-a-mobile.png');
await capture('b', 390, 844, 'vector-flow-b-mobile.png');
await capture('c', 390, 844, 'vector-flow-c-mobile.png');
await capture('d', 390, 844, 'vector-flow-d-mobile.png');
await capture('e', 390, 844, 'vector-flow-e-mobile.png');
await capture('g', 390, 844, 'vector-flow-g-mobile.png');
await capture('g2', 390, 844, 'vector-flow-g2-mobile.png');

const board = `<!doctype html><html><head><meta charset="utf-8"><style>
  *{box-sizing:border-box}body{margin:0;background:#edf4f5;color:#203641;font-family:Inter,'PingFang SC',sans-serif;padding:56px}
  h1{font-size:24px;letter-spacing:.02em;font-weight:500;margin:0 0 8px}p{color:#607884;margin:0 0 36px;font:15px/1.7 'Songti SC','STSong',serif}.grid{display:grid;grid-template-columns:1fr 1fr;gap:24px}.card{background:#f8fbfb;padding:18px;border:1px solid #d3e0e3}.label{font-size:12px;letter-spacing:.12em;color:#607884;margin-bottom:14px}.flow-mark{width:100%;height:auto;display:block}
  </style></head><body><h1>VECTOR / 全字标流动感</h1><p>标准字形；以一条连续、低饱和的雾蓝灰渐变建立整体材质。</p><div class="grid"><div class="card"><div class="label">E / 连续雾潮 · 标准字形</div>${wordmark('e')}</div></div></body></html>`;
await writeFile(`${out}/comparison.html`, board);
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 560 }, deviceScaleFactor: 1 });
await page.goto(`file://${out}/comparison.html`);
await page.screenshot({ path: `${out}/vector-flow-comparison.png`, fullPage: true });
await browser.close();
