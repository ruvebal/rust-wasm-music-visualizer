import { clamp, extractFeatures, silence } from './features.js';

// One owner, one HTMLAudioElement, one graph. Replacing a file changes only src.
export class AudioTransport {
  constructor({ fixtureUrl, onChange = () => {}, onDiscontinuity = () => {} }) {
    this.audio = new Audio();
    this.audio.preload = 'metadata';
    this.fixtureUrl = fixtureUrl;
    this.onChange = onChange;
    this.onDiscontinuity = onDiscontinuity;
    this.gain = 0.7;
    this.muted = false;
    this.state = 'ready';
    this.name = 'Studio test tone';
    this.message = 'Test tone ready. Choose a local track or press Play.';
    this.pending = false;
    this.generation = 0;
    this.events = new AbortController();
    const listen = (type, fn) => this.audio.addEventListener(type, fn, { signal: this.events.signal });
    listen('loadedmetadata', () => this.notify());
    listen('timeupdate', () => this.notify());
    listen('playing', () => { this.state = 'playing'; this.message = `Playing ${this.name}`; this.notify(); });
    listen('waiting', () => { if (!this.audio.paused) { this.state = 'loading'; this.message = 'Buffering audio…'; this.notify(); } });
    listen('pause', () => { if (this.state === 'playing' || this.state === 'loading') { this.state = 'paused'; this.message = 'Paused'; this.notify(); } });
    listen('ended', () => { this.state = 'ended'; this.message = 'Track ended. Play to start again.'; this.notify(); });
    listen('error', () => {
      this.generation++;
      this.pending = false;
      this.state = 'error';
      this.message = 'Cannot decode this file. Choose another audio file or use the test tone.';
      this.notify();
    });
    listen('seeking', () => this.onDiscontinuity());
    this.audio.src = fixtureUrl;
  }

  notify() { if (!this.disposed) this.onChange(this); }
  get duration() { return Number.isFinite(this.audio.duration) ? this.audio.duration : 0; }
  get playing() { return !this.audio.paused && !this.audio.ended; }

  async prepare() {
    if (!this.context) {
      this.context = new AudioContext();
      this.source = this.context.createMediaElementSource(this.audio);
      this.volume = this.context.createGain();
      this.analyser = this.context.createAnalyser();
      this.analyser.fftSize = 2048;
      this.analyser.smoothingTimeConstant = 0; // Rust owns visible smoothing.
      this.waveform = new Float32Array(this.analyser.fftSize);
      this.spectrum = new Float32Array(this.analyser.frequencyBinCount);
      this.source.connect(this.volume).connect(this.analyser).connect(this.context.destination);
      this.volume.gain.value = this.muted ? 0 : this.gain;
    }
    await this.context.resume();
    if (this.context.state !== 'running') throw Error('Audio could not start. Press Play to retry.');
  }

  async toggle() {
    if (this.disposed) return;
    if (this.playing || this.pending) {
      this.generation++;
      this.pending = false;
      this.audio.pause();
      this.state = 'paused';
      this.message = 'Paused';
      this.notify();
      return;
    }
    const token = ++this.generation;
    this.pending = true;
    this.state = 'loading';
    this.message = 'Starting audio…';
    this.notify();
    try {
      await this.prepare();
      if (token !== this.generation || this.disposed) return;
      await this.audio.play();
    } catch (error) {
      if (token !== this.generation || this.disposed) return;
      this.state = 'error';
      this.message = `Audio unavailable: ${error.message}. Choose another file or retry Play.`;
    } finally {
      if (token === this.generation) { this.pending = false; this.notify(); }
    }
  }

  loadFile(file) {
    if (!file) return false;
    const plausible = file.type.startsWith('audio/') || (!file.type && /\.(mp3|wav|ogg|m4a|aac|flac|opus|webm)$/i.test(file.name));
    if (!file.size || !plausible) {
      this.message = 'Choose a non-empty audio file (MP3, WAV, Ogg, M4A or FLAC).';
      this.notify();
      return false;
    }
    this.replace(URL.createObjectURL(file), file.name, true);
    return true;
  }

  replace(url, name, owned = false) {
    this.generation++;
    this.pending = false;
    this.audio.pause();
    const oldUrl = this.objectUrl;
    this.objectUrl = owned ? url : null;
    this.name = name;
    this.audio.src = url;
    this.audio.load();
    if (oldUrl) URL.revokeObjectURL(oldUrl);
    this.state = 'ready';
    this.message = `Ready: ${name}`;
    this.onDiscontinuity();
    this.notify();
  }

  useFixture() { this.replace(this.fixtureUrl, 'Studio test tone'); }
  setLoop(value) { this.audio.loop = Boolean(value); this.notify(); }
  setGain(value) { this.gain = clamp(value); this.applyGain(); }
  setMuted(value) { this.muted = Boolean(value); this.applyGain(); }
  applyGain() {
    if (this.volume) {
      // A short ramp avoids clicks when dragging gain or toggling mute.
      this.volume.gain.setTargetAtTime(this.muted ? 0 : this.gain, this.context.currentTime, 0.02);
    }
    this.notify();
  }
  seek(seconds) {
    if (!this.duration) return;
    this.audio.currentTime = clamp(seconds, 0, this.duration);
    this.onDiscontinuity();
    this.notify();
  }
  reset() {
    this.generation++;
    this.pending = false;
    this.audio.pause();
    this.seek(0);
    this.gain = 0.7;
    this.muted = false;
    this.audio.loop = false;
    this.state = this.audio.error ? 'error' : 'ready';
    this.message = this.audio.error ? 'Choose another audio file or use the test tone.' : 'Reset. Press Play when ready.';
    this.applyGain();
    this.onDiscontinuity();
  }
  features() {
    if (!this.analyser || !this.playing || this.audio.seeking || this.muted || this.gain === 0 || this.context.state !== 'running') return silence();
    this.analyser.getFloatTimeDomainData(this.waveform);
    this.analyser.getFloatFrequencyData(this.spectrum);
    return extractFeatures(this.waveform, this.spectrum, this.context.sampleRate, this.analyser.fftSize);
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.generation++;
    this.events.abort();
    this.audio.pause();
    this.audio.removeAttribute('src');
    this.audio.load();
    if (this.objectUrl) URL.revokeObjectURL(this.objectUrl);
    this.source?.disconnect();
    this.volume?.disconnect();
    this.analyser?.disconnect();
    this.context?.close().catch(() => {});
  }
}
