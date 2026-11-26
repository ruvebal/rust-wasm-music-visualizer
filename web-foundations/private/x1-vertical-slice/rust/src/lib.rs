//! Designed visual mappings, not a simulation of acoustic or orbital physics.
//! All state is explicit: the caller supplies the previous smoothed value.
//! No browser APIs, allocation, dependencies, or mutable global variables.

/// Keep a number in 0..=1. Treat NaN and infinity as silence instead of poisoning a scene.
fn unit(value: f32) -> f32 {
    if value.is_finite() {
        value.clamp(0.0, 1.0)
    } else {
        0.0
    }
}

/// Move `previous` toward `input` using seconds, not a percentage per frame.
/// `tau_seconds` is the time to close about 63% of the remaining distance.
/// A long background-tab gap is capped at 0.1 s; missing time is not replayed.
#[unsafe(no_mangle)]
pub extern "C" fn smooth(previous: f32, input: f32, delta_seconds: f32, tau_seconds: f32) -> f32 {
    let previous = unit(previous);
    let delta = if delta_seconds.is_finite() {
        delta_seconds.clamp(0.0, 0.1)
    } else {
        0.0
    };
    let tau = if tau_seconds.is_finite() {
        tau_seconds.clamp(0.08, 0.8)
    } else {
        0.22
    };
    let weight = 1.0 - (-delta / tau).exp();
    unit(previous + (unit(input) - previous) * weight)
}

/// RMS opens the sculpture's hinges from 0.12 to 1.22 radians (Designed).
#[unsafe(no_mangle)]
pub extern "C" fn aperture(rms: f32) -> f32 {
    0.12 + unit(rms) * 1.1
}

/// Bass scales the core from a 0.72 to 1.30 dimensionless multiplier (Designed).
#[unsafe(no_mangle)]
pub extern "C" fn core_scale(bass: f32) -> f32 {
    0.72 + unit(bass) * 0.58
}

/// High-band energy sets emissive intensity from 0.15 to 1.25 (Designed).
#[unsafe(no_mangle)]
pub extern "C" fn radiance(high: f32) -> f32 {
    0.15 + unit(high) * 1.1
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn hostile_inputs_stay_finite_and_bounded() {
        let inputs = [
            f32::NAN,
            f32::INFINITY,
            f32::NEG_INFINITY,
            -100.0,
            0.0,
            0.5,
            1.0,
            100.0,
        ];
        for input in inputs {
            assert!((0.12..=1.22).contains(&aperture(input)));
            assert!((0.72..=1.3).contains(&core_scale(input)));
            assert!((0.15..=1.25).contains(&radiance(input)));
            for previous in inputs {
                for delta in inputs {
                    for tau in inputs {
                        assert!((0.0..=1.0).contains(&smooth(previous, input, delta, tau)));
                    }
                }
            }
        }
    }

    fn replay(hz: u32) -> f32 {
        (0..hz).fold(0.0, |previous, _| {
            smooth(previous, 0.8, 1.0 / hz as f32, 0.22)
        })
    }

    #[test]
    fn same_duration_matches_across_refresh_rates() {
        assert!((replay(30) - replay(144)).abs() < 1e-5);
        assert_eq!(replay(60), replay(60));
    }

    #[test]
    fn silence_and_zero_time_are_stable() {
        assert_eq!(smooth(0.0, 0.0, 0.016, 0.22), 0.0);
        assert_eq!(smooth(0.4, 1.0, 0.0, 0.22), 0.4);
        assert_eq!(smooth(0.4, 1.0, f32::NAN, 0.22), 0.4);
    }

    #[test]
    fn smoothing_never_overshoots_and_channels_are_independent() {
        let first = smooth(0.0, 1.0, 0.016, 0.22);
        let second = smooth(first, 1.0, 0.016, 0.22);
        assert!(first > 0.0 && second > first && second < 1.0);
        assert_eq!(smooth(0.0, 0.0, 0.016, 0.22), 0.0);
        assert_eq!(first, smooth(0.0, 1.0, 0.016, 0.22));
        assert!(smooth(second, 0.0, 0.016, 0.22) < second);
    }
}
