// 空間ネオン音符＆打鍵リップル＆旋律ライン演出（v3 優美・シャープ・楽譜連動版）：
// MIDIのテンポ・音価・発音間隔から「全/二分音符・四分音符・八分音符・十六分音符・スタッカート」を自動判定し、
// 鍵盤の打鍵点から広がる極細の光波紋と立ち上がり光糸を伴って立体音符が優美に昇ります。
import * as THREE from 'three';
import { keyOf } from '../core/keyboard';
import type { PerformanceNote } from '../core/types';

const LIFE = 3.1; // 音符が空間に漂う時間（秒）
const RIPPLE_LIFE = 0.55; // 鍵盤上の打鍵波紋の寿命（秒）
const THREAD_LIFE = 0.45; // 鍵盤から音符へ伸びる光糸の寿命（秒）
const MAX_NOTES = 48;
const MAX_ARCS = 38;
const ARC_SEGS = 16;
const LINK_WINDOW = 0.78;

interface TempoPoint {
  time: number;
  bpm: number;
}

interface NoteSlot {
  group: THREE.Group;
  solidHead: THREE.Mesh;
  hollowHead: THREE.Mesh;
  stem: THREE.Mesh;
  flag1: THREE.Mesh;
  flag2: THREE.Mesh;
  staccatoDot: THREE.Mesh;
  mat: THREE.MeshBasicMaterial;
  // 打鍵点から広がる鍵盤リップル
  ripple: THREE.Mesh;
  rippleMat: THREE.MeshBasicMaterial;
  // 鍵盤から音符へ立ち上がる極細の光糸
  thread: THREE.Line;
  threadPos: THREE.BufferAttribute;
  threadMat: THREE.LineBasicMaterial;
}

interface ArcSlot {
  line: THREE.Line;
  posAttr: THREE.BufferAttribute;
  mat: THREE.LineBasicMaterial;
}

/** クラシック楽譜のようにシャープで流麗なテーパー旗ジオメトリを作成 */
function createGracefulFlagGeometry(yOffset: number): THREE.BufferGeometry {
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.0076, 0.044 + yOffset, 0),
    new THREE.Vector3(0.0145, 0.038 + yOffset, 0.0012),
    new THREE.Vector3(0.0205, 0.029 + yOffset, 0.0018),
    new THREE.Vector3(0.0215, 0.019 + yOffset, 0.0005),
    new THREE.Vector3(0.0168, 0.012 + yOffset, -0.0008),
  ]);
  // 根本から先端へ向かってシャープに細くなるリボン状チューブ
  const segs = 16;
  const radSegs = 6;
  const geo = new THREE.TubeGeometry(curve, segs, 0.0014, radSegs, false);
  const pos = geo.attributes.position;
  const v = new THREE.Vector3();
  const c = new THREE.Vector3();
  for (let i = 0; i <= segs; i++) {
    const u = i / segs;
    curve.getPointAt(u, c);
    // 中腹をわずかに豊かに、先端を針のようにシャープに絞る
    const taper = Math.sin(u * Math.PI * 0.85 + 0.15) * (1 - 0.82 * u * u);
    for (let j = 0; j <= radSegs; j++) {
      const idx = i * (radSegs + 1) + j;
      v.fromBufferAttribute(pos, idx).sub(c).multiplyScalar(Math.max(0.12, taper)).add(c);
      pos.setXYZ(idx, v.x, v.y, v.z);
    }
  }
  geo.computeVertexNormals();
  return geo;
}

// 共有ジオメトリ（省メモリ＆高精細）
const SOLID_HEAD_GEO = (() => {
  const g = new THREE.SphereGeometry(0.0078, 16, 12);
  g.scale(1.32, 0.78, 0.36); // シャープで薄く優美な斜め楕円
  return g;
})();

const HOLLOW_HEAD_GEO = (() => {
  // 二分音符・全音符用の繊細な中空楕円リング
  const g = new THREE.TorusGeometry(0.0072, 0.00135, 10, 24);
  g.scale(1.28, 0.76, 0.55);
  return g;
})();

const STEM_GEO = new THREE.CylinderGeometry(0.00085, 0.00095, 0.044, 6);
const FLAG1_GEO = createGracefulFlagGeometry(0);
const FLAG2_GEO = createGracefulFlagGeometry(-0.0095);
const STACCATO_GEO = new THREE.SphereGeometry(0.0021, 8, 8);
const RIPPLE_GEO = new THREE.RingGeometry(0.009, 0.0112, 28);

