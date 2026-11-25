// Binds a HandPose (pure data from the performance layer) to the robot hand's
// node hierarchy. The left hand is the right-hand model mirrored by its root's
// negative x scale; all rotations stay in the canonical right-hand frame.
import * as THREE from 'three';
import { FINGERS, THUMB, flex, mul, rotY, rotZ, thumbBase, type M3 } from '../core/handGeometry';
import type { Hand } from '../core/types';
import type { HandPose } from '../performance/HandPoser';

const m4 = new THREE.Matrix4();
const qa = new THREE.Quaternion();
const qb = new THREE.Quaternion();

function setRot(o: THREE.Object3D, m: M3) {
  m4.set(m[0], m[1], m[2], 0, m[3], m[4], m[5], 0, m[6], m[7], m[8], 0, 0, 0, 0, 1);
  o.quaternion.setFromRotationMatrix(m4);
}

const T_BASE = thumbBase(THUMB);

/**
 * 右手中指（F3_0）に装着するオリジナル指輪：
 * 交差する3連プラチナ／シルバークロスバンド＋上側の4本爪イエローストーン＋下側の一列メレダイヤ。
 */
function createMiddleFingerRing(): THREE.Group {
  const ring = new THREE.Group();
  ring.name = 'CustomRing';
  // F3_0 は -Z 方向へ長さ 47.5mm、断面は幅 16.2mm(rx=8.1mm) × 高さ 15.0mm(ry=7.5mm)
  ring.position.set(0, 0, -0.0155);

  const platinumMat = new THREE.MeshPhysicalMaterial({
    color: 0xeaf0f6,
    metalness: 0.96,
    roughness: 0.14,
    clearcoat: 1.0,
    clearcoatRoughness: 0.08,
  });

  const goldProngMat = new THREE.MeshStandardMaterial({
    color: 0xe6c36a,
    metalness: 0.95,
    roughness: 0.18,
  });

  const yellowGemMat = new THREE.MeshPhysicalMaterial({
    color: 0xffd740,
    emissive: 0x5c3e00,
    emissiveIntensity: 0.35,
    metalness: 0.12,
    roughness: 0.05,
    clearcoat: 1.0,
    clearcoatRoughness: 0.02,
  });

  const diamondMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    emissive: 0x99c8ff,
    emissiveIntensity: 0.28,
    metalness: 0.18,
    roughness: 0.03,
    clearcoat: 1.0,
    clearcoatRoughness: 0.02,
  });

  const rx = 0.00875;
  const ry = 0.00825;

  // 交差する3連プラチナバンド（+Y側＝手の甲側で優雅にクロスするカーブ）
  const makeBand = (zOffset: (theta: number) => number, rBoost: (theta: number) => number, radius: number) => {
    const pts: THREE.Vector3[] = [];
    const N = 48;
    for (let i = 0; i < N; i++) {
      const th = (i / N) * Math.PI * 2;
      const b = rBoost(th);
      pts.push(new THREE.Vector3(Math.cos(th) * (rx + b), Math.sin(th) * (ry + b), zOffset(th)));
    }
    const curve = new THREE.CatmullRomCurve3(pts, true);
    const geo = new THREE.TubeGeometry(curve, 64, radius, 10, true);
    const mesh = new THREE.Mesh(geo, platinumMat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  };

  // バンド1：手の甲側（theta ≈ PI/2）で斜めにクロスするメインアーム
  ring.add(
    makeBand(
      (th) => 0.0022 * Math.cos(th - Math.PI * 0.35),
      (th) => 0.00055 * Math.max(0, Math.sin(th)),
      0.00092,
    ),
  );
  // バンド2：逆向きにクロスし、上側にイエローストーンを支えるアーム
  ring.add(
    makeBand(
      (th) => -0.0021 * Math.cos(th - Math.PI * 0.65) - 0.0007,
      (th) => 0.0003 * Math.max(0, Math.sin(th)),
      0.00086,
    ),
  );
  // バンド3：下側にメレダイヤ一列を載せるアーム
  ring.add(
    makeBand(
      (th) => 0.0016 + 0.0007 * Math.sin(th),
      (th) => 0.00045 * Math.max(0, Math.sin(th)),
      0.00082,
    ),
  );

  // 上側バンドのイエローストーン（4本爪セッティング、手の甲側やや右寄り）
  const gemHolder = new THREE.Group();
  const gemTheta = Math.PI * 0.44;
  gemHolder.position.set(Math.cos(gemTheta) * (rx + 0.0014), Math.sin(gemTheta) * (ry + 0.0015), -0.0015);
  gemHolder.rotation.z = gemTheta - Math.PI / 2;

  const yellowGem = new THREE.Mesh(new THREE.OctahedronGeometry(0.00215, 1), yellowGemMat);
  yellowGem.scale.set(1.0, 0.72, 1.0);
  gemHolder.add(yellowGem);

  // 4本爪プロング
  const prongGeo = new THREE.CylinderGeometry(0.00032, 0.00042, 0.0024, 6);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const p = new THREE.Mesh(prongGeo, goldProngMat);
    p.position.set(Math.cos(a) * 0.00175, -0.0002, Math.sin(a) * 0.00175);
    gemHolder.add(p);
  }
  ring.add(gemHolder);

  // 下側バンドのメレダイヤ一列（7粒）
  const meleeGeo = new THREE.OctahedronGeometry(0.00095, 0);
  const count = 7;
  for (let i = 0; i < count; i++) {
    const u = (i / (count - 1)) - 0.5; // -0.5 .. +0.5
    const th = Math.PI * 0.5 - u * 0.92;
    const d = new THREE.Mesh(meleeGeo, diamondMat);
    d.position.set(Math.cos(th) * (rx + 0.00125), Math.sin(th) * (ry + 0.00125), 0.0022 - u * 0.0006);
    d.rotation.set(0.4, i * 0.7, 0.3);
    ring.add(d);
  }

  return ring;
}

