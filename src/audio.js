/** Procedural rain, water, and drips. No samples. */
export function createAmbience() {
  let ctx = null;
  let master = null;
  let rainGain = null;
  let waterGain = null;
  let started = false;
  let muted = false;
  let rainAmount = 0.7;
  let dripTimer = 0;

  function noiseBuffer(context) {
    const length = context.sampleRate * 2;
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const data = buffer.getChannelData(0);
    let b0 = 0;
    let b1 = 0;
    for (let i = 0; i < length; i += 1) {
      const white = Math.random() * 2 - 1;
      b0 = 0.996 * b0 + white * 0.04;
      b1 = 0.97 * b1 + white * 0.08;
      data[i] = b0 * 1.4 + b1 * 0.35;
    }
    return buffer;
  }

  function ensure() {
    if (ctx) return true;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0;
    master.connect(ctx.destination);
    const buffer = noiseBuffer(ctx);

    const rain = ctx.createBufferSource();
    rain.buffer = buffer;
    rain.loop = true;
    const band = ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.value = 1600;
    band.Q.value = 0.45;
    rainGain = ctx.createGain();
    rainGain.gain.value = 0.14;
    rain.connect(band);
    band.connect(rainGain);
    rainGain.connect(master);
    rain.start();

    const water = ctx.createBufferSource();
    water.buffer = buffer;
    water.loop = true;
    const low = ctx.createBiquadFilter();
    low.type = 'lowpass';
    low.frequency.value = 380;
    waterGain = ctx.createGain();
    waterGain.gain.value = 0.06;
    water.connect(low);
    low.connect(waterGain);
    waterGain.connect(master);
    water.start();
    applyRain();
    return true;
  }

  function applyRain() {
    if (!rainGain) return;
    rainGain.gain.value = 0.04 + rainAmount * 0.16;
    if (waterGain) waterGain.gain.value = 0.035 + (1 - rainAmount) * 0.02 + rainAmount * 0.03;
  }

  function drip() {
    if (!ctx || muted || !started) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 680 + Math.random() * 900;
    const now = ctx.currentTime;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.035 + Math.random() * 0.03, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
    osc.connect(gain);
    gain.connect(master);
    osc.start(now);
    osc.stop(now + 0.2);
  }

  function schedule() {
    window.clearTimeout(dripTimer);
    if (!started || muted) return;
    drip();
    const gap = 280 + Math.random() * 1400 * (1.15 - rainAmount * 0.7);
    dripTimer = window.setTimeout(schedule, gap);
  }

  return {
    get started() {
      return started;
    },
    get muted() {
      return muted;
    },
    async start() {
      if (!ensure()) return;
      if (ctx.state === 'suspended') await ctx.resume();
      started = true;
      const now = ctx.currentTime;
      master.gain.cancelScheduledValues(now);
      master.gain.setTargetAtTime(muted ? 0 : 0.85, now, 0.08);
      schedule();
    },
    setMuted(next) {
      muted = next;
      if (!ctx || !master) return;
      master.gain.setTargetAtTime(muted || !started ? 0 : 0.85, ctx.currentTime, 0.05);
      if (muted) window.clearTimeout(dripTimer);
      else schedule();
    },
    toggle() {
      this.setMuted(!muted);
      return muted;
    },
    setRain(amount) {
      rainAmount = amount;
      applyRain();
    },
  };
}