function createNoteSlot(): NoteSlot {
  const group = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({
    color: 0x9beeff,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });

  // 塗りつぶし符頭（四分・八分・十六分）
  const solidHead = new THREE.Mesh(SOLID_HEAD_GEO, mat);
  solidHead.rotation.z = 0.42;
  group.add(solidHead);

  // 白抜き符頭（二分・全音符）
  const hollowHead = new THREE.Mesh(HOLLOW_HEAD_GEO, mat);
  hollowHead.rotation.z = 0.42;
  group.add(hollowHead);

  // 極細の符幹
  const stem = new THREE.Mesh(STEM_GEO, mat);
  stem.position.set(0.0076, 0.022, 0);
  group.add(stem);

  // 1本目の旗（八分・十六分）
  const flag1 = new THREE.Mesh(FLAG1_GEO, mat);
  group.add(flag1);

  // 2本目の旗（十六分）
  const flag2 = new THREE.Mesh(FLAG2_GEO, mat);
  group.add(flag2);

  // スタッカートドット（符頭の下）
  const staccatoDot = new THREE.Mesh(STACCATO_GEO, mat);
  staccatoDot.position.set(0, -0.0115, 0);
  group.add(staccatoDot);

  group.visible = false;

  // 打鍵波紋（鍵盤表面に水平に広がる極細リング）
  const rippleMat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const ripple = new THREE.Mesh(RIPPLE_GEO, rippleMat);
  ripple.rotation.x = -Math.PI / 2;
  ripple.visible = false;

  // 打鍵点から音符へ伸びる極細の立ち上がり光糸
  const threadGeo = new THREE.BufferGeometry();
  const threadPos = new THREE.BufferAttribute(new Float32Array(6), 3);
  threadGeo.setAttribute('position', threadPos);
  const threadMat = new THREE.LineBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const thread = new THREE.Line(threadGeo, threadMat);
  thread.frustumCulled = false;
  thread.visible = false;

  return { group, solidHead, hollowHead, stem, flag1, flag2, staccatoDot, mat, ripple, rippleMat, thread, threadPos, threadMat };
}

