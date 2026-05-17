from __future__ import annotations

import math
import wave
from pathlib import Path

import numpy as np


SAMPLE_RATE = 44_100


def _sine(freq: float, t: np.ndarray) -> np.ndarray:
    return np.sin(2 * math.pi * freq * t)


def _envelope(length: int, attack: float = 0.04, release: float = 0.12) -> np.ndarray:
    env = np.ones(length, dtype=np.float32)
    attack_n = max(1, int(length * attack))
    release_n = max(1, int(length * release))
    env[:attack_n] = np.linspace(0, 1, attack_n)
    env[-release_n:] = np.linspace(1, 0, release_n)
    return env


def render_audio(output_path: Path, duration: float = 30.0) -> None:
    """Create an original soft synth bed for the promo video."""
    total = int(SAMPLE_RATE * duration)
    timeline = np.arange(total, dtype=np.float32) / SAMPLE_RATE
    audio = np.zeros(total, dtype=np.float32)

    chords = [
        (0.0, 6.0, [130.81, 196.00, 261.63, 392.00]),
        (6.0, 12.0, [146.83, 220.00, 293.66, 440.00]),
        (12.0, 18.0, [164.81, 246.94, 329.63, 493.88]),
        (18.0, 24.0, [196.00, 293.66, 392.00, 587.33]),
        (24.0, 30.0, [174.61, 261.63, 349.23, 523.25]),
    ]

    for start, end, freqs in chords:
        start_i = int(start * SAMPLE_RATE)
        end_i = int(end * SAMPLE_RATE)
        local_t = timeline[start_i:end_i] - start
        chord = np.zeros(end_i - start_i, dtype=np.float32)
        for index, freq in enumerate(freqs):
            chord += _sine(freq, local_t) * (0.16 / (index + 1))
            chord += _sine(freq * 2.0, local_t) * (0.025 / (index + 1))
        chord *= _envelope(len(chord), attack=0.08, release=0.18)
        audio[start_i:end_i] += chord

    beat_every = int(SAMPLE_RATE * 0.75)
    for beat in range(0, total, beat_every):
        length = int(SAMPLE_RATE * 0.09)
        end = min(total, beat + length)
        local_t = np.arange(end - beat, dtype=np.float32) / SAMPLE_RATE
        click = _sine(880, local_t) * np.exp(-local_t * 34)
        audio[beat:end] += click.astype(np.float32) * 0.055

    shimmer = (_sine(1760, timeline) + _sine(2349.32, timeline)) * 0.012
    shimmer *= 0.5 + 0.5 * np.sin(2 * math.pi * timeline / 8)
    audio += shimmer.astype(np.float32)

    fade = np.ones(total, dtype=np.float32)
    fade[: SAMPLE_RATE] = np.linspace(0, 1, SAMPLE_RATE)
    fade[-SAMPLE_RATE:] = np.linspace(1, 0, SAMPLE_RATE)
    audio *= fade
    audio = np.tanh(audio * 1.5) * 0.78

    output_path.parent.mkdir(parents=True, exist_ok=True)
    pcm = np.int16(audio * 32767)
    with wave.open(str(output_path), "wb") as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(SAMPLE_RATE)
        wav.writeframes(pcm.tobytes())
