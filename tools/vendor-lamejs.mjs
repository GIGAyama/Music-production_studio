#!/usr/bin/env node
/**
 * MP3 変換ライブラリ（lamejs）を、npm から自分のところへ写す。
 *
 *   node tools/vendor-lamejs.mjs          写す（npm run build:vendor）
 *   node tools/vendor-lamejs.mjs --check  写しが npm のものと同じかを見るだけ
 *
 * ── なぜ要るのか ──────────────────────────────────────
 *
 * 2026-11-10 まで、「MP3出力」を押したときに cdnjs.cloudflare.com から
 * lame.min.js を読んでいた。学校のフィルタが塞いでいると、押した児童全員が
 * 「MP3変換機能の読み込みに失敗しました」になる。曲づくりは圏外でもできるのに、
 * **残す手だてだけが外に頼っていた**（共用端末では MP3 に出さないと曲が残らない）。
 *
 * ── なぜ import せずに、ファイルのまま置くのか ────────────
 *
 * lamejs は LGPL-3.0。同梱の LICENSE は「lame.min.js を別のファイルのまま
 * 使うこと」を求めている。アプリの JS に混ぜこむと、利用者がライブラリだけを
 * 差し替えられなくなる。だから public/vendor/lamejs/ に 1 本のまま置き、
 * <script> で読む（読む側は App.jsx の loadLameJS）。
 *
 * ⚠️ 版は package.json の devDependencies で固定してある（lamejs 1.2.1）。
 *    上げるときは package.json を直してから、ここを走らせること。
 *    public/vendor/lamejs/lame.min.js を手で差し替えない（--check が落ちる）。
 * ⚠️ 中身は 1 バイトも変えない。変えたら、変えたものを LGPL で公開する義務が生じる。
 */
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'node_modules', 'lamejs', 'lame.min.js');
const DST = path.join(ROOT, 'public', 'vendor', 'lamejs', 'lame.min.js');
const sha = (file) => createHash('sha256').update(fs.readFileSync(file)).digest('hex');

function main() {
  if (!fs.existsSync(SRC)) {
    console.error('❌ node_modules/lamejs/lame.min.js がありません。先に npm ci を実行してください。');
    return 1;
  }
  if (process.argv.includes('--check')) {
    if (!fs.existsSync(DST)) { console.error('❌ public/vendor/lamejs/lame.min.js がありません。npm run build:vendor を実行してください。'); return 1; }
    if (sha(SRC) !== sha(DST)) {
      console.error('❌ public/vendor/lamejs/lame.min.js が、npm の lamejs と食い違っています。');
      console.error('   手で直さず、npm run build:vendor で写しなおしてください。');
      return 1;
    }
    console.log(`✅ lame.min.js は npm のものと同じです（sha256 ${sha(DST).slice(0, 12)}…）`);
    return 0;
  }
  fs.mkdirSync(path.dirname(DST), { recursive: true });
  fs.copyFileSync(SRC, DST);
  const version = JSON.parse(fs.readFileSync(path.join(ROOT, 'node_modules', 'lamejs', 'package.json'), 'utf8')).version;
  console.log(`✅ lamejs ${version} を public/vendor/lamejs/lame.min.js に写しました（sha256 ${sha(DST).slice(0, 12)}…）`);
  return 0;
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) process.exit(main());
