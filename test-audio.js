// Run with: node test-audio.js
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

class Param {
  constructor() { this.value = 0; }
  setValueAtTime(value) { this.value = value; }
  exponentialRampToValueAtTime(value) { this.value = value; }
  setTargetAtTime(value) { this.value = value; }
  cancelScheduledValues() {}
}

class Node {
  connect() { return this; }
  disconnect() {}
}

const oscillators = [];
class AudioContextMock {
  constructor() { this.currentTime = 0; this.state = "running"; this.destination = new Node(); }
  createDynamicsCompressor() {
    const node = new Node();
    for (const key of ["threshold", "knee", "ratio", "attack", "release"]) node[key] = new Param();
    return node;
  }
  createGain() { const node = new Node(); node.gain = new Param(); return node; }
  createDelay() { const node = new Node(); node.delayTime = new Param(); return node; }
  createStereoPanner() { const node = new Node(); node.pan = new Param(); return node; }
  createOscillator() {
    const node = new Node();
    node.frequency = new Param();
    node.detune = new Param();
    node.start = time => { node.startedAt = time; };
    node.stop = time => { node.stoppedAt = time; };
    oscillators.push(node);
    return node;
  }
  resume() { this.state = "running"; return Promise.resolve(); }
}

let timerId = 0;
const timers = new Map();
const browser = {
  AudioContext: AudioContextMock,
  setTimeout(callback, milliseconds) { const id = ++timerId; timers.set(id, { callback, milliseconds }); return id; },
  clearTimeout(id) { timers.delete(id); }
};
vm.runInNewContext(fs.readFileSync(path.join(__dirname, "audio.js"), "utf8"), {
  window: browser, document: { hidden: false }, Math
});

const audio = browser.gameSound;
audio.select();
assert.equal(oscillators.length, 2, "selection plays only two short notes");
assert.equal(timers.size, 1, "background phrase is scheduled, not played continuously");
assert([...timers.values()][0].milliseconds >= 3000, "background starts after a pause");

audio.swap();
audio.invalid();
audio.match(1, 3);
audio.match(3, 5);
audio.complete(false);
audio.complete(true);
const beforeTheme = oscillators.length;
audio.setTheme("sweets");
audio.select();
assert(oscillators[beforeTheme].frequency.value > 740, "theme changes sound pitch");
audio.setTheme("gems");
assert(oscillators.every(oscillator => Number.isFinite(oscillator.stoppedAt)), "every sound has a stop time");
assert(oscillators.every(oscillator => oscillator.stoppedAt - oscillator.startedAt < 1), "no continuous oscillator remains");

assert.equal(audio.toggle(), false);
assert.equal(timers.size, 0, "muting cancels the pending background phrase");
const countWhileMuted = oscillators.length;
audio.select();
assert.equal(oscillators.length, countWhileMuted, "muted effects stay silent");

assert.equal(audio.toggle(), true);
const [id, timer] = [...timers][0];
timers.delete(id);
timer.callback();
assert.equal(oscillators.length, countWhileMuted + 2, "background phrase contains two short notes");
assert(oscillators.slice(-2).every(oscillator => oscillator.stoppedAt - oscillator.startedAt < 1));
audio.toggle();
assert.equal(timers.size, 0);
console.log("OK: short effects, delayed ambient phrase, mute and resume");
