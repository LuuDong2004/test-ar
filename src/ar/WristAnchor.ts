import { Camera, Matrix4, Quaternion, Vector3 } from 'three';
import { HandFrame, LM } from './HandTracker';

/**
 * Wrist Anchor System.
 *
 * Turns a frame of hand landmarks into a stable 3D pose (position, orientation,
 * scale) for the watch, expressed in Three.js world space.
 *
 * Design:
 *  - POSITION is solved on a screen-aligned plane (z = 0) by unprojecting the
 *    wrist image coordinate through the live camera. This keeps the watch glued
 *    to the wrist pixel-for-pixel, no depth calibration needed.
 *  - ORIENTATION is solved from MediaPipe WORLD landmarks (metric 3D), building
 *    an orthonormal basis from the real forearm axis and the real back-of-hand
 *    normal. Because world landmarks preserve the true 3D shape, the watch
 *    follows the actual wrist roll (showing its side/back when you turn the
 *    wrist) instead of collapsing to an edge-on sliver — and it never gets noisy
 *    the way the raw 2.5D image-z does. Falls back to a camera-facing constraint
 *    when world landmarks are unavailable or degenerate.
 *  - SCALE is rotation-invariant: it takes the larger of the across-wrist span
 *    and the (foreshorten-resistant) hand length, so it does not shrink to a
 *    sliver when the wrist rolls or the hand makes a fist.
 */

export interface WristPose {
  position: Vector3;
  quaternion: Quaternion;
  /** World-space wrist width — drives dynamic scaling. */
  scale: number;
  valid: boolean;
}

export function createWristPose(): WristPose {
  return {
    position: new Vector3(),
    quaternion: new Quaternion(),
    scale: 1,
    valid: false,
  };
}

export interface AnchorOptions {
  /** True when the video is mirrored (front/selfie camera). */
  mirrored: boolean;
  /** How far down the forearm to seat the watch, in wrist-widths. */
  forearmOffset: number;
  /** Flip the dial to the other side of the wrist (corrects the sign if needed). */
  flipDial: boolean;
}

export class WristAnchor {
  // Scratch objects — reused every frame to avoid per-frame allocations.
  private readonly w3 = new Vector3();
  private readonly m3 = new Vector3();
  private readonly i3 = new Vector3();
  private readonly p3 = new Vector3();
  private readonly across = new Vector3();
  private readonly toHand = new Vector3();
  private readonly xAxis = new Vector3();
  private readonly yAxis = new Vector3();
  private readonly zAxis = new Vector3();
  private readonly basis = new Matrix4();

  private readonly wristPlane = new Vector3();
  private readonly indexPlane = new Vector3();
  private readonly pinkyPlane = new Vector3();
  private readonly middlePlane = new Vector3();
  private readonly forearmDir = new Vector3();

  private readonly ray = new Vector3();
  private readonly camPos = new Vector3();

  /** Hand length → wrist width ratio, for the rotation-robust scale floor. */
  private static readonly HAND_LEN_TO_WRIST = 0.68;

  /**
   * Convert a normalized image coordinate to a world point on the z = 0 plane
   * by unprojecting through the active camera.
   */
  private screenToPlane(nx: number, ny: number, camera: Camera, mirrored: boolean, out: Vector3) {
    const ndcX = (mirrored ? 1 - nx : nx) * 2 - 1;
    const ndcY = 1 - ny * 2; // image y is top-down; NDC y is bottom-up
    this.ray.set(ndcX, ndcY, 0.5).unproject(camera);
    camera.getWorldPosition(this.camPos);
    this.ray.sub(this.camPos); // ray direction from camera
    // Intersect the plane z = 0:  camPos + t * dir, solve dir.z * t = -camPos.z
    const denom = Math.abs(this.ray.z) < 1e-6 ? 1e-6 : this.ray.z;
    const t = -this.camPos.z / denom;
    out.copy(this.ray).multiplyScalar(t).add(this.camPos);
    out.z = 0;
  }

  /** Convert a landmark to a sign-corrected 3D vector for orientation math. */
  private to3D(lm: { x: number; y: number; z: number }, mirrored: boolean, out: Vector3) {
    out.set(mirrored ? -lm.x : lm.x, -lm.y, -lm.z);
  }

