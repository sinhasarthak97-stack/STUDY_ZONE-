// Study Zone build toolkit. One file, no setup. Usage: node build.mjs <command>
//   check  - validate files, JSON, the app's JavaScript and any question packs in pyq/
//   web    - copy the web app into www/ and stamp the service-worker cache name
//   assets - make icon and splash source images in assets/ (needs sharp)
//   patch  - set versionCode / versionName in the generated Android project
//   native - add the voice-input plugin to the generated Android project (--remove undoes it)
//   smoke  - open the built app in headless Chromium and test it (needs playwright)
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import crypto from 'node:crypto';
import http from 'node:http';

const ROOT = path.dirname(new URL(import.meta.url).pathname);
const WEB_FILES = ['index.html', 'sw.js', 'manifest.webmanifest', 'logo.png',
  'icon-192.png', 'icon-512.png', 'icon-maskable-192.png', 'icon-maskable-512.png'];
const BG = '#060b14';
const rd = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const pkg = JSON.parse(rd('package.json'));
const fail = (m) => { console.error('FAIL: ' + m); process.exit(1); };
const ok = (m) => console.log('ok   ' + m);

function pngSize(file) {
  const b = fs.readFileSync(path.join(ROOT, file));
  if (b.readUInt32BE(0) !== 0x89504e47) fail(file + ' is not a PNG');
  return [b.readUInt32BE(16), b.readUInt32BE(20)];
}