function createArc(): ArcSlot {
  const arr = new Float32Array((ARC_SEGS + 1) * 3);
  const geo = new THREE.BufferGeometry();
  const posAttr = new THREE.BufferAttribute(arr, 3);
  geo.setAttribute('position', posAttr);
  const mat = new THREE.LineBasicMaterial({
    color: 0x9beeff,
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

function bpmAt(tempos: readonly TempoPoint[] | null | undefined, t: number): number {
  if (!tempos || !tempos.length) return 120;
  let bpm = tempos[0].bpm || 120;
  for (let i = 1; i < tempos.length; i++) {
    if (tempos[i].time > t) break;
    bpm = tempos[i].bpm || bpm;
  }
  return Math.max(40, Math.min(240, bpm));
}

/** 鍵盤上の打鍵原点 */
function keyOrigin(midi: number, out: THREE.Vector3): THREE.Vector3 {
  const kg = keyOf(midi);
  return out.set(kg.x, kg.black ? 0.015 : 0.005, kg.black ? -0.068 : -0.022);
}

/** 音符の現在時刻 t における優美な3D空間座標（決定論的） */
function notePosAt(n: PerformanceNote, age: number, isStaccato: boolean, out: THREE.Vector3): THREE.Vector3 {
  const kg = keyOf(n.midi);
  const phase = n.id * 1.6180339 + n.midi * 0.37;
  // スタッカートは最初に軽やかにポンッと跳ね上がる
  const hop = isStaccato ? 0.055 * Math.sin(Math.min(1, age / 0.32) * Math.PI * 0.5) : 0;
  // 滑らかなイージング上昇（打鍵直後は鍵盤からスッと立ち上がる）
  const easeOut = 1 - Math.pow(1 - Math.min(1, age / LIFE), 1.65);
  const rise = (kg.black ? 0.022 : 0.012) + hop + easeOut * 0.62;
  const swayX = Math.sin(age * 1.35 + phase) * 0.032 * Math.min(1, age * 1.2);
  const baseZ = kg.black ? -0.068 : -0.022;
  const driftZ = baseZ - easeOut * 0.14 + Math.cos(age * 1.15 + phase) * 0.026 * Math.min(1, age);
  return out.set(kg.x + swayX, rise, driftZ);
}

// 上品で透明感のあるカラーパレット
const COLOR_RH = new THREE.Color(0x9beeff); // 右手：クリスタルアイスブルー
const COLOR_LH = new THREE.Color(0xffe0a3); // 左手：シャンパンゴールド
const COLOR_HIGH = new THREE.Color(0xe6d6ff); // 高音域：パールラベンダー
const COLOR_WHITE = new THREE.Color(0xffffff);

export class NeonNotes {
  readonly root = new THREE.Group();
  private slots: NoteSlot[] = [];
  private arcs: ArcSlot[] = [];
  private tmpOrigin = new THREE.Vector3();
  private tmpA = new THREE.Vector3();
  private tmpB = new THREE.Vector3();
  private tmpC = new THREE.Vector3();
  private tmpCol = new THREE.Color();

  constructor() {
    this.root.name = 'NeonNotes';
    for (let i = 0; i < MAX_NOTES; i++) {
      const s = createNoteSlot();
      this.slots.push(s);
      this.root.add(s.group, s.ripple, s.thread);
    }
    for (let i = 0; i < MAX_ARCS; i++) {
      const a = createArc();
      this.arcs.push(a);
      this.root.add(a.line);
    }
  }

  update(
    t: number,
    notes: readonly PerformanceNote[] | null,
    tempos: readonly TempoPoint[] | null | undefined,
    enabled: boolean,
    intensity: number,
  ) {
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

    const active: { note: PerformanceNote; nextGap: number }[] = [];
    for (let i = lo; i < notes.length; i++) {
      const n = notes[i];
      if (n.start > t) break;
      // 同じ手の次の発音までの間隔（スタッカート判定用）
      let nextGap = 1.0;
      for (let j = i + 1; j < Math.min(notes.length, i + 10); j++) {
        if (notes[j].hand === n.hand && notes[j].start > n.start + 0.025) {
          nextGap = notes[j].start - n.start;
          break;
        }
      }
      active.push({ note: n, nextGap });
    }
    const startIdx = Math.max(0, active.length - MAX_NOTES);
    const shown = active.slice(startIdx);

    // 立体音符・打鍵波紋・立ち上がり光糸の更新
    for (let i = 0; i < MAX_NOTES; i++) {
      const slot = this.slots[i];
      if (i >= shown.length) {
        slot.group.visible = false;
        slot.ripple.visible = false;
        slot.thread.visible = false;
        continue;
      }
      const { note: n, nextGap } = shown[i];
      const age = Math.max(0, t - n.start);
      const u = age / LIFE;
      if (u >= 1) {
        slot.group.visible = false;
        slot.ripple.visible = false;
        slot.thread.visible = false;
        continue;
      }

      // 楽譜の音価（拍数）とスタッカートを判定
      const bpm = bpmAt(tempos, n.start);
      const dur = Math.max(0.03, n.end - n.start);
      const beats = (dur * bpm) / 60;
      const isStaccato = dur < 0.21 && dur < nextGap * 0.52;
      const isWhole = beats >= 2.8;
      const isHalf = beats >= 1.45 && !isWhole;
      const isQuarter = beats >= 0.68 && beats < 1.45;
      const isEighth = beats >= 0.33 && beats < 0.68;
      const isSixteenth = beats < 0.33;

      slot.solidHead.visible = !(isWhole || isHalf);
      slot.hollowHead.visible = isWhole || isHalf;
      slot.stem.visible = !isWhole;
      slot.flag1.visible = isEighth || isSixteenth;
      slot.flag2.visible = isSixteenth;
      slot.staccatoDot.visible = isStaccato;

      // 音符の位置・姿勢・繊細なフェード
      slot.group.visible = true;
      notePosAt(n, age, isStaccato, slot.group.position);

      const pop = Math.min(1, age / 0.14);
      const fade = Math.pow(1 - u, 1.65);
      const velScale = 0.72 + 0.36 * n.velocity;
      const sc = (0.45 + 0.55 * pop) * velScale * (1 + 0.08 * u);
      slot.group.scale.setScalar(sc);
      slot.group.rotation.y = Math.sin(age * 0.9 + n.id * 0.7) * 0.32;
      slot.group.rotation.z = Math.cos(age * 0.75 + n.id * 0.5) * 0.1;

      // 色調（打鍵直後は白く澄んだ輝き → 徐々に上品なパステルネオンへ）
      this.tmpCol.copy(n.hand === 'R' ? COLOR_RH : COLOR_LH);
      if (n.midi > 74) this.tmpCol.lerp(COLOR_HIGH, Math.min(0.6, (n.midi - 74) / 24));
      const flash = Math.max(0, 1 - age / 0.22);
      this.tmpCol.lerp(COLOR_WHITE, flash * 0.55);

      slot.mat.color.copy(this.tmpCol);
      slot.mat.opacity = Math.min(0.82, fade * pop * (0.38 + 0.36 * n.velocity) * intensity);

      // 鍵盤上の打鍵リップル（光の波紋）
      keyOrigin(n.midi, this.tmpOrigin);
      if (age < RIPPLE_LIFE) {
        const ru = age / RIPPLE_LIFE;
        slot.ripple.visible = true;
        slot.ripple.position.copy(this.tmpOrigin);
        slot.ripple.scale.setScalar(0.55 + ru * (1.8 + 0.9 * n.velocity));
        slot.rippleMat.color.copy(this.tmpCol);
        slot.rippleMat.opacity = Math.pow(1 - ru, 1.8) * (0.55 + 0.3 * n.velocity) * intensity;
      } else {
        slot.ripple.visible = false;
      }

      // 鍵盤から音符へ伸びる極細の光糸（「打鍵から生まれ出た」表現）
      if (age < THREAD_LIFE) {
        const tu = age / THREAD_LIFE;
        slot.thread.visible = true;
        const arr = slot.threadPos.array as Float32Array;
        arr[0] = this.tmpOrigin.x;
        arr[1] = this.tmpOrigin.y;
        arr[2] = this.tmpOrigin.z;
        arr[3] = slot.group.position.x;
        arr[4] = slot.group.position.y;
        arr[5] = slot.group.position.z;
        slot.threadPos.needsUpdate = true;
        slot.threadMat.color.copy(this.tmpCol);
        slot.threadMat.opacity = Math.pow(1 - tu, 1.6) * 0.45 * intensity;
      } else {
        slot.thread.visible = false;
      }
    }

    // 音の繋がる表現（同じ手の連続する音符同士を絹糸のような極細3Dカーブで結ぶ）
    let arcIdx = 0;
    const lastByHand: Record<'L' | 'R', { note: PerformanceNote; isStaccato: boolean } | null> = { L: null, R: null };
    for (const item of shown) {
      const n = item.note;
      const dur = Math.max(0.03, n.end - n.start);
      const isStaccato = dur < 0.21 && dur < item.nextGap * 0.52;
      const prev = lastByHand[n.hand];
      lastByHand[n.hand] = { note: n, isStaccato };
      if (!prev || arcIdx >= MAX_ARCS) continue;
      // スタッカート同士は音を切り離して跳ねる感じを活かす（レガート寄りの流れを繋ぐ）
      if (prev.isStaccato && isStaccato) continue;
      const dt = n.start - prev.note.start;
      if (dt <= 0.018 || dt > LINK_WINDOW) continue;

      const ageA = Math.max(0, t - prev.note.start);
      const ageB = Math.max(0, t - n.start);
      const fade = Math.pow(1 - Math.max(ageA, ageB) / LIFE, 1.7);
      if (fade <= 0.01) continue;

      const a = notePosAt(prev.note, ageA, prev.isStaccato, this.tmpA);
      const b = notePosAt(n, ageB, isStaccato, this.tmpB);
      const dist = a.distanceTo(b);
      this.tmpC.addVectors(a, b).multiplyScalar(0.5);
      this.tmpC.y += 0.035 + Math.min(0.11, dist * 0.22);
      this.tmpC.z += 0.02 * Math.sin(n.id * 1.1);

      const slot = this.arcs[arcIdx++];
      slot.line.visible = true;
      const arr = slot.posAttr.array as Float32Array;
      for (let k = 0; k <= ARC_SEGS; k++) {
        const s = k / ARC_SEGS;
        const inv = 1 - s;
        arr[k * 3] = inv * inv * a.x + 2 * inv * s * this.tmpC.x + s * s * b.x;
        arr[k * 3 + 1] = inv * inv * a.y + 2 * inv * s * this.tmpC.y + s * s * b.y;
        arr[k * 3 + 2] = inv * inv * a.z + 2 * inv * s * this.tmpC.z + s * s * b.z;
      }
      slot.posAttr.needsUpdate = true;

      this.tmpCol.copy(n.hand === 'R' ? COLOR_RH : COLOR_LH);
      slot.mat.color.copy(this.tmpCol);
      slot.mat.opacity = Math.min(0.55, fade * 0.36 * intensity);
    }

    for (let i = arcIdx; i < MAX_ARCS; i++) {
      this.arcs[i].line.visible = false;
    }
  }
}