export class HandRig {
  readonly root: THREE.Object3D;
  private node: Record<string, THREE.Object3D> = {};

  /** the servo rings: one material per finger (1 = thumb) and one for the rest of the hand ([0]) */
  private glows: THREE.MeshStandardMaterial[] = [];

  constructor(template: THREE.Object3D, readonly hand: Hand, glow?: THREE.MeshStandardMaterial) {
    this.root = template.clone(true);
    this.root.name = hand === 'R' ? 'RightHand' : 'LeftHand';
    this.root.traverse((o) => {
      if (o.name) this.node[o.name] = o;
    });
    const required = ['Palm', 'Forearm', 'WristCore', 'WristRing1', 'WristRing2', 'T_0', 'T_1', 'T_2', ...FINGERS.flatMap((f) => [0, 1, 2].map((k) => `F${f.id}_${k}`))];
    for (const r of required) if (!this.node[r]) throw new Error(`robot hand model is missing node ${r}`);
    const handNode = this.node['Hand'];
    if (handNode && handNode !== this.root) {
      handNode.position.set(0, 0, 0);
      handNode.quaternion.identity();
    }
    this.root.scale.set(hand === 'R' ? 1 : -1, 1, 1);

    // 右手中指（F3_0）にオリジナル指輪を装着
    if (hand === 'R' && this.node['F3_0']) {
      this.node['F3_0'].add(createMiddleFingerRing());
    }

    if (glow) {
      const own = (node: THREE.Object3D) => {
        const m = glow.clone();
        node.traverse((o) => {
          const mesh = o as THREE.Mesh;
          if (mesh.isMesh && mesh.material === glow) mesh.material = m;
        });
        return m;
      };
      this.glows[1] = own(this.node['T_0']);
      FINGERS.forEach((f) => (this.glows[f.id] = own(this.node[`F${f.id}_0`])));
      this.glows[0] = own(this.root);
    }
  }

  setGlow(base: number, effort: number[]) {
    if (!this.glows.length) return;
    let most = 0;
    for (let f = 1; f <= 5; f++) {
      this.glows[f].emissiveIntensity = base * (1 + 0.75 * effort[f]);
      most = Math.max(most, effort[f]);
    }
    this.glows[0].emissiveIntensity = base * (1 + 0.25 * most);
  }

  get(name: string) {
    return this.node[name];
  }

  apply(p: HandPose) {
    this.root.position.set(p.wrist[0], p.wrist[1], p.wrist[2]);
    setRot(this.node['Palm'], p.rot);
    setRot(this.node['Forearm'], p.forearm);
    qa.copy(this.node['Forearm'].quaternion);
    qb.copy(this.node['Palm'].quaternion);
    this.node['WristRing2'].quaternion.slerpQuaternions(qa, qb, 0.33);
    this.node['WristRing1'].quaternion.slerpQuaternions(qa, qb, 0.66);
    this.node['WristCore'].quaternion.slerpQuaternions(qa, qb, 0.82);
    FINGERS.forEach((f, i) => {
      const s = p.fingers[i];
      setRot(this.node[`F${f.id}_0`], mul(rotY(f.baseYaw + s.abduction), flex(s.angles[0])));
      setRot(this.node[`F${f.id}_1`], flex(s.angles[1]));
      setRot(this.node[`F${f.id}_2`], flex(s.angles[2]));
    });
    const t = p.thumb;
    setRot(this.node['T_0'], mul(mul(mul(rotY(t.swing), T_BASE), rotZ(t.twist)), flex(t.angles[0])));
    setRot(this.node['T_1'], flex(t.angles[1]));
    setRot(this.node['T_2'], flex(t.angles[2]));
  }
}