  /**
   * Solve the wrist pose. Returns false (and leaves out.valid = false) when the
   * frame is unusable.
   */
  compute(frame: HandFrame, camera: Camera, options: AnchorOptions, out: WristPose): boolean {
    out.valid = false;
    if (!frame.present || frame.landmarks.length < 21) return false;

    const wrist = frame.landmarks[LM.WRIST];
    const index = frame.landmarks[LM.INDEX_MCP];
    const pinky = frame.landmarks[LM.PINKY_MCP];
    const middle = frame.landmarks[LM.MIDDLE_MCP];
    if (!wrist || !index || !pinky || !middle) return false;

    const { mirrored, forearmOffset, flipDial } = options;

    // ---- Orientation: real wrist basis from METRIC world landmarks --------
    const world = frame.worldLandmarks;
    const haveWorld =
      !!world &&
      world.length >= 21 &&
      !!world[LM.WRIST] &&
      !!world[LM.INDEX_MCP] &&
      !!world[LM.PINKY_MCP] &&
      !!world[LM.MIDDLE_MCP];

    // Prefer world landmarks (metric, rotation-faithful) for orientation; fall
    // back to the noisy image landmarks only if world data is missing.
    const oW = haveWorld ? world[LM.WRIST] : wrist;
    const oI = haveWorld ? world[LM.INDEX_MCP] : index;
    const oP = haveWorld ? world[LM.PINKY_MCP] : pinky;
    const oM = haveWorld ? world[LM.MIDDLE_MCP] : middle;

    this.to3D(oW, mirrored, this.w3);
    this.to3D(oM, mirrored, this.m3);
    this.to3D(oI, mirrored, this.i3);
    this.to3D(oP, mirrored, this.p3);

    // Forearm axis (watch 12–6 runs along it).
    this.toHand.copy(this.m3).sub(this.w3);
    if (this.toHand.lengthSq() < 1e-8) return false;
    this.zAxis.copy(this.toHand).normalize();

    // Across-wrist vector (pinky→index), made perpendicular to the forearm.
    this.across.copy(this.p3).sub(this.i3);
    this.across.addScaledVector(this.zAxis, -this.across.dot(this.zAxis));

    let oriented = false;
    if (haveWorld && this.across.lengthSq() > 1e-7) {
      this.across.normalize();
      // Real back-of-hand normal. Built from the metric hand plane, its sign
      // flips on its own as the wrist rolls, so the watch faithfully shows its
      // dial, side or caseback instead of being forced flat to the camera.
      this.yAxis.copy(this.across).cross(this.zAxis).normalize();
      // Base convention: point the normal out of the BACK of the hand (where the
      // watch sits) from handedness + mirroring. flipDial corrects any residual.
      let sign = frame.handedness === 'Left' ? -1 : 1;
      if (mirrored) sign = -sign;
      this.yAxis.multiplyScalar(sign);
      if (this.yAxis.lengthSq() > 1e-7) oriented = true;
    }

    if (!oriented) {
      // Fallback: dial faces the camera (camDir = +Z), perpendicular to forearm.
      const zz = this.zAxis.z;
      this.yAxis.set(-this.zAxis.x * zz, -this.zAxis.y * zz, 1 - zz * zz);
      if (this.yAxis.lengthSq() < 1e-6) {
        const zy = this.zAxis.y;
        this.yAxis.set(-this.zAxis.x * zy, 1 - zy * zy, -this.zAxis.z * zy);
      }
      this.yAxis.normalize();
    }
    if (flipDial) this.yAxis.negate(); // manual dial/caseback swap if inverted

    // Across-wrist axis completes a right-handed basis: x = y × z.
    this.xAxis.copy(this.yAxis).cross(this.zAxis).normalize();
    this.basis.makeBasis(this.xAxis, this.yAxis, this.zAxis);
    out.quaternion.setFromRotationMatrix(this.basis);

    // ---- Position (screen plane, pixel-locked to the wrist) ---------------
    this.screenToPlane(wrist.x, wrist.y, camera, mirrored, this.wristPlane);
    this.screenToPlane(index.x, index.y, camera, mirrored, this.indexPlane);
    this.screenToPlane(pinky.x, pinky.y, camera, mirrored, this.pinkyPlane);
    this.screenToPlane(middle.x, middle.y, camera, mirrored, this.middlePlane);

    // ---- Scale (rotation-invariant) --------------------------------------
    // The across-knuckle span foreshortens when the wrist rolls (palm to camera)
    // or the hand makes a fist; the hand length barely does. Take the larger so
    // the watch keeps a steady, sensible size through both — no more shrinking to
    // a sliver — while staying calibrated to the wrist width when the hand lies
    // flat (both measures agree there).
    const acrossSpan = this.indexPlane.distanceTo(this.pinkyPlane);
    const handLen = this.wristPlane.distanceTo(this.middlePlane);
    const wristWidth = Math.max(acrossSpan, handLen * WristAnchor.HAND_LEN_TO_WRIST);
    if (!Number.isFinite(wristWidth) || wristWidth < 1e-5) return false;

    // Seat the watch a little down the forearm (toward the elbow, behind the
    // wrist crease) so it sits where a watch is actually worn.
    this.forearmDir.copy(this.wristPlane).sub(this.middlePlane);
    this.forearmDir.z = 0;
    if (this.forearmDir.lengthSq() > 1e-8) this.forearmDir.normalize();
    else this.forearmDir.set(0, 0, 0);

    out.position
      .copy(this.wristPlane)
      .addScaledVector(this.forearmDir, wristWidth * forearmOffset);
    out.position.z = 0;

    out.scale = wristWidth;
    out.valid = true;
    return true;
  }
}
