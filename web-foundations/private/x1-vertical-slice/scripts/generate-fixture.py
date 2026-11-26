"""Rebuild the original studio test signal; no third-party recording or dependencies.
Designed: 12 seconds, bass / middle / high / blend / silence, at 24 kHz.
"""
import math
import struct
import wave
from pathlib import Path

rate = 24000
frames = bytearray()
for index in range(rate * 12):
    time = index / rate
    section = int(time // 2.4)
    local = time % 2.4
    envelope = min(1, local / 0.12, (2.4 - local) / 0.18)
    frequencies = ((100,), (660,), (4200,), (100, 660, 4200), ())[section]
    value = sum(math.sin(math.tau * hz * time) for hz in frequencies)
    value *= 0.34 * envelope / max(1, len(frequencies))
    frames.extend(struct.pack('<h', round(value * 32767)))
with wave.open(str(Path(__file__).resolve().parents[1] / 'public/audio/fixture-tone.wav'), 'wb') as output:
    output.setnchannels(1)
    output.setsampwidth(2)
    output.setframerate(rate)
    output.writeframes(frames)
