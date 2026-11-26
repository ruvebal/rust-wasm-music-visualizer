// Pure analysis helpers. Computed readings; normalization multipliers are Designed.
export const clamp = (value, min = 0, max = 1) => Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : min;
export const silence = () => ({ rms: 0, bass: 0, mid: 0, high: 0 });

// Bin i represents i * sampleRate / fftSize Hz. Sum linear power, not dB.
function bandEnergy(spectrum, sampleRate, fftSize, lowHz, highHz) {
  const binHz = sampleRate / fftSize;
  const first = Math.max(1, Math.ceil(lowHz / binHz));
  const last = Math.min(spectrum.length - 1, Math.floor(highHz / binHz));
  let power = 0;
  for (let i = first; i <= last; i++) {
    if (Number.isFinite(spectrum[i])) power += 10 ** (Math.min(0, spectrum[i]) / 10);
  }
  return clamp(Math.sqrt(power) * 2);
}

export function extractFeatures(waveform, spectrum, sampleRate, fftSize) {
  if (!waveform.length || !spectrum.length || !Number.isFinite(sampleRate) || sampleRate <= 0 || !Number.isFinite(fftSize) || fftSize <= 0) return silence();
  let squares = 0;
  for (const sample of waveform) squares += (Number.isFinite(sample) ? clamp(sample, -1, 1) : 0) ** 2;
  const rms = clamp(Math.sqrt(squares / waveform.length) * 2);
  // Silence gate suppresses residual FFT history and near-zero noise.
  if (rms < 0.002) return silence();
  return {
    rms,
    bass: bandEnergy(spectrum, sampleRate, fftSize, 35, 250),
    mid: bandEnergy(spectrum, sampleRate, fftSize, 250, 2000),
    high: bandEnergy(spectrum, sampleRate, fftSize, 2000, 10000),
  };
}

export function formatTime(seconds) {
  const value = Math.floor(clamp(seconds, 0, Number.MAX_SAFE_INTEGER));
  return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, '0')}`;
}
