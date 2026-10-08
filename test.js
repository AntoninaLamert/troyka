// Run with: node test.js
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

class Element {
  constructor() {
    this._html = ""; this.children = []; this.htmlWrites = 0; this.textContent = ""; this.listeners = {}; this.attributes = {};
    this.style = { setProperty(n, v) { this[n] = v; } }; this.dataset = {}; this.classes = new Set();
    this.classList = { add: n => this.classes.add(n), remove: n => this.classes.delete(n), toggle: (n, on) => on ? this.classes.add(n) : this.classes.delete(n) };
  }
  set innerHTML(value) {
    this.htmlWrites++;
    this._html = value; this.children = []; this.gemNode = null;
    for (const match of value.matchAll(/<button ([^>]+)>(.*?)<\/button>/gs)) {
      const tile = new Element(); tile.parent = this;
      for (const attr of match[1].matchAll(/([\w-]+)="([^"]*)"/g)) tile.setAttribute(attr[1], attr[2]);
      tile.innerHTML = match[2]; this.children.push(tile);
    }
  }
  get innerHTML() { return this.children.length ? this.children.map(tile => tile.outerHTML).join("") : this._html; }
  get outerHTML() { return `<button class="${this.className}" ${Object.entries(this.attributes).filter(([key]) => key !== "class").map(([key, value]) => `${key}="${value}"`).join(" ")}>${this.innerHTML}</button>`; }
  get className() { return [...this.classes].join(" "); }
  set className(value) { this.classes = new Set(value.split(/\s+/).filter(Boolean)); }
  addEventListener(n, fn) { this.listeners[n] = fn; }
  setAttribute(n, v) { this.attributes[n] = String(v); if (n === "class") this.className = v; if (n.startsWith("data-")) this.dataset[n.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = String(v); }
  getAttribute(n) { return this.attributes[n] ?? null; }
  removeAttribute(n) { delete this.attributes[n]; if (n.startsWith("data-")) delete this.dataset[n.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase())]; }
  querySelector(s) {
    if (s === "span" || s === "strong") return (this.child ||= new Element());
    if (s === ".gem" && this._html.includes('class="gem ')) { if (!this.gemNode) { this.gemNode = new Element(); this.gemNode.parent = this; } return this.gemNode; }
    if (s === ".tile") return this.children[0];
    return null;
  }
  querySelectorAll() { return this.children; }
  closest() { return this.dataset.index !== undefined ? this : this.parent?.closest(); }
  getBoundingClientRect() { const index = Number(this.dataset.index ?? this.parent?.dataset.index ?? 0); return {left:index % 8 * 40, top:Math.floor(index / 8) * 40, width:36, height:36}; }
  setPointerCapture(id) { this.pointerId = id; }
  hasPointerCapture(id) { return this.pointerId === id; }
  releasePointerCapture() { this.pointerId = null; }
  focus() { this.focused = true; }
}
const ids = ["app", "start-screen", "game-screen", "result-screen", "stats-screen", "play-button", "result-primary", "result-menu", "start-stats", "result-stats", "stats-back", "difficulty-select", "theme-select", "start-best", "result-best", "result-score", "result-kicker", "result-title", "result-description", "stage-label", "stage-name", "stage-progress", "progress-fill", "stage-objective", "stage-count", "combo-indicator", "power-hammer", "power-shuffle", "power-swap", "stat-games", "stat-best", "stat-cascade", "stat-combo", "stat-gems", "stats-title", "board", "score", "status", "new-game", "sound-toggle", "combo-reaction"];
const html = fs.readFileSync(path.join(__dirname, "index.html"), "utf8");
for (const id of ids) assert(html.includes(`id="${id}"`), `missing HTML element: ${id}`);
const el = Object.fromEntries(ids.map(id => [id, new Element()]));
const storage = new Map([["twilight-gems-best-v1", "120"]]);
const soundCalls = [];
const sound = Object.fromEntries(["select", "swap", "invalid", "match", "complete", "toggleCue", "setTheme"].map(n => [n, (...args) => soundCalls.push([n, ...args])]));
sound.enabled = true;
sound.toggle = () => (sound.enabled = !sound.enabled);
let seed = 15947;
const randomMath = Object.create(Math);
randomMath.random = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
const source = fs.readFileSync(path.join(__dirname, "script.js"), "utf8");
let hintCallback = null;
const hintToken = {};
const sandbox = {
  document: { getElementById: id => el[id], body: new Element() },
  window: { localStorage: { getItem: k => storage.get(k) ?? null, setItem: (k, v) => storage.set(k, v) }, gameSound: sound, matchMedia: () => ({ matches: false }), addEventListener() {} },
  Math: randomMath,
  setTimeout: (fn, ms) => ms === 10000 ? (hintCallback = fn, hintToken) : setTimeout(fn, Math.min(ms, 2)),
  clearTimeout: timer => timer === hintToken ? (hintCallback = null) : clearTimeout(timer),
  requestAnimationFrame: fn => setTimeout(fn, 1), cancelAnimationFrame: clearTimeout
};
vm.runInNewContext(source, sandbox);
const tiles = () => [...el.board.innerHTML.matchAll(/<button class="([^"]+)"[^>]*data-index="(\d+)"[^>]*>(.*?)<\/button>/gs)].map(m => ({ classes: m[1], index: Number(m[2]), type: m[3].match(/class="gem ([a-z]+)"/)?.[1] || null }));
const types = () => tiles().map(tile => tile.type);
const score = () => Number(el.score.textContent.replace(/\D/g, ""));
const view = () => el.app.dataset.view;
const press = id => el[id].listeners.click();
const at = (r, c) => r * 8 + c;
function matches(b) {
  const found = new Set();
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) for (const [dr, dc] of [[0, 1], [1, 0]]) {
    if (r + 2 * dr >= 8 || c + 2 * dc >= 8) continue;
    const t = b[at(r, c)];
    if (t && t === b[at(r + dr, c + dc)] && t === b[at(r + 2 * dr, c + 2 * dc)])
      for (let i = 0; i < 3; i++) found.add(at(r + i * dr, c + i * dc));
  }
  return found;
}
function pairs() {
  const out = [];
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
    const a = at(r, c); if (c < 7) out.push([a, a + 1]); if (r < 7) out.push([a, a + 8]);
  }
  return out;
}
function swapMatches(b, a, c) { const copy = [...b]; [copy[a], copy[c]] = [copy[c], copy[a]]; return matches(copy); }
function validPair(a, b) {
  const t = tiles();
  if (!t[a].type || !t[b].type || /obstacle-/.test(t[a].classes + t[b].classes)) return false;
  return /special-(color|row|col)/.test(t[a].classes + t[b].classes) || swapMatches(t.map(x => x.type), a, b).size > 0;
}
function clickGem(i, detail = 0) { el.board.listeners.click({ detail, target: { closest: () => ({ dataset: { index: String(i) } }) } }); }
function pointer(name, index, pointerId = 7) {
  el.board.listeners[name]({ target: el.board.children[index], clientX:index % 8 * 40 + 18, clientY:Math.floor(index / 8) * 40 + 18,
    pointerId, isPrimary:true, button:0, preventDefault() {} });
}
async function waitFor(predicate) {
  for (let i = 0; i < 1000; i++) { if (predicate()) return; await new Promise(r => setTimeout(r, 2)); }
  throw new Error(`timeout: view=${view()}, score=${score()}, status=${el.status.textContent}`);
}
async function validMove() {
  const before = types();
  const pair = pairs().find(([x, y]) => validPair(x, y));
  assert(pair, "board has a possible move");
  const [a, b] = pair;
  const base = swapMatches(before, a, b).size;
  const old = score();
  clickGem(a); clickGem(b);
  await waitFor(() => score() > old && (view() === "result" || /Соберите следующую комбинацию|перемешаны/.test(el.status.textContent)));
  await new Promise(r => setTimeout(r, 8));
  assert.equal(types().length, 64);
  assert.equal(matches(types()).size, 0, "cascades fully resolve");
  if (view() === "game") assert(pairs().some(([x, y]) => validPair(x, y)), "board remains playable");
  return score() - old > base * 10;
}