function inlineScripts(html) {
  return [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
}

// ---------------------------------------------------------------- PYQ packs
// The app's own parser (between the PYQ-CORE markers in index.html) is run here,
// so a pack that passes this check is read the same way inside the app.
function loadParser() {
  const html = rd('index.html');
  const a = html.indexOf('/*PYQ-CORE-START*/'), b = html.indexOf('/*PYQ-CORE-END*/');
  if (a < 0 || b < 0) fail('PYQ core markers not found in index.html');
  const ctx = vm.createContext({});
  vm.runInContext(html.slice(a, b) + '\nthis.pqParse = pqParse;', ctx);
  return ctx.pqParse;
}

function listPacks() {
  const dir = path.join(ROOT, 'pyq');
  if (!fs.existsSync(dir)) return [];
  const parse = loadParser();
  return fs.readdirSync(dir)
    .filter((f) => /\.(json|csv|tsv|txt)$/i.test(f) && !f.startsWith('_') && f !== 'index.json')
    .sort()
    .map((file) => {
      const text = fs.readFileSync(path.join(dir, file), 'utf8');
      const r = parse(text, file);
      const v = crypto.createHash('sha1').update(text).digest('hex').slice(0, 8);
      return { file, v, n: r.items.length, bad: r.bad };
    });
}

function checkPacks() {
  const parse = loadParser();
  const t = parse('#exam T\n#subject Maths\nQ: one\nA) a\nB) b\nAns: B\nQ: two\nAns: 7', 'x.txt');
  const c = parse('exam,subject,question,A,B,C,D,answer\nT,Maths,"q, 1",1,2,3,4,C', 'x.csv');
  const j = parse('{"exam":"T","questions":[{"q":"z","options":["a","b"],"answer":"A"}]}', 'x.json');
  if (t.items.length !== 2 || c.items.length !== 1 || j.items.length !== 1) fail('PYQ parser self-test failed');
  ok('PYQ parser self-test passed (text, CSV and JSON)');
  const packs = listPacks();
  for (const p of packs) {
    if (!p.n) fail(`pyq/${p.file}: no usable questions. ${p.bad.slice(0, 3).map((b) => '#' + b.n + ' ' + b.err).join('; ')}`);
    ok(`pyq/${p.file}: ${p.n} questions` + (p.bad.length ? ` (${p.bad.length} skipped: ${p.bad.slice(0, 3).map((b) => '#' + b.n + ' ' + b.err).join('; ')})` : ''));
  }
  if (!packs.length) console.log('note no question packs in pyq/ (questions can still be added inside the app)');
  return packs;
}

// ---------------------------------------------------------------- check
function check() {
  for (const f of [...WEB_FILES, 'package.json', 'capacitor.config.json', 'debug.keystore']) {
    if (!fs.existsSync(path.join(ROOT, f))) fail('missing file: ' + f);
  }
  ok('all required files are present');

  const man = JSON.parse(rd('manifest.webmanifest'));
  for (const ic of man.icons) {
    const [w, h] = pngSize(ic.src);
    const want = parseInt(ic.sizes, 10);
    if (w !== want || h !== want) fail(`${ic.src} is ${w}x${h}, manifest says ${ic.sizes}`);
  }
  ok('manifest icons exist and match their declared sizes');

  const [lw, lh] = pngSize('logo.png');
  if (lw !== lh || lw < 512) fail('logo.png should be square and at least 512 px');
  ok(`logo.png is ${lw}x${lh}`);

  const cap = JSON.parse(rd('capacitor.config.json'));
  if (cap.webDir !== 'www') fail('capacitor.config.json webDir must be "www"');
  ok('capacitor.config.json is valid (webDir = www)');

  const html = rd('index.html');
  const scripts = inlineScripts(html);
  if (!scripts.length) fail('index.html has no inline script');
  scripts.forEach((s, i) => { try { new vm.Script(s); } catch (e) { fail(`index.html script #${i + 1}: ${e.message}`); } });
  ok(`index.html JavaScript parses (${scripts.length} script block(s), ${(html.length / 1024).toFixed(0)} KB)`);

  try { new vm.Script(rd('sw.js')); } catch (e) { fail('sw.js: ' + e.message); }
  if (!/const C='[^']*'/.test(rd('sw.js'))) fail("sw.js must contain const C='cache-name'");
  ok('sw.js parses and has a cache name');

  checkPacks();

  const m = html.match(/const BANK=(\{[\s\S]*?\})\s*(?:\n|;)/);
  if (m) {
    try {
      const bank = JSON.parse(m[1]);
      let n = 0;
      for (const [k, L] of Object.entries(bank)) for (const b of L) {
        n++;
        if (b.length < 6 || new Set(b.slice(1, 5).map((x) => x.toLowerCase())).size !== 4) fail(`bad question in ${k}: ${b[0]}`);
      }
      ok(`question bank: ${n} questions, every one has 4 distinct options`);
    } catch (e) { fail('question bank is not valid JSON: ' + e.message); }
  }
}

// ---------------------------------------------------------------- web
function web() {
  const out = path.join(ROOT, 'www');
  fs.rmSync(out, { recursive: true, force: true });
  fs.mkdirSync(out, { recursive: true });
  const build = process.env.GITHUB_RUN_NUMBER || 'dev';
  const stamp = `v${pkg.version}-${build}`;
  for (const f of WEB_FILES) {
    let data = fs.readFileSync(path.join(ROOT, f));
    if (f === 'sw.js') {
      const src = data.toString('utf8');
      if (!/const C='[^']*'/.test(src)) fail('sw.js cache name not found');
      data = src.replace(/const C='[^']*'/, `const C='study-zone-${stamp}'`);
    }
    fs.writeFileSync(path.join(out, f), data);
  }
  const pdfPkg = path.join(ROOT, 'node_modules', 'pdfjs-dist', 'package.json');
  if (fs.existsSync(pdfPkg) && /^3\./.test(JSON.parse(fs.readFileSync(pdfPkg, 'utf8')).version)) {
    fs.mkdirSync(path.join(out, 'lib'), { recursive: true });
    for (const f of ['pdf.min.js', 'pdf.worker.min.js']) fs.copyFileSync(path.join(ROOT, 'node_modules', 'pdfjs-dist', 'build', f), path.join(out, 'lib', f));
    ok('pdf.js bundled (the PDF reader works offline)');
  } else console.log('note pdf.js 3.x is not installed here; the PDF reader will use the internet');
  const packs = listPacks().filter((p) => p.n > 0);
  fs.mkdirSync(path.join(out, 'pyq'), { recursive: true });
  for (const p of packs) fs.copyFileSync(path.join(ROOT, 'pyq', p.file), path.join(out, 'pyq', p.file));
  fs.writeFileSync(path.join(out, 'pyq', 'index.json'), JSON.stringify({ packs: packs.map(({ file, v }) => ({ file, v })) }));
  ok(`pyq packs bundled: ${packs.length} file(s), ${packs.reduce((a, p) => a + p.n, 0)} questions`);
  fs.writeFileSync(path.join(out, 'version.json'), JSON.stringify({
    version: pkg.version, build, commit: (process.env.GITHUB_SHA || '').slice(0, 7), date: new Date().toISOString(),
  }, null, 2));
  ok(`www/ built (${WEB_FILES.length} files, cache study-zone-${stamp})`);
}

// ---------------------------------------------------------------- assets
async function assets() {
  const { default: sharp } = await import('sharp');
  const dir = path.join(ROOT, 'assets');
  fs.mkdirSync(dir, { recursive: true });
  const logo = path.join(ROOT, 'logo.png');
  const solid = (w, h, color) => sharp({ create: { width: w, height: h, channels: 4, background: color } });
  const logoAt = (n) => sharp(logo).resize(n, n, { fit: 'contain' }).png().toBuffer();

  // legacy / square icon: logo filling the canvas on the app background
  await solid(1024, 1024, BG).composite([{ input: await logoAt(1024), gravity: 'center' }]).png().toFile(path.join(dir, 'icon-only.png'));
  // adaptive icon: logo kept inside the safe zone, on its own layer
  await sharp({ create: { width: 1024, height: 1024, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: await logoAt(680), gravity: 'center' }]).png().toFile(path.join(dir, 'icon-foreground.png'));
  await solid(1024, 1024, BG).png().toFile(path.join(dir, 'icon-background.png'));
  // splash screens (light and dark use the same dark design)
  for (const f of ['splash.png', 'splash-dark.png']) {
    await solid(2732, 2732, BG).composite([{ input: await logoAt(900), gravity: 'center' }]).png().toFile(path.join(dir, f));
  }
  ok('assets/ ready: icon-only, icon-foreground, icon-background, splash, splash-dark');
}

// ---------------------------------------------------------------- patch
function patch() {
  const code = process.env.VERSION_CODE, name = process.env.VERSION_NAME;
  if (!code || !name) fail('VERSION_CODE and VERSION_NAME must be set');
  const dir = path.join(ROOT, 'android', 'app');
  const file = ['build.gradle', 'build.gradle.kts'].map((f) => path.join(dir, f)).find((f) => fs.existsSync(f));
  if (!file) fail('android/app/build.gradle not found. Did "npx cap add android" run?');
  let src = fs.readFileSync(file, 'utf8');
  const kts = file.endsWith('.kts');
  const a = src.replace(/versionCode(\s*=\s*|\s+)\d+/, (m, sp) => `versionCode${sp}${code}`);
  const b = a.replace(/versionName(\s*=\s*|\s+)"[^"]*"/, (m, sp) => `versionName${sp}"${name}"`);
  if (a === src) fail('versionCode line not found in ' + path.basename(file));
  if (b === a) fail('versionName line not found in ' + path.basename(file));
  fs.writeFileSync(file, b);
  ok(`${path.basename(file)}${kts ? ' (kts)' : ''}: versionCode ${code}, versionName ${name}`);
}

// ---------------------------------------------------------------- native
const VOICE_JAVA = `package com.studyzone.app;

import android.app.Activity;
import android.content.Intent;
import android.speech.RecognizerIntent;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.util.ArrayList;

@CapacitorPlugin(name = "Voice")
public class VoicePlugin extends Plugin {

  @PluginMethod
  public void listen(PluginCall call) {
    Intent intent = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
    intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
    intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE, call.getString("lang", "en-IN"));
    intent.putExtra(RecognizerIntent.EXTRA_PROMPT, call.getString("prompt", "Speak now"));
    intent.putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1);
    try {
      startActivityForResult(call, intent, "listenResult");
    } catch (Exception e) {
      call.reject("Voice input is not available on this device");
    }
  }

  @ActivityCallback
  private void listenResult(PluginCall call, ActivityResult result) {
    if (call == null) return;
    String text = "";
    if (result.getResultCode() == Activity.RESULT_OK && result.getData() != null) {
      ArrayList<String> r = result.getData().getStringArrayListExtra(RecognizerIntent.EXTRA_RESULTS);
      if (r != null && !r.isEmpty()) text = r.get(0);
    }
    JSObject out = new JSObject();
    out.put("text", text);
    call.resolve(out);
  }
}
`;
const MAIN_JAVA = `package com.studyzone.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
  @Override
  public void onCreate(Bundle savedInstanceState) {
    registerPlugin(VoicePlugin.class);
    super.onCreate(savedInstanceState);
  }
}
`;
function native() {
  const dir = path.join(ROOT, 'android', 'app', 'src', 'main', 'java', 'com', 'studyzone', 'app');
  const main = path.join(dir, 'MainActivity.java'), plugin = path.join(dir, 'VoicePlugin.java'), orig = main + '.orig';
  if (process.argv.includes('--remove')) {
    if (fs.existsSync(orig)) { fs.copyFileSync(orig, main); fs.rmSync(orig); }
    fs.rmSync(plugin, { force: true });
    return ok('voice plugin removed');
  }
  if (!fs.existsSync(main)) return console.log('note MainActivity.java not found; voice input will use the browser engine only');
  if (!fs.existsSync(orig)) fs.copyFileSync(main, orig);
  fs.writeFileSync(plugin, VOICE_JAVA);
  fs.writeFileSync(main, MAIN_JAVA);
  ok('voice plugin added to the Android project');
}

// ---------------------------------------------------------------- smoke
async function smoke() {
  let chromium;
  try { ({ chromium } = await import('playwright')); } catch { fail('playwright is not installed (npm install, then npx playwright install chromium)'); }
  const www = path.join(ROOT, 'www');
  if (!fs.existsSync(www)) fail('run "node build.mjs web" first');
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.png': 'image/png', '.json': 'application/json', '.webmanifest': 'application/manifest+json' };
  const server = http.createServer((req, res) => {
    const p = path.join(www, decodeURIComponent(req.url.split('?')[0]).replace(/^\/$/, '/index.html'));
    if (!p.startsWith(www) || !fs.existsSync(p)) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' });
    res.end(fs.readFileSync(p));
  }).listen(0);
  const port = server.address().port;
  const shots = path.join(ROOT, 'smoke');
  fs.mkdirSync(shots, { recursive: true });
  const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  const page = await (await browser.newContext({ viewport: { width: 390, height: 780 } })).newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push('console: ' + m.text()); });
  const need = (cond, msg) => { if (!cond) { errors.push('check failed: ' + msg); } else ok(msg); };
  try {
    await page.goto(`http://localhost:${port}/index.html`);
    await page.waitForTimeout(3300);
    need(await page.evaluate(() => !document.getElementById('splash')), 'splash screen closes by itself');
    need(await page.evaluate(() => typeof go === 'function' && !!S && typeof genLocal === 'function'), 'app core loaded (navigation, state, practice engine)');
    await page.waitForTimeout(700); await page.screenshot({ path: path.join(shots, '1-home.png') });

    await page.evaluate(() => go('tform')); await page.waitForTimeout(250);
    const formulas = await page.evaluate(() => document.querySelectorAll('#fl .card').length);
    need(formulas >= 500, `formula library has ${formulas} formulas`);
    await page.waitForTimeout(700); await page.screenshot({ path: path.join(shots, '2-formulas.png') });

    const bank = await page.evaluate(() => Object.values(BANK).reduce((a, l) => a + l.length, 0));
    need(bank >= 250, `question bank has ${bank} questions`);
    const sets = await page.evaluate(() => [['Biology', 'Cell'], ['Polity', 'Rights'], ['History', 'Modern'], ['English', 'Grammar'], ['Hindi A', 'Samas']]
      .map(([s, t]) => genLocal(t, s, 10, 'MCQ', 'Mixed').length));
    need(sets.every((n) => n >= 5), `practice sets build for fact subjects (${sets.join(', ')} questions)`);

    await page.evaluate(() => go('tfc')); await page.waitForTimeout(250);
    await page.click('text=Study'); await page.click('text=Show answer'); await page.click('text=✓ Good');
    need(await page.evaluate(() => Object.keys(S.fc).length === 1), 'flashcard grading is saved');
    await page.waitForTimeout(700); await page.screenshot({ path: path.join(shots, '3-flashcards.png') });

    await page.evaluate(() => go('ai')); await page.waitForTimeout(250);
    await page.fill('#gi', 'Molar mass of H2SO4'); await page.click('#gb'); await page.waitForTimeout(700);
    const ans = await page.innerText('#cl .bub:last-child');
    need(/98/.test(ans), 'AI Guru solves molar mass offline (98 g/mol)');
    await page.waitForTimeout(700); await page.screenshot({ path: path.join(shots, '4-ai-guru.png') });

    need(await page.evaluate(() => [...document.querySelectorAll('nav button')].some((b) => /PYQs/.test(b.textContent))), 'PYQs tab is in the navigation');
    const sample = '#exam CBSE Class 10\n#subject Maths\n#year 2023\n#chapter Probability\nQ: Smoke test question. The probability of a sure event is\nA) 0\nB) 1\nC) 2\nD) 3\nAns: B';
    const imp = await page.evaluate(async (t) => { const r = pqParse(t, 'x.txt'); const x = await pqImportItems(r.items); return [r.items.length, r.bad.length, x.added]; }, sample);
    need(imp[0] === 1 && imp[1] === 0 && imp[2] === 1, 'PYQ import works (text format, saved to the device)');
    const mixed = await page.evaluate(() => { S.exam = 'Class 10'; S.pqw = 100; let n = 0; for (let i = 0; i < 5; i++) genLocal('Probability', 'Maths', 5, 'MCQ', 'Mixed').forEach((q) => { if (q.pid) n++; }); S.pqw = 50; return n; });
    need(mixed > 0, 'PYQs are mixed into normal practice for the matching chapter');
    await page.evaluate(() => go('pyq')); await page.waitForTimeout(900);
    need(await page.evaluate(() => /1\s*question/.test(document.querySelector('#main').innerText)), 'PYQs screen lists the imported question');
    await page.screenshot({ path: path.join(shots, '5-pyqs.png') });

    const feat = await page.evaluate(() => ({
      fns: ['plan', 'mock', 'trev', 'vsay', 'askImg', 'remSave', 'pickImg', 'voiceAsk', 'voiceRoute', 'usearch', 'speak', 'pqPhoto'].every((f) => typeof window[f] === 'function'),
      lb: /Leaderboard|tlb\(/.test(document.documentElement.innerHTML),
      rows: planRows().length,
      mock: mockBuild('Maths', 'quick').qs.length,
    }));
    need(feat.fns, 'plan, mock tests, review hub, voice, photo and reminder code is present');
    need(!feat.lb, 'leaderboard is removed');
    need(feat.rows > 5 && feat.mock >= 10, `smart plan ranks ${feat.rows} chapters; a quick mock builds ${feat.mock} questions`);
    const vr = await page.evaluate(() => { const o = {}; ['open flashcards', 'practice maths', 'formula for escape velocity', 'photosynthesis'].forEach((t) => { go('home'); o[t] = voiceRoute(t); }); const d = usData('escape velocity'); o.hits = d.f.length + d.q.length; return o; });
    need(vr['open flashcards'] === 'nav' && vr['practice maths'] === 'practice' && vr['formula for escape velocity'] === 'formula' && vr.photosynthesis === 'search', 'voice commands are understood (navigation, practice, formulas, search)');
    need(vr.hits > 0, 'universal search finds formulas and questions');
    await page.evaluate(() => go('sett')); await page.waitForTimeout(500);
    need(await page.evaluate(() => document.querySelectorAll('#ap option').length === 2 && !document.getElementById('ak')), 'Settings has no API key options');
    await page.evaluate(() => go('mock')); await page.waitForTimeout(900);
    await page.screenshot({ path: path.join(shots, '5b-mock.png') });

    await page.evaluate(() => go('res')); await page.waitForTimeout(250);
    need(await page.evaluate(() => document.querySelectorAll('details a').length >= 15), 'resources page lists the study links');
    await page.waitForTimeout(700); await page.screenshot({ path: path.join(shots, '6-resources.png') });
  } catch (e) { errors.push('exception: ' + e.message); }
  await browser.close(); server.close();
  if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
  console.log('Smoke test passed.');
}

const cmd = process.argv[2];
const cmds = { check, web, assets, patch, native, smoke };
if (!cmds[cmd]) fail('usage: node build.mjs <' + Object.keys(cmds).join('|') + '>');
await cmds[cmd]();
