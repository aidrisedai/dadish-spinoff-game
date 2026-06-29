/* Tiny WebAudio sound engine — all sounds synthesized, no asset files needed. */
const Sound = (() => {
  let ctx = null;
  let muted = false;

  function ensure() {
    if (!ctx) {
      try { ctx = new (window.AudioContext || window.webkitAudioContext)(); }
      catch (e) { ctx = null; }
    }
    if (ctx && ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  // Basic tone with envelope.
  function tone(freq, dur, type = 'square', vol = 0.18, slide = 0) {
    if (muted) return;
    const c = ensure();
    if (!c) return;
    const t = c.currentTime;
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t + dur);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain).connect(c.destination);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  function noise(dur, vol = 0.2) {
    if (muted) return;
    const c = ensure();
    if (!c) return;
    const t = c.currentTime;
    const buf = c.createBuffer(1, c.sampleRate * dur, c.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    const src = c.createBufferSource();
    src.buffer = buf;
    const gain = c.createGain();
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    const filter = c.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 800;
    src.connect(filter).connect(gain).connect(c.destination);
    src.start(t);
  }

  return {
    jump()    { tone(420, 0.16, 'square', 0.16, 260); },
    land()    { tone(180, 0.07, 'sine', 0.12); },
    collect() { tone(660, 0.09, 'square', 0.16); setTimeout(() => tone(990, 0.12, 'square', 0.16), 70); },
    key()     { tone(880, 0.08, 'triangle', 0.18); setTimeout(() => tone(1320, 0.1, 'triangle', 0.18), 60); },
    unlock()  { tone(300, 0.18, 'sawtooth', 0.14, 200); },
    stomp()   { tone(160, 0.12, 'square', 0.2, -90); noise(0.12, 0.12); },
    die()     { tone(380, 0.5, 'sawtooth', 0.2, -300); noise(0.18, 0.12); },
    win()     { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => tone(f, 0.18, 'square', 0.18), i * 110)); },
    select()  { tone(560, 0.06, 'square', 0.12); },
    toggleMute() { muted = !muted; return muted; },
    isMuted() { return muted; },
    resume()  { ensure(); }
  };
})();
