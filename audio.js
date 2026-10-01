(() => {
  "use strict";

  const AudioContextType = window.AudioContext || window.webkitAudioContext;
  let context = null;
  let master = null;
  let effects = null;
  let music = null;
  let delayNode = null;
  let delayReturn = null;
  let enabled = true;
  let musicTimer = 0;
  let motifIndex = 0;
  let themeScale = 1;

  function initialize() {
    if (context || !AudioContextType) return Boolean(context);
    try {
      context = new AudioContextType({ latencyHint: "interactive" });
      const compressor = context.createDynamicsCompressor();
      compressor.threshold.value = -18;
      compressor.knee.value = 16;
      compressor.ratio.value = 3;
      compressor.attack.value = .008;
      compressor.release.value = .18;
      compressor.connect(context.destination);

      master = context.createGain();
      master.gain.value = .0001;
      master.connect(compressor);

      effects = context.createGain();
      effects.gain.value = .68;
      effects.connect(master);

      delayNode = context.createDelay(.4);
      delayNode.delayTime.value = .16;
      delayReturn = context.createGain();
      delayReturn.gain.value = .14;
      effects.connect(delayNode);
      delayNode.connect(delayReturn);
      delayReturn.connect(master);

      music = context.createGain();
      music.gain.value = .35;
      music.connect(master);
      return true;
    } catch (error) {
      context = null;
      return false;
    }
  }

  function playTone(frequency, start, duration, level, destination, options = {}) {
    if (!context || !destination) return;
    const oscillator = context.createOscillator();
    const envelope = context.createGain();
    oscillator.type = options.wave || "sine";
    oscillator.frequency.setValueAtTime(Math.max(20, frequency * themeScale), start);
    if (options.endFrequency) {
      oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, options.endFrequency * themeScale), start + duration);
    }
    if (options.detune) oscillator.detune.value = options.detune;

    envelope.gain.setValueAtTime(.0001, start);
    envelope.gain.exponentialRampToValueAtTime(Math.max(.001, level), start + Math.min(.025, duration * .28));
    envelope.gain.exponentialRampToValueAtTime(.0001, start + duration);
    oscillator.connect(envelope);

    let output = envelope;
    let pannerNode = null;
    if (typeof context.createStereoPanner === "function" && options.pan) {
      pannerNode = context.createStereoPanner();
      pannerNode.pan.value = options.pan;
      envelope.connect(pannerNode);
      pannerNode.connect(destination);
      output = null;
    }
    if (output) output.connect(destination);
    oscillator.onended = () => {
      oscillator.disconnect();
      envelope.disconnect();
      pannerNode?.disconnect();
    };
    oscillator.start(start);
    oscillator.stop(start + duration + .04);
  }

  function activate() {
    if (!enabled || !initialize()) return false;
    if (context.state === "suspended") context.resume().catch(() => {});
    const now = context.currentTime;
    master.gain.cancelScheduledValues(now);
    master.gain.setTargetAtTime(.62, now, .11);
    startAmbient();
    return true;
  }

  function startAmbient() {
    if (!context || !music || musicTimer) return;
    const motif = [659.25, 783.99, 880, 987.77, 783.99, 587.33, 659.25];
    const playPhrase = () => {
      if (!enabled || !context) return;
      if (typeof document === "undefined" || !document.hidden) {
        const when = context.currentTime + .04;
        const first = motif[motifIndex % motif.length];
        const second = motif[(motifIndex + 1) % motif.length];
        motifIndex = (motifIndex + 2) % motif.length;
        playTone(first, when, .52, .026, music, { wave: "sine", detune: 2 });
        playTone(second, when + .32, .58, .02, music, { wave: "sine", detune: -2 });
      }
      musicTimer = window.setTimeout(playPhrase, 5300);
    };
    musicTimer = window.setTimeout(playPhrase, 3200);
  }

  function stopAmbient() {
    if (musicTimer) window.clearTimeout(musicTimer);
    musicTimer = 0;
  }

  function withAudio(callback) {
    if (!enabled || !activate()) return;
    callback(context.currentTime);
  }

  const api = {
    get enabled() { return enabled; },
    setTheme(name) { themeScale = ({ gems: 1, cosmos: .83, sweets: 1.18, ocean: .92 })[name] || 1; },
    toggle() {
      enabled = !enabled;
      if (enabled) {
        activate();
      } else if (context) {
        const now = context.currentTime;
        master.gain.cancelScheduledValues(now);
        master.gain.setTargetAtTime(.0001, now, .055);
        stopAmbient();
      }
      return enabled;
    },
    select() {
      withAudio(now => {
        playTone(740, now, .105, .036, effects, { wave: "sine" });
        playTone(1110, now + .012, .13, .016, effects, { wave: "sine", pan: .12 });
      });
    },
    swap() {
      withAudio(now => {
        playTone(294, now, .16, .035, effects, { wave: "triangle", endFrequency: 392 });
        playTone(440, now + .025, .13, .016, effects, { wave: "sine", endFrequency: 523, pan: -.12 });
      });
    },
    invalid() {
      withAudio(now => {
        playTone(247, now, .18, .025, effects, { wave: "sine", endFrequency: 196 });
        playTone(311, now + .025, .12, .009, effects, { wave: "triangle", endFrequency: 262 });
      });
    },
    match(cascade = 1, matchSize = 3) {
      withAudio(now => {
        const level = Math.min(6, Math.max(1, cascade));
        const lift = Math.pow(2, ((level - 1) * 1.7) / 12);
        const notes = [523.25, 659.25, 783.99, 1046.5];
        const count = Math.min(4, matchSize >= 5 || level >= 3 ? 4 : 3);
        const gain = .045 + level * .006;
        for (let i = 0; i < count; i++) {
          const when = now + i * .057;
          playTone(notes[i] * lift, when, .29 + level * .018, gain * (i === 0 ? 1 : .82), effects, { wave: "sine", pan: (i - (count - 1) / 2) * .12 });
        }
        playTone(1568 * lift, now + .105, .26 + level * .025, .012 + level * .002, effects, { wave: "sine", pan: .1 });
      });
    },
    complete(finalStage = false) {
      withAudio(now => {
        const notes = finalStage ? [523.25, 659.25, 783.99, 1046.5, 1318.5] : [523.25, 659.25, 783.99, 1046.5];
        notes.forEach((note, index) => {
          playTone(note, now + index * .095, .32, .028, effects, { wave: "sine", pan: (index - 2) * .08 });
        });
      });
    },
    toggleCue() {
      withAudio(now => playTone(880, now, .09, .018, effects, { wave: "sine" }));
    }
  };

  window.gameSound = api;
})();
