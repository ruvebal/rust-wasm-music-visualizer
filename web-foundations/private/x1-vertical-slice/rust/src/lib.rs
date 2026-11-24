//! Small, dependency-free Rust/Wasm signal mapper for the X1 vertical slice.
//! The browser owns Web Audio and rendering; this module owns smoothing and mapping state.

static mut GAIN: f32 = 1.0;
static mut SMOOTHING: f32 = 0.18;
static mut LEVEL: f32 = 0.0;

#[unsafe(no_mangle)]
pub extern "C" fn set_gain(value: f32) {
    unsafe { GAIN = value.clamp(0.1, 3.0); }
}

#[unsafe(no_mangle)]
pub extern "C" fn set_smoothing(value: f32) {
    unsafe { SMOOTHING = value.clamp(0.01, 0.9); }
}

#[unsafe(no_mangle)]
pub extern "C" fn reset() {
    unsafe { LEVEL = 0.0; }
}

/// Returns a bounded, smoothed scale for the current audio level.
#[unsafe(no_mangle)]
pub extern "C" fn step(rms: f32, bass: f32, elapsed_seconds: f32) -> f32 {
    let input = (rms * 0.55 + bass * 0.45).clamp(0.0, 1.0);
    let wave = (elapsed_seconds * 1.7).sin() * 0.035;
    unsafe {
        LEVEL += (input - LEVEL) * SMOOTHING;
        (1.0 + LEVEL * GAIN * 1.8 + wave).clamp(0.78, 3.6)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn silence_is_finite_and_bounded() {
        reset();
        let value = step(0.0, 0.0, 0.0);
        assert!(value.is_finite());
        assert!((0.78..=3.6).contains(&value));
    }

    #[test]
    fn smoothing_rises_without_overshoot() {
        reset();
        set_gain(1.0);
        set_smoothing(0.2);
        let first = step(1.0, 1.0, 0.0);
        let second = step(1.0, 1.0, 0.0);
        assert!(second > first);
        assert!(second <= 2.0);
    }

    #[test]
    fn gain_is_clamped() {
        set_gain(100.0);
        reset();
        let value = step(1.0, 1.0, 0.0);
        assert!(value > 1.0);
        assert!(value <= 3.6);
    }
}