(async () => {
  assert.equal(view(), "start");
  assert.equal(el["start-best"].textContent, "120");
  press("play-button");
  assert.equal(view(), "game");
  assert.equal(el["stage-label"].textContent, "ЭТАП 1 / 3");
  assert.equal(types().length, 64);
  assert.equal(matches(types()).size, 0);
  assert.equal(typeof hintCallback, "function", "hint is scheduled after play");
  hintCallback();
  assert(tiles().some(tile => tile.classes.includes("hint")), "possible move starts bouncing after ten seconds");
  const original = types();
  const bad = pairs().find(([a, b]) => !validPair(a, b));
  clickGem(bad[0]); clickGem(bad[1]);
  await waitFor(() => el.status.textContent === "Комбинация не получилась" && types().join() === original.join());
  await new Promise(r => setTimeout(r, 8));
  assert.equal(score(), 0);

  const cells = [...el.board.children];
  const writesBeforeSelect = cells.reduce((sum, tile) => sum + tile.htmlWrites, 0);
  clickGem(0); clickGem(0);
  assert.equal(cells.reduce((sum, tile) => sum + tile.htmlWrites, 0), writesBeforeSelect, "selection does not recreate any SVG");
  pointer("pointerdown", 2);
  assert(cells[2].hasPointerCapture(7), "pointer capture stays on the pressed cell so taps retain their target");
  pointer("pointerup", 2); clickGem(2, 1);
  assert.equal(cells[2].getAttribute("aria-pressed"), "true", "a tap without dragging still selects the gem");
  clickGem(2, 1);
  pointer("pointerdown", bad[0]);
  for (let move = 0; move < 60; move++) pointer("pointermove", bad[1]);
  await new Promise(resolve => setTimeout(resolve, 3));
  assert(el.board.children[bad[0]].querySelector(".gem").style.transform.includes("translate3d"), "gem follows the pointer");
  assert.equal(cells.reduce((sum, tile) => sum + tile.htmlWrites, 0), writesBeforeSelect, "dragging does not redraw cells");
  el.board.listeners.pointercancel();
  assert.equal(el.board.children[bad[0]].querySelector(".gem").style.transform, "", "cancelled touch clears the translation");
  assert.equal(types().join(), original.join());
  const dragPair = pairs().find(([a, b]) => validPair(a, b));
  pointer("pointerdown", dragPair[0]); pointer("pointermove", dragPair[1]); pointer("pointerup", dragPair[1]);
  clickGem(dragPair[1], 1); // Synthetic click after pointerup must not start another move.
  await waitFor(() => score() > 0 && (view() === "result" || /Соберите следующую комбинацию|перемешаны/.test(el.status.textContent)));
  await new Promise(resolve => setTimeout(resolve, 8));
  assert.equal(el.board.htmlWrites, 1, "board is created once across swaps and cascades");
  cells.forEach((cell, index) => assert.equal(el.board.children[index], cell, "cell DOM identity is preserved"));

  let cascadeObserved = false;
  for (let stage = 0; stage < 3; stage++) {
    for (let turn = 0; turn < 150 && view() === "game"; turn++) cascadeObserved = await validMove() || cascadeObserved;
    assert.equal(view(), "result", `stage ${stage + 1} completed`);
    assert.equal(Number(el["result-score"].textContent.replace(/\D/g, "")), score());
    assert.equal(Number(storage.get("twilight-gems-best-v1")), score());
    if (stage < 2) {
      const old = score();
      assert.equal(el["result-primary"].child.textContent, "Следующий этап");
      press("result-primary");
      assert.equal(view(), "game");
      assert.equal(score(), old);
      assert.equal(el["stage-label"].textContent, `ЭТАП ${stage + 2} / 3`);
      assert.equal(el["stage-progress"].attributes["aria-valuenow"], "0");
    }
  }
  assert(cascadeObserved, "cascade occurred");
  assert.equal(el["result-primary"].child.textContent, "Играть снова");
  assert(soundCalls.some(([name, final]) => name === "complete" && final === true));
  press("result-stats");
  assert.equal(view(), "stats");
  assert(Number(el["stat-games"].textContent) >= 1);
  assert(Number(el["stat-gems"].textContent.replace(/\D/g, "")) > 0);
  press("stats-back");
  assert.equal(view(), "result");
  press("result-menu");
  assert.equal(view(), "start");
  assert.equal(Number(el["start-best"].textContent.replace(/\D/g, "")), Number(storage.get("twilight-gems-best-v1")));
  press("play-button");
  assert.equal(score(), 0);
  el["theme-select"].value = "ocean";
  el["theme-select"].listeners.change();
  assert.equal(el.app.dataset.theme, "ocean");
  assert(soundCalls.some(([name, theme]) => name === "setTheme" && theme === "ocean"));
  await validMove();
  press("new-game");
  assert.equal(view(), "game");
  assert.equal(score(), 0);
  assert.equal(el["stage-label"].textContent, "ЭТАП 1 / 3");
  const target = tiles().find(tile => tile.type);
  press("power-hammer"); clickGem(target.index);
  await waitFor(() => score() > 0 && /Соберите следующую комбинацию|перемешаны/.test(el.status.textContent));
  assert.equal(el["power-hammer"].child.textContent, "0", "hammer is consumed");
  press("power-shuffle");
  assert.equal(el["power-shuffle"].child.textContent, "0", "shuffle is consumed");
  assert.equal(matches(types()).size, 0);
  assert(pairs().some(([a, b]) => validPair(a, b)));
  const current = types();
  let freePair = null;
  for (let a = 0; a < 64 && !freePair; a++) for (let b = a + 2; b < 64; b++) {
    if (Math.abs(Math.floor(a / 8) - Math.floor(b / 8)) + Math.abs(a % 8 - b % 8) <= 1) continue;
    if (current[a] && current[b] && current[a] !== current[b] && !swapMatches(current, a, b).size) { freePair = [a, b]; break; }
  }
  assert(freePair);
  press("power-swap"); clickGem(freePair[0]); clickGem(freePair[1]);
  await waitFor(() => /Свободная перестановка выполнена|перемешаны/.test(el.status.textContent));
  assert.equal(el["power-swap"].child.textContent, "0", "free swap is consumed");
  el["difficulty-select"].value = "easy"; el["difficulty-select"].listeners.change();
  press("new-game");
  assert(new Set(types()).size <= 3, "easy mode uses three colors");
  assert.equal(el["stage-progress"].getAttribute("aria-valuemax"), "12", "easy mode lowers objective");
  await validMove();
  el["difficulty-select"].value = "hard"; el["difficulty-select"].listeners.change();
  press("new-game");
  assert(new Set(types()).size >= 5, "hard mode uses more colors");
  assert.equal(el["stage-progress"].getAttribute("aria-valuemax"), "28", "hard mode raises objective");
  press("sound-toggle"); assert.equal(el["sound-toggle"].attributes["aria-pressed"], "false");
  press("sound-toggle"); assert.equal(el["sound-toggle"].attributes["aria-pressed"], "true");
  for (const name of ["select", "swap", "invalid", "match", "complete"]) assert(soundCalls.some(([n]) => n === name), `${name} played`);
  vm.runInNewContext(source, sandbox);
  assert.equal(view(), "start", "reload returns to start screen");
  assert.equal(Number(el["start-best"].textContent.replace(/\D/g, "")), Number(storage.get("twilight-gems-best-v1")), "record survives reload");
  const instrumented = source.replace("  loadSettings();", `  window.__debug = {
    setBoard(types, blocks = Array(64).fill(null)) { board = types.map(type => type ? newGem(type) : null); obstacles = blocks; render(); },
    getBoard: () => board, getObstacles: () => obstacles, getCollected: () => collected,
    getStats: () => stats, findMatchGroups, findPossibleMove,
    shapeBonus, damageObstacles, shuffleBoard, render, attemptSwap,
    resolve: () => resolveCascades(findMatchGroups(), gameId)
  };\n  loadSettings();`);
  assert.notEqual(instrumented, source);
  vm.runInNewContext(instrumented, sandbox);
  const engine = sandbox.window.__debug;
  const palette = ["ruby", "amber", "emerald", "sapphire", "amethyst", "aqua"];
  const pattern = () => Array.from({ length: 64 }, (_, i) => palette[(Math.floor(i / 8) + i % 8) % 6]);
  const locked = pattern();
  engine.setBoard(locked);
  assert.equal(engine.findMatchGroups().length, 0);
  assert.equal(engine.findPossibleMove(), null, "constructed board has no move");
  await engine.resolve();
  assert.equal(engine.findMatchGroups().length, 0, "automatic shuffle removes ready matches");
  assert(engine.findPossibleMove(), "automatic shuffle restores a move");

  const four = pattern();
  for (let c = 0; c < 4; c++) four[c] = "ruby";
  engine.setBoard(four);
  await engine.resolve();
  assert(engine.getBoard().some(gem => gem?.special === "row"), "four gems create a row clear gem");
  const five = pattern();
  for (let c = 0; c < 5; c++) five[c] = "ruby";
  engine.setBoard(five);
  await engine.resolve();
  assert(engine.getBoard().some(gem => gem?.special === "color"), "five gems create a color clear gem");

  const tee = pattern();
  for (const i of [at(3, 2), at(3, 3), at(3, 4), at(2, 3), at(4, 3)]) tee[i] = "ruby";
  engine.setBoard(tee);
  assert.equal(engine.shapeBonus(engine.findMatchGroups()).shape, "Т");
  const beforeT = score();
  await engine.resolve();
  assert(score() - beforeT >= 150, "T shape receives a score bonus");
  const ell = pattern();
  for (const i of [at(3, 3), at(3, 4), at(3, 5), at(4, 3), at(5, 3)]) ell[i] = "ruby";
  engine.setBoard(ell);
  assert.equal(engine.shapeBonus(engine.findMatchGroups()).shape, "Г");
  const beforeL = score();
  await engine.resolve();
  assert(score() - beforeL >= 150, "L shape receives a score bonus");

  const blocks = Array(64).fill(null);
  blocks[at(4, 3)] = { kind: "crate", hp: 1 };
  blocks[at(2, 3)] = { kind: "stone", hp: 2 };
  const obstructed = pattern();
  obstructed[at(4, 3)] = null; obstructed[at(2, 3)] = null;
  engine.setBoard(obstructed, blocks);
  engine.damageObstacles(new Set([at(3, 2), at(3, 3), at(3, 4)]));
  assert.equal(engine.getObstacles()[at(4, 3)], null, "adjacent match breaks crate");
  assert.equal(engine.getObstacles()[at(2, 3)].hp, 1, "stone needs two hits");

  engine.setBoard(pattern());
  engine.getBoard()[0].special = "color";
  const beforeColor = engine.getCollected().amber;
  await engine.attemptSwap(0, 1);
  assert(engine.getCollected().amber - beforeColor >= 8, "color gem clears the chosen color");
  const line = pattern();
  for (let c = 0; c < 3; c++) line[c] = "ruby";
  engine.setBoard(line);
  engine.getBoard()[0].special = "row";
  const beforeLine = engine.getStats().gems;
  await engine.resolve();
  assert(engine.getStats().gems - beforeLine >= 8, "line gem clears an entire row");
  console.log("OK: stages, goals, cascades, hints, powers, themes, difficulty, stats, sound and persistence");
})().catch(error => { console.error(error); process.exitCode = 1; });
