// 譜面台の楽譜・床に散らばる楽譜・演奏連動で舞う和紙調楽譜（ネオン縁発光連動対応）
import * as THREE from 'three';
import { FLOOR_Y } from './Environment';

const PAGE_W = 0.21;
const PAGE_H = 0.297;
const TEX_W = 768;
const TEX_H = Math.round((TEX_W * PAGE_H) / PAGE_W);

function rng(seed: number) {
  let s = seed >>> 0;
  return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
}

/** 和紙調の繊維感・淡い生成り紙質と曲タイトル・作曲家入りの楽譜ページを動的描画 */
function drawPage(seed: number, title: string | null, subtitle: string | null, pageNo: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = TEX_W;
  c.height = TEX_H;
  const g = c.getContext('2d')!;
  const r = rng(seed);
  const W = TEX_W;
  const H = TEX_H;

  // 和紙ベースの温かみある生成り色
  g.fillStyle = '#ebe1cc';
  g.fillRect(0, 0, W, H);

  // 柔らかな紙のムラ
  for (let i = 0; i < 36; i++) {
    const x = r() * W;
    const y = r() * H;
    const rad = 45 + r() * 220;
    const grd = g.createRadialGradient(x, y, 0, x, y, rad);
    const a = 0.025 + r() * 0.045;
    grd.addColorStop(0, `rgba(${162 + r() * 35}, ${130 + r() * 28}, ${84 + r() * 22}, ${a})`);
    grd.addColorStop(1, 'rgba(162, 130, 84, 0)');
    g.fillStyle = grd;
    g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }

  // 和紙特有の繊細な楮（こうぞ）繊維ストローク
  g.save();
  for (let i = 0; i < 220; i++) {
    const x = r() * W;
    const y = r() * H;
    const len = 10 + r() * 38;
    const ang = r() * Math.PI * 2;
    g.strokeStyle = i % 3 === 0 ? `rgba(255, 250, 240, ${0.18 + r() * 0.22})` : `rgba(145, 118, 82, ${0.07 + r() * 0.1})`;
    g.lineWidth = 0.6 + r() * 1.1;
    g.beginPath();
    g.moveTo(x, y);
    g.quadraticCurveTo(x + Math.cos(ang + 0.35) * len * 0.5, y + Math.sin(ang + 0.35) * len * 0.5, x + Math.cos(ang) * len, y + Math.sin(ang) * len);
    g.stroke();
  }
  g.restore();

  // 紙端の柔らかな陰影と金色の控えめな飾り罫
  const edge = g.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.36, W / 2, H / 2, Math.max(W, H) * 0.72);
  edge.addColorStop(0, 'rgba(120, 88, 48, 0)');
  edge.addColorStop(1, 'rgba(120, 88, 48, 0.24)');
  g.fillStyle = edge;
  g.fillRect(0, 0, W, H);

  g.strokeStyle = 'rgba(150, 118, 66, 0.32)';
  g.lineWidth = 1.6;
  g.strokeRect(W * 0.045, H * 0.032, W * 0.91, H * 0.936);

  // 五線譜と音符の彫刻風描画
  const ink = 'rgba(26, 20, 15, 0.88)';
  g.strokeStyle = ink;
  g.fillStyle = ink;
  const left = W * 0.09;
  const right = W * 0.93;
  const gap = H * 0.0072;
  let y = title ? H * 0.165 : H * 0.075;
  if (title) {
    g.textAlign = 'center';
    g.font = `600 ${Math.round(H * 0.028)}px "Shippori Mincho", "Cormorant Garamond", Georgia, serif`;
    g.fillText(title, W / 2, H * 0.082, W * 0.8);
    if (subtitle) {
      g.font = `italic ${Math.round(H * 0.014)}px "Cormorant Garamond", Georgia, serif`;
      g.fillText(subtitle, W / 2, H * 0.112, W * 0.76);
    }
  }
  const systems = title ? 5 : 6;
  const stepY = (H * 0.92 - y) / systems;
  for (let sys = 0; sys < systems; sys++) {
    const top = y + sys * stepY;
    const staves = [top, top + gap * 10];
    g.lineWidth = Math.max(1, gap * 0.13);
    for (const st of staves) {
      for (let l = 0; l < 5; l++) {
        g.beginPath();
        g.moveTo(left, st + l * gap);
        g.lineTo(right, st + l * gap);
        g.stroke();
      }
    }
    g.lineWidth = gap * 0.25;
    g.beginPath();
    g.moveTo(left, staves[0]);
    g.lineTo(left, staves[1] + 4 * gap);
    g.stroke();
    g.lineWidth = gap * 0.45;
    g.beginPath();
    g.moveTo(left - gap * 0.9, staves[0]);
    g.bezierCurveTo(left - gap * 2.2, staves[0] + gap * 5, left - gap * 0.3, staves[0] + gap * 6, left - gap * 2.1, staves[0] + gap * 7);
    g.bezierCurveTo(left - gap * 0.3, staves[0] + gap * 8, left - gap * 2.2, staves[0] + gap * 9, left - gap * 0.9, staves[1] + 4 * gap);
    g.stroke();

    const bars = 3 + Math.floor(r() * 2);
    const barW = (right - left - gap * 4) / bars;
    for (let b = 0; b <= bars; b++) {
      const bx = left + gap * 4 + b * barW;
      g.lineWidth = b === bars && sys === systems - 1 ? gap * 0.4 : gap * 0.16;
      g.beginPath();
      g.moveTo(bx, staves[0]);
      g.lineTo(bx, staves[1] + 4 * gap);
      g.stroke();
    }

    for (const st of staves) {
      g.lineWidth = gap * 0.24;
      g.beginPath();
      g.arc(left + gap * 1.8, st + gap * 2, gap * 1.1, -0.6, Math.PI * 1.35);
      g.stroke();
      for (let b = 0; b < bars; b++) {
        const bx0 = left + gap * 4.7 + b * barW;
        const count = 4 + Math.floor(r() * 5);
        const xs: number[] = [];
        const ys: number[] = [];
        for (let i = 0; i < count; i++) {
          const nx = bx0 + ((i + 0.5) / count) * (barW - gap * 1.4);
          const step = Math.floor(r() * 11) - 1;
          const ny = st + step * (gap * 0.5);
          xs.push(nx);
          ys.push(ny);
          g.save();
          g.translate(nx, ny);
          g.rotate(-0.35);
          g.beginPath();
          g.ellipse(0, 0, gap * 0.62, gap * 0.44, 0, 0, Math.PI * 2);
          if (r() < 0.16) {
            g.lineWidth = gap * 0.22;
            g.stroke();
          } else g.fill();
          g.restore();
          const up = step >= 4;
          const sx = nx + (up ? gap * 0.52 : -gap * 0.52);
          g.lineWidth = gap * 0.16;
          g.beginPath();
          g.moveTo(sx, ny);
          g.lineTo(sx, ny + (up ? -gap * 3.3 : gap * 3.3));
          g.stroke();
        }
        if (count >= 4) {
          g.lineWidth = gap * 0.42;
          g.beginPath();
          g.moveTo(xs[0] + gap * 0.52, ys[0] - gap * 3.1);
          g.lineTo(xs[2] + gap * 0.52, ys[2] - gap * 3.1);
          g.stroke();
        }
        if (r() < 0.45 && count >= 3) {
          g.lineWidth = gap * 0.16;
          g.beginPath();
          const y0 = Math.min(ys[0], ys[2]) - gap * 2.2;
          g.moveTo(xs[0], ys[0] - gap);
          g.quadraticCurveTo((xs[0] + xs[2]) / 2, y0 - gap * 1.5, xs[2], ys[2] - gap);
          g.stroke();
        }
      }
    }
  }
  g.textAlign = 'center';
  g.font = `${Math.round(H * 0.011)}px Georgia, serif`;
  g.fillText(String(pageNo), W / 2, H * 0.965);
  return c;
}

