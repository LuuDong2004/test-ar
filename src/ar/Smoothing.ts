import { Quaternion, Vector3 } from 'three';

/**
 * Motion smoothing layer.
 *
 * Hand-landmark output is noisy: per-frame jitter plus the occasional spike.
 * Naive lerp trades jitter for lag. We use a One-Euro filter (Casiez et al.)
 * which adapts its cutoff to speed — heavy smoothing when the wrist is still,
 * low lag when it moves fast — for translation, and shortest-path slerp with an
 * adaptive factor for rotation. This is what makes the watch feel "premium"
 * instead of either swimming or trailing the hand.
 */

/** Scalar One-Euro filter. */
class OneEuroScalar {
  private xPrev: number | null = null;
  private dxPrev = 0;
  private readonly minCutoff: number;
  private readonly beta: number;
  private readonly dCutoff: number;

  constructor(minCutoff = 1.2, beta = 0.02, dCutoff = 1.0) {
    this.minCutoff = minCutoff;
    this.beta = beta;
    this.dCutoff = dCutoff;
  }

  private static alpha(cutoff: number, dt: number): number {
    const tau = 1 / (2 * Math.PI * cutoff);
    return 1 / (1 + tau / dt);
  }

  filter(x: number, dt: number): number {
    if (this.xPrev === null || !Number.isFinite(dt) || dt <= 0) {
      this.xPrev = x;
      this.dxPrev = 0;
      return x;
    }
    const dx = (x - this.xPrev) / dt;
    const aD = OneEuroScalar.alpha(this.dCutoff, dt);
    const dxHat = aD * dx + (1 - aD) * this.dxPrev;

    const cutoff = this.minCutoff + this.beta * Math.abs(dxHat);
    const a = OneEuroScalar.alpha(cutoff, dt);
    const xHat = a * x + (1 - a) * this.xPrev;

    this.xPrev = xHat;
    this.dxPrev = dxHat;
    return xHat;
  }

  reset() {
    this.xPrev = null;
    this.dxPrev = 0;
  }
}

/** One-Euro filter over a Vector3 (independent per-axis). */
export class Vector3Smoother {
  private readonly fx: OneEuroScalar;
  private readonly fy: OneEuroScalar;
  private readonly fz: OneEuroScalar;
  readonly value = new Vector3();
  private initialized = false;

  constructor(minCutoff = 1.4, beta = 0.03, dCutoff = 1.0) {
    this.fx = new OneEuroScalar(minCutoff, beta, dCutoff);
    this.fy = new OneEuroScalar(minCutoff, beta, dCutoff);
    this.fz = new OneEuroScalar(minCutoff, beta, dCutoff);
  }

  update(target: Vector3, dt: number): Vector3 {
    if (!this.initialized) {
      this.value.copy(target);
      this.initialized = true;
    }
    this.value.set(
      this.fx.filter(target.x, dt),
      this.fy.filter(target.y, dt),
      this.fz.filter(target.z, dt),
    );
    return this.value;
  }

  reset() {
    this.fx.reset();
    this.fy.reset();
    this.fz.reset();
    this.initialized = false;
  }
}

/**
 * Adaptive quaternion smoother. Uses slerp with shortest-path correction and a
 * speed-adaptive factor so fast turns track tightly while slow drift is damped.
 */
export class QuaternionSmoother {
  readonly value = new Quaternion();
  private initialized = false;
  private readonly baseFactor: number;
  private readonly speedGain: number;

  constructor(baseFactor = 0.25, speedGain = 1.8) {
    this.baseFactor = baseFactor;
    this.speedGain = speedGain;
  }

  update(target: Quaternion, dt: number): Quaternion {
    if (!this.initialized) {
      this.value.copy(target);
      this.initialized = true;
      return this.value;
    }
    // Shortest-path: flip target if it is on the opposite hemisphere.
    if (this.value.dot(target) < 0) {
      target.set(-target.x, -target.y, -target.z, -target.w);
    }
    // Angular distance drives how aggressively we follow.
    const dot = Math.min(1, Math.abs(this.value.dot(target)));
    const angle = 2 * Math.acos(dot); // radians between orientations
    const dtScale = Math.min(1, (dt > 0 ? dt : 1 / 60) * 60);
    let factor = (this.baseFactor + this.speedGain * angle) * dtScale;
    factor = Math.max(0, Math.min(1, factor));
    this.value.slerp(target, factor);
    return this.value;
  }

  reset() {
    this.initialized = false;
    this.value.identity();
  }
}

/** Exponential scalar smoother for things like scale. */
export class ScalarSmoother {
  private value: number | null = null;
  private readonly factor: number;

  constructor(factor = 0.2) {
    this.factor = factor;
  }

  update(target: number, dt: number): number {
    if (this.value === null) {
      this.value = target;
      return target;
    }
    const a = Math.min(1, this.factor * Math.min(1, (dt > 0 ? dt : 1 / 60) * 60));
    this.value += (target - this.value) * a;
    return this.value;
  }

  reset() {
    this.value = null;
  }
}
