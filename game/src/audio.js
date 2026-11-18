// WebAudio sound: synthesized SFX and three procedural radio stations.
// No audio files, no network — every sound is built from oscillators and
// filtered noise. Everything is guarded so a missing AudioContext can never
// crash the game (headless screenshots run with audio disabled).

export function createAudio() {
  const audio = {
    ctx: null, master: null, musicGain: null, sfxGain: null,
    muted: false, ready: false, station: 0, engineOsc: null, engineGain: null,
    sirenOn: false, sirenOsc: null, sirenGain: null, sirenTimer: 0,
    nextNoteAt: 0, step: 0,
  };

  audio.init = () => {
    if (audio.ready) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      audio.ctx = new AC();
      audio.master = audio.ctx.createGain();
      audio.master.gain.value = 0.5;
      audio.master.connect(audio.ctx.destination);
      audio.musicGain = audio.ctx.createGain();
      audio.musicGain.gain.value = 0.16;
      audio.musicGain.connect(audio.master);
      audio.sfxGain = audio.ctx.createGain();
      audio.sfxGain.gain.value = 0.5;
      audio.sfxGain.connect(audio.master);
      audio.ready = true;
      audio.nextNoteAt = audio.ctx.currentTime + 0.1;
    } catch { /* audio stays off */ }
  };

  audio.resume = () => {
    if (audio.ctx && audio.ctx.state === 'suspended') audio.ctx.resume().catch(() => {});
  };

  audio.setMuted = (m) => {
    audio.muted = m;
    if (audio.master) audio.master.gain.value = m ? 0 : 0.5;
  };

  function tone(freq, dur, type, vol, when = 0, slideTo = 0) {
    if (!audio.ready || audio.muted) return;
    try {
      const t0 = audio.ctx.currentTime + when;
      const osc = audio.ctx.createOscillator();
      const g = audio.ctx.createGain();
      osc.type = type || 'sine';
      osc.frequency.setValueAtTime(freq, t0);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
      g.gain.setValueAtTime(vol || 0.3, t0);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
      osc.connect(g); g.connect(audio.sfxGain);
      osc.start(t0); osc.stop(t0 + dur + 0.02);
    } catch { /* ignore */ }
  }

  function noise(dur, vol, filterFreq, when = 0) {
    if (!audio.ready || audio.muted) return;
    try {
      const t0 = audio.ctx.currentTime + when;
      const len = Math.max(1, Math.floor(audio.ctx.sampleRate * dur));
      const buf = audio.ctx.createBuffer(1, len, audio.ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = audio.ctx.createBufferSource();
      src.buffer = buf;
      const filt = audio.ctx.createBiquadFilter();
      filt.type = 'lowpass'; filt.frequency.value = filterFreq || 1200;
      const g = audio.ctx.createGain();
      g.gain.setValueAtTime(vol || 0.4, t0);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
      src.connect(filt); filt.connect(g); g.connect(audio.sfxGain);
      src.start(t0);
    } catch { /* ignore */ }
  }

  audio.shoot = () => { noise(0.12, 0.5, 2600); tone(180, 0.08, 'square', 0.25, 0, 60); };
  audio.punch = () => { noise(0.08, 0.35, 500); tone(90, 0.1, 'sine', 0.3, 0, 45); };
  audio.explosion = () => { noise(0.7, 0.8, 400); tone(120, 0.6, 'sine', 0.5, 0, 30); };
  audio.pickup = () => { tone(660, 0.09, 'sine', 0.25); tone(990, 0.14, 'sine', 0.25, 0.09); };
  audio.cash = () => { tone(880, 0.08, 'triangle', 0.3); tone(1174, 0.08, 'triangle', 0.3, 0.08); tone(1568, 0.16, 'triangle', 0.3, 0.16); };
  audio.horn = () => { tone(370, 0.25, 'square', 0.18); tone(466, 0.25, 'square', 0.18); };
  audio.click = () => { tone(1200, 0.05, 'square', 0.15); };
  audio.busted = () => { tone(440, 0.2, 'sawtooth', 0.3, 0, 220); tone(330, 0.3, 'sawtooth', 0.3, 0.2, 165); };
  audio.missionDone = () => { [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.18, 'triangle', 0.3, i * 0.11)); };
  audio.fail = () => { tone(220, 0.3, 'sawtooth', 0.25, 0, 110); };

  // Continuous engine hum while driving; call every frame with speed 0..1.
  audio.engine = (speed01, on) => {
    if (!audio.ready) return;
    try {
      if (on && !audio.engineOsc) {
        audio.engineOsc = audio.ctx.createOscillator();
        audio.engineOsc.type = 'sawtooth';
        audio.engineGain = audio.ctx.createGain();
        audio.engineGain.gain.value = 0.0;
        const filt = audio.ctx.createBiquadFilter();
        filt.type = 'lowpass'; filt.frequency.value = 700;
        audio.engineOsc.connect(filt); filt.connect(audio.engineGain); audio.engineGain.connect(audio.master);
        audio.engineOsc.start();
      }
      if (audio.engineOsc) {
        const target = on && !audio.muted ? 0.05 + speed01 * 0.06 : 0;
        audio.engineGain.gain.setTargetAtTime(target, audio.ctx.currentTime, 0.1);
        audio.engineOsc.frequency.setTargetAtTime(55 + speed01 * 130, audio.ctx.currentTime, 0.08);
      }
    } catch { /* ignore */ }
  };

  // Two-tone police siren, distance-attenuated; call every frame.
  audio.siren = (active, distance01) => {
    if (!audio.ready) return;
    try {
      if (active && !audio.sirenOsc) {
        audio.sirenOsc = audio.ctx.createOscillator();
        audio.sirenOsc.type = 'sine';
        audio.sirenGain = audio.ctx.createGain();
        audio.sirenGain.gain.value = 0;
        audio.sirenOsc.connect(audio.sirenGain); audio.sirenGain.connect(audio.master);
        audio.sirenOsc.start();
      }
      if (audio.sirenOsc) {
        const vol = active && !audio.muted ? 0.05 * (1 - distance01) : 0;
        audio.sirenGain.gain.setTargetAtTime(vol, audio.ctx.currentTime, 0.2);
        audio.sirenTimer += 1 / 60;
        const f = Math.sin(audio.sirenTimer * 4.4) > 0 ? 750 : 980;
        audio.sirenOsc.frequency.setTargetAtTime(f, audio.ctx.currentTime, 0.05);
      }
    } catch { /* ignore */ }
  };

  // --- Procedural radio: three stations, 8-step loops, scheduled ahead.
  // Station 0 "Bay FM" — mellow synthwave; 1 "Neon 102" — driving bass;
  // 2 "Solmar Talk" — sparse lo-fi plucks. Frequencies are plain A-minor
  // patterns composed for this game, not any existing song.
  const STATIONS = [
    { name: 'Bay FM 88.1', bpm: 96, bass: [55, 0, 55, 0, 65.4, 0, 49, 0], lead: [220, 0, 261.6, 329.6, 0, 293.7, 261.6, 0] },
    { name: 'Neon 102', bpm: 128, bass: [55, 55, 0, 55, 65.4, 0, 55, 49], lead: [440, 0, 523.3, 0, 659.3, 0, 587.3, 523.3] },
    { name: 'Solmar Talk', bpm: 72, bass: [82.4, 0, 0, 0, 73.4, 0, 0, 0], lead: [330, 0, 0, 392, 0, 0, 370, 0] },
  ];
  audio.stationName = () => STATIONS[audio.station].name;
  audio.nextStation = () => { audio.station = (audio.station + 1) % STATIONS.length; audio.step = 0; };

  audio.musicTick = () => {
    if (!audio.ready || audio.muted) return;
    try {
      const st = STATIONS[audio.station];
      const stepDur = 60 / st.bpm / 2;
      while (audio.nextNoteAt < audio.ctx.currentTime + 0.25) {
        const i = audio.step % 8;
        const when = audio.nextNoteAt - audio.ctx.currentTime;
        const bass = st.bass[i];
        const lead = st.lead[i];
        if (bass) {
          const osc = audio.ctx.createOscillator(); const g = audio.ctx.createGain();
          osc.type = 'triangle'; osc.frequency.value = bass;
          g.gain.setValueAtTime(0.5, audio.ctx.currentTime + when);
          g.gain.exponentialRampToValueAtTime(0.001, audio.ctx.currentTime + when + stepDur * 1.8);
          osc.connect(g); g.connect(audio.musicGain);
          osc.start(audio.ctx.currentTime + when); osc.stop(audio.ctx.currentTime + when + stepDur * 2);
        }
        if (lead) {
          const osc = audio.ctx.createOscillator(); const g = audio.ctx.createGain();
          osc.type = 'square'; osc.frequency.value = lead;
          g.gain.setValueAtTime(0.12, audio.ctx.currentTime + when);
          g.gain.exponentialRampToValueAtTime(0.001, audio.ctx.currentTime + when + stepDur);
          osc.connect(g); g.connect(audio.musicGain);
          osc.start(audio.ctx.currentTime + when); osc.stop(audio.ctx.currentTime + when + stepDur);
        }
        audio.step += 1;
        audio.nextNoteAt += stepDur;
      }
    } catch { /* ignore */ }
  };

  return audio;
}