function pageMaterial(canvas: HTMLCanvasElement, translucent = false): THREE.MeshStandardMaterial {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return new THREE.MeshStandardMaterial({
    map: tex,
    roughness: 0.86,
    metalness: 0.0,
    side: THREE.DoubleSide,
    transparent: translucent,
    opacity: translucent ? 0.92 : 1.0,
  });
}

function pageGeometry(bend: (u: number, v: number) => number, sx = 14, sy = 14) {
  const geo = new THREE.PlaneGeometry(PAGE_W, PAGE_H, sx, sy);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const u = p.getX(i) / PAGE_W + 0.5;
    const v = p.getY(i) / PAGE_H + 0.5;
    p.setZ(i, bend(u, v));
  }
  geo.computeVertexNormals();
  return geo;
}

interface FloatingPage {
  group: THREE.Group;
  edgeMat: THREE.LineBasicMaterial;
  baseRadius: number;
  baseHeight: number;
  speed: number;
  phase: number;
  tilt: number;
}

export class SheetMusicVisual {
  readonly root = new THREE.Group();
  readonly deskGroup = new THREE.Group();
  private deskLeftMat!: THREE.MeshStandardMaterial;
  private floatingGroup = new THREE.Group();
  private floating: FloatingPage[] = [];
  private floorFlutter: { mesh: THREE.Mesh; baseRotZ: number; phase: number }[] = [];

