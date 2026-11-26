// Small, explainable onset tracker for the teaching instrument. It estimates
// tempo from repeated low-frequency rises; it is not a studio-grade beat tracker.
export class BeatTracker {
  constructor() { this.reset(); }
  reset() {
    this.previous = 0;
    this.lastOnset = -Infinity;
    this.intervals = [];
    this.bpm = 0;
    this.pulse = 0;
  }
  update({ bass = 0, rms = 0, time = 0, delta = 0 }) {
    const now = Number.isFinite(time) ? time : 0;
    const rise = bass - this.previous;
    const interval = now - this.lastOnset;
    const threshold = Math.max(0.22, this.previous * 1.28 + 0.045);
    const onset = rms > 0.015 && bass > threshold && rise > 0.012 && interval >= 0.2;
    if (onset) {
      if (Number.isFinite(this.lastOnset)) {
        const seconds = now - this.lastOnset;
        if (seconds >= 0.25 && seconds <= 2) {
          this.intervals.push(seconds);
          if (this.intervals.length > 8) this.intervals.shift();
          const sorted = [...this.intervals].sort((a, b) => a - b);
          const median = sorted[Math.floor(sorted.length / 2)];
          this.bpm = Math.round(Math.min(220, Math.max(40, 60 / median)));
        }
      }
      this.lastOnset = now;
      this.pulse = 1;
    } else {
      this.pulse = Math.max(0, this.pulse - Math.max(0, delta) * 5);
    }
    this.previous = bass;
    return { bpm: this.bpm, beatPulse: this.pulse };
  }
}
