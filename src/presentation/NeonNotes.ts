// 空間ネオン音符＆音の繋がり演出：
// 打鍵した鍵盤から半透明ネオンの立体3D音符がふわりと浮かび上がり、
// 連続するメロディ音同士を光のカーブラインで結んで空間に旋律を描きます。
// すべて絶対時刻 t の純粋関数で計算するため、シーク・一時停止・MP4書き出しでも完全同期します。
import * as THREE from 'three';
import { keyOf } from '../core/keyboard';
import type { PerformanceNote } from '../core/types';

const LIFE = 3.4; // 音符が空間に漂う時間（秒）
const MAX_NOTES = 44;
const MAX_ARCS = 36;
const ARC_SEGS = 14;
const LINK_WINDOW = 0.85; // 音の繋がり線を結ぶ最大発音間隔（秒）

interface NoteSlot {
  group: THREE.Group;
  flag: THREE.Mesh;
  mat: THREE.MeshBasicMaterial;
  haloMat: THREE.MeshBasicMaterial;
}

interface ArcSlot {
  line: THREE.Line;
  posAttr: THREE.BufferAttribute;
  mat: THREE.LineBasicMaterial;
}

/** 音符の3Dメッシュ（楕円の符頭＋符幹＋旗＋柔らかい光輪） */
function createNoteMesh(): NoteSlot {
  const group = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({
    color: 0x7eeaf3,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });

  // 符頭（少し傾いた楕円体）
  const headGeo = new THREE.SphereGeometry(0.011, 12, 10);
  headGeo.scale(1.25, 0.86, 0.55);
  const head = new THREE.Mesh(headGeo, mat);
  head.rotation.z = 0.35;
  group.add(head);

  // 符幹
  const stemGeo = new THREE.CylinderGeometry(0.0017, 0.0017, 0.048, 6);
  const stem = new THREE.Mesh(stemGeo, mat);
  stem.position.set(0.011, 0.024, 0);
  group.add(stem);

  // 8分音符の旗（カーブしたチューブ）
  const flagCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.011, 0.047, 0),
    new THREE.Vector3(0.024, 0.036, 0.003),
    new THREE.Vector3(0.026, 0.018, 0),
    new THREE.Vector3(0.019, 0.010, -0.002),
  ]);
  const flagGeo = new THREE.TubeGeometry(flagCurve, 10, 0.0021, 5, false);
  const flag = new THREE.Mesh(flagGeo, mat);
  group.add(flag);

  // 音符を包む淡いネオン光輪
  const haloMat = new THREE.MeshBasicMaterial({
    color: 0x7eeaf3,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const halo = new THREE.Mesh(new THREE.RingGeometry(0.014, 0.022, 16), haloMat);
  halo.position.set(0.004, 0.012, 0);
  group.add(halo);

  group.visible = false;
  return { group, flag, mat, haloMat };
}

function createArc(): ArcSlot {
  const arr = new Float32Array((ARC_SEGS + 1) * 3);
  const geo = new THREE.BufferGeometry();
  const posAttr = new THREE.BufferAttribute(arr, 3);
  geo.setAttribute('position', posAttr);
  const mat = new THREE.LineBasicMaterial({
    color: 0x7eeaf3,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const line = new THREE.Line(geo, mat);
  line.frustumCulled = false;
  line.visible = false;
  return { line, posAttr, mat };
}

/** 音符の現在時刻 t における3D空間座標を計算（決定論的） */
function notePosAt(n: PerformanceNote, age: number, out: THREE.Vector3): THREE.Vector3 {
  const kg = keyOf(n.midi);
  const phase = n.id * 1.6180339 + n.midi * 0.37;
  const rise = 0.04 + age * 0.23 + 0.06 * Math.sin(age * 1.4 + phase) * Math.min(1, age);
  const swayX = Math.sin(age * 1.7 + phase) * 0.045 * Math.min(1, age * 0.9);
  const driftZ = (kg.black ? -0.025 : 0.015) - age * 0.065 + Math.cos(age * 1.3 + phase) * 0.04 * Math.min(1, age);
  return out.set(kg.x + swayX, rise, driftZ);
}

const COLOR_RH = new THREE.Color(0x6ef2ff); // 右手：シアンネオン
const COLOR_LH = new THREE.Color(0xffc876); // 左手：ウォームゴールドネオン
const COLOR_HIGH = new THREE.Color(0xd29bff); // 高音域アクセント：バイオレットネオン

export class NeonNotes {
  readonly root = new THREE.Group();
  private slots: NoteSlot[] = [];
  private arcs: ArcSlot[] = [];
  private tmpA = new THREE.Vector3();
  private tmpB = new THREE.Vector3();
  private tmpC = new THREE.Vector3();
  private tmpCol = new THREE.Color();

  constructor() {
    this.root.name = 'NeonNotes';
    for (let i = 0; i < MAX_NOTES; i++) {
      const s = createNoteMesh();
      this.slots.push(s);
      this.root.add(s.group);
    }
    for (let i = 0; i < MAX_ARCS; i++) {
      const a = createArc();
      this.arcs.push(a);
      this.root.add(a.line);
    }
  }

  /**
   * 絶対時刻 t の状態を描画に反映する。
   * notes は start 昇順の配列（Performance.notes）。
   */
  update(t: number, notes: readonly PerformanceNote[] | null, enabled: boolean, intensity: number) {
    if (!enabled || intensity <= 0.001 || !notes || !notes.length) {
      this.root.visible = false;
      return;
    }
    this.root.visible = true;

    // 二分探索で t - LIFE 以降の最初の音符を探す
    const tMin = t - LIFE;
    let lo = 0;
    let hi = notes.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (notes[mid].start < tMin) lo = mid + 1;
      else hi = mid;
    }

    // 範囲内の音符を収集（新しいものを優先して MAX_NOTES 件まで）
    const active: PerformanceNote[] = [];
    for (let i = lo; i < notes.length; i++) {
      const n = notes[i];
      if (n.start > t) break;
      active.push(n);
    }
    const startIdx = Math.max(0, active.length - MAX_NOTES);
    const shown = active.slice(startIdx);

    // 立体音符の更新
    for (let i = 0; i < MAX_NOTES; i++) {
      const slot = this.slots[i];
      if (i >= shown.length) {
        slot.group.visible = false;
        continue;
      }
      const n = shown[i];
      const age = Math.max(0, t - n.start);
      const u = age / LIFE;
      if (u >= 1) {
        slot.group.visible = false;
        continue;
      }

      slot.group.visible = true;
      notePosAt(n, age, slot.group.position);

      // 出現時のポップ＋ゆっくり回転
      const pop = Math.min(1, age / 0.12);
      const fade = Math.pow(1 - u, 1.45);
      const velScale = 0.78 + 0.45 * n.velocity;
      const sc = (0.65 + 0.35 * pop) * velScale * (1 + 0.15 * u);
      slot.group.scale.setScalar(sc);
      slot.group.rotation.y = Math.sin(age * 1.1 + n.id * 0.7) * 0.42;
      slot.group.rotation.z = Math.cos(age * 0.9 + n.id * 0.5) * 0.14;

      // 短い音は8分音符（旗あり）、長い音は4分音符（旗なし）
      slot.flag.visible = n.end - n.start < 0.42;

      // 手と音域でネオンカラーをブレンド
      this.tmpCol.copy(n.hand === 'R' ? COLOR_RH : COLOR_LH);
      if (n.midi > 76) this.tmpCol.lerp(COLOR_HIGH, Math.min(0.65, (n.midi - 76) / 22));
      slot.mat.color.copy(this.tmpCol);
      slot.mat.opacity = Math.min(0.88, fade * pop * (0.42 + 0.38 * n.velocity) * intensity);

      slot.haloMat.color.copy(this.tmpCol);
      slot.haloMat.opacity = slot.mat.opacity * 0.32;
    }

    // 音の繋がる表現（同じ手の連続する音符同士を滑らかな3Dカーブで結ぶ）
    let arcIdx = 0;
    const lastByHand: Record<'L' | 'R', PerformanceNote | null> = { L: null, R: null };
    for (const n of shown) {
      const prev = lastByHand[n.hand];
      lastByHand[n.hand] = n;
      if (!prev || arcIdx >= MAX_ARCS) continue;
      const dt = n.start - prev.start;
      if (dt <= 0.015 || dt > LINK_WINDOW) continue;

      const ageA = Math.max(0, t - prev.start);
      const ageB = Math.max(0, t - n.start);
      const fade = Math.pow(1 - Math.max(ageA, ageB) / LIFE, 1.5);
      if (fade <= 0.01) continue;

      const a = notePosAt(prev, ageA, this.tmpA);
      const b = notePosAt(n, ageB, this.tmpB);
      // 2音の中間を少し上・手前に膨らませたベジェ制御点
      const dist = a.distanceTo(b);
      this.tmpC.addVectors(a, b).multiplyScalar(0.5);
      this.tmpC.y += 0.045 + Math.min(0.14, dist * 0.25);
      this.tmpC.z += 0.03 * Math.sin(n.id * 1.1);

      const slot = this.arcs[arcIdx++];
      slot.line.visible = true;
      const arr = slot.posAttr.array as Float32Array;
      for (let k = 0; k <= ARC_SEGS; k++) {
        const s = k / ARC_SEGS;
        const inv = 1 - s;
        // 二次ベジェ補間
        arr[k * 3] = inv * inv * a.x + 2 * inv * s * this.tmpC.x + s * s * b.x;
        arr[k * 3 + 1] = inv * inv * a.y + 2 * inv * s * this.tmpC.y + s * s * b.y;
        arr[k * 3 + 2] = inv * inv * a.z + 2 * inv * s * this.tmpC.z + s * s * b.z;
      }
      slot.posAttr.needsUpdate = true;

      this.tmpCol.copy(n.hand === 'R' ? COLOR_RH : COLOR_LH);
      slot.mat.color.copy(this.tmpCol);
      slot.mat.opacity = Math.min(0.75, fade * 0.48 * intensity);
    }

    for (let i = arcIdx; i < MAX_ARCS; i++) {
      this.arcs[i].line.visible = false;
    }
  }
}