  constructor() {
    this.root.name = 'SheetMusic';
    const pages = [
      drawPage(11, '幻想即興曲', 'Frédéric Chopin', 1),
      drawPage(23, null, null, 2),
      drawPage(37, null, null, 3),
      drawPage(53, null, null, 4),
    ];
    const mats = pages.map((p) => pageMaterial(p, false));
    this.deskLeftMat = mats[0];

    // 譜面台に置かれた見開き楽譜
    const desk = this.deskGroup;
    desk.position.set(0.02, 0.147, -0.168);
    desk.rotation.x = -0.13;
    for (const side of [-1, 1]) {
      const geo = pageGeometry((u) => {
        const fromSpine = side < 0 ? 1 - u : u;
        return 0.009 * Math.sin(Math.PI * Math.min(1, fromSpine * 1.15)) * (1 - 0.35 * fromSpine);
      });
      const m = new THREE.Mesh(geo, side < 0 ? mats[0] : mats[1]);
      m.position.set(side * (PAGE_W / 2 + 0.001), PAGE_H / 2, 0);
      m.rotation.y = -side * 0.05;
      m.castShadow = true;
      m.receiveShadow = true;
      desk.add(m);
    }
    this.root.add(desk);

    // 床に散らばる和紙調楽譜（窓の光に向かって配置）
    const r = rng(99);
    const spots: [number, number, number][] = [
      [-0.95, 0.55, 0.4],
      [-0.7, 0.85, -0.6],
      [-1.25, 0.95, 1.2],
      [-0.45, 0.42, 2.6],
      [-1.05, 0.25, -1.3],
      [-0.25, 1.05, 0.9],
      [-1.5, 0.6, 2.1],
    ];
    spots.forEach(([x, z, rot], i) => {
      const curl = 0.004 + r() * 0.01;
      const corner = Math.floor(r() * 4);
      const geo = pageGeometry(
        (u, v) => {
          const cu = corner & 1 ? u : 1 - u;
          const cv = corner & 2 ? v : 1 - v;
          return curl * Math.pow(Math.max(0, cu + cv - 1.1), 2) * 3 + 0.0015 * Math.sin(u * 7 + i) * Math.sin(v * 5);
        },
        8,
        10,
      );
      const m = new THREE.Mesh(geo, mats[(i + 2) % mats.length]);
      m.rotation.x = -Math.PI / 2;
      m.rotation.z = rot;
      m.position.set(x, FLOOR_Y + 0.0015 + i * 0.0007, z);
      m.receiveShadow = true;
      this.root.add(m);
      if (i < 2) this.floorFlutter.push({ mesh: m, baseRotZ: rot, phase: i * 2.1 });
    });

    // 案2＋案3：演奏連動でゆっくり螺旋状に舞う楽譜（ネオン縁発光連動）
    this.floatingGroup.name = 'FloatingSheets';
    const floatMats = [pageMaterial(pages[1], true), pageMaterial(pages[2], true), pageMaterial(pages[3], true)];
    const borderGeo = new THREE.EdgesGeometry(new THREE.PlaneGeometry(PAGE_W * 1.01, PAGE_H * 1.01, 1, 1));
    const configs = [
      { rad: 0.92, h: 0.22, speed: 0.16, phase: 0.2, tilt: 0.45 },
      { rad: 1.08, h: 0.48, speed: 0.13, phase: 1.35, tilt: -0.52 },
      { rad: 0.85, h: 0.66, speed: 0.18, phase: 2.55, tilt: 0.38 },
      { rad: 1.18, h: 0.08, speed: 0.12, phase: 3.7, tilt: -0.35 },
      { rad: 0.98, h: 0.36, speed: 0.15, phase: 4.85, tilt: 0.58 },
      { rad: 1.12, h: 0.58, speed: 0.14, phase: 5.75, tilt: -0.42 },
    ];
    configs.forEach((cfg, i) => {
      const grp = new THREE.Group();
      const geo = pageGeometry(
        (u, v) => 0.016 * Math.sin(u * Math.PI) * Math.cos((v - 0.5) * Math.PI * 1.2) + 0.008 * Math.sin(v * Math.PI * 2 + i),
        10,
        12,
      );
      const mesh = new THREE.Mesh(geo, floatMats[i % floatMats.length]);
      mesh.castShadow = false;
      mesh.receiveShadow = true;
      grp.add(mesh);

      // ネオン音符ON時に淡く光る縁取りライン
      const edgeMat = new THREE.LineBasicMaterial({
        color: i % 2 === 0 ? 0x7eeaf3 : 0xffd27d,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const edge = new THREE.LineSegments(borderGeo, edgeMat);
      edge.position.z = 0.003;
      grp.add(edge);

      this.floatingGroup.add(grp);
      this.floating.push({
        group: grp,
        edgeMat,
        baseRadius: cfg.rad,
        baseHeight: cfg.h,
        speed: cfg.speed,
        phase: cfg.phase,
        tilt: cfg.tilt,
      });
    });
    this.root.add(this.floatingGroup);
  }

  /** 譜面台の左ページに演奏中の曲名・作曲家を印字し直す */
  setTitle(title: string, artist: string) {
    if (typeof document === 'undefined') return;
    const canvas = drawPage(11, title, artist, 1);
    const oldTex = this.deskLeftMat.map;
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    this.deskLeftMat.map = tex;
    this.deskLeftMat.needsUpdate = true;
    oldTex?.dispose();
  }

  /**
   * 絶対時刻 t と演奏エネルギー（0..1）から、舞う楽譜の位置・姿勢・ネオン縁発光を更新
   */
  update(t: number, energy: number, floatingOn: boolean, neonOn: boolean, neonIntensity: number) {
    // 床の端2枚は窓からの微風でほんのり揺れる
    for (const fl of this.floorFlutter) {
      fl.mesh.rotation.z = fl.baseRotZ + Math.sin(t * 0.45 + fl.phase) * 0.012;
    }

    this.floatingGroup.visible = floatingOn;
    if (!floatingOn) return;

    const lift = 0.08 * energy;
    const pulse = 0.5 + 0.5 * Math.sin(t * 1.4);
    for (const fp of this.floating) {
      const ang = fp.phase + t * fp.speed;
      // ピアノ背面壁（z = -0.7）にめり込まないよう、ピアノ手前〜左右に広がる楕円軌道
      const x = Math.cos(ang) * fp.baseRadius;
      const z = 0.28 + Math.sin(ang) * 0.56;
      const y = fp.baseHeight + lift + Math.sin(t * 0.65 + fp.phase * 1.7) * (0.11 + 0.05 * energy);
      fp.group.position.set(x, y, z);
      fp.group.rotation.set(
        fp.tilt + Math.sin(t * 0.55 + fp.phase) * 0.22,
        -ang + Math.PI * 0.5 + Math.cos(t * 0.4 + fp.phase) * 0.3,
        Math.sin(t * 0.72 + fp.phase * 0.8) * 0.25,
      );
      // 案3：空間ネオン音符ONのとき、舞う楽譜の縁も淡く発光
      fp.edgeMat.opacity = neonOn ? Math.min(0.65, (0.24 + 0.22 * energy + 0.1 * pulse) * neonIntensity) : 0;
    }
  }
}

export function createSheetMusic(): SheetMusicVisual {
  return new SheetMusicVisual();
}
