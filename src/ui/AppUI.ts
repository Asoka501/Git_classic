// メインUI：コントロールバー、タイトルカード、設定ドロワー（運指・照明・カメラ・サウンド・書き出し・デバッグ）
import { FRAME_STEP, SPEEDS, type App } from '../app/App';
import { entryById } from '../app/library';
import { el, escapeHtml, fmt, svg } from './dom';
import { LibrarySheet, NOTE_ICON } from './LibrarySheet';
import { KEYS_ICON, LivePanel } from './LivePanel';
import { exportSize, exportSupport, exportVideo } from '../app/VideoExport';
import { noteName } from '../core/keyboard';
import type { Finger, Hand, PerformanceNote, TrackInfo } from '../core/types';
import type { ParsedMidi } from '../interpretation/MidiEngine';
import { DEFAULT_LOOK } from '../presentation/SceneRenderer';
import { DEFAULT_LIGHTS } from '../presentation/Environment';
import { DEFAULT_FRAMING } from '../presentation/CinematicCamera';
import { ROOMS, type RoomId } from '../audio/AudioEngine';
import { DEFAULT_SOUND } from '../app/settings';
import { STYLES } from '../presentation/VisualStyles';

const ICON = {
  play: '<path d="M8 5.5v13l11-6.5z"/>',
  pause: '<path d="M7 5h3.6v14H7zM13.4 5H17v14h-3.6z"/>',
  restart: '<path d="M6 6h2v12H6zM9.5 12l8.5 6V6z"/>',
  back: '<path d="M11 12l7 5V7zM6 7h2v10H6z" transform="translate(0 0)"/>',
  fwd: '<path d="M13 12L6 7v10zM16 7h2v10h-2z"/>',
  vol: '<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4zM15 8.5a5 5 0 010 7M17.5 6a8.5 8.5 0 010 12" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/>',
  mute: '<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M15.5 9.5l5 5M20.5 9.5l-5 5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',
  gear: '<path d="M12 8.6a3.4 3.4 0 100 6.8 3.4 3.4 0 000-6.8zm8.2 4.6l1.6 1.2-1.7 3-1.9-.7c-.5.4-1.1.8-1.7 1l-.3 2H12l-.3-2a7 7 0 01-1.7-1l-1.9.7-1.7-3 1.6-1.2a7 7 0 010-2l-1.6-1.2 1.7-3 1.9.7c.5-.4 1.1-.8 1.7-1l.3-2h3.4l.3 2c.6.2 1.2.6 1.7 1l1.9-.7 1.7 3-1.6 1.2a7 7 0 010 2z" transform="translate(-1.5 -1) scale(1.02)"/>',
  prev: '<path d="M14.5 6.5L9 12l5.5 5.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>',
  next: '<path d="M9.5 6.5L15 12l-5.5 5.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>',
  pianoClosed:
    '<path d="M5.5 13V5.6A1.6 1.6 0 017.1 4h9.8a1.6 1.6 0 011.6 1.6V13M5.5 16.6V20M18.5 16.6V20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/><path d="M3.8 13h16.4v3.6H3.8z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M8.5 13v2M12 13v2M15.5 13v2" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>',
  pianoOpen:
    '<path d="M5.5 13V8.6M18.5 13V8.6M5.5 16.6V20M18.5 16.6V20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><path d="M6.2 2.9l11.2-1.3.5 4.4-11.2 1.3z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path d="M8.6 9.2v3.4M10.8 9.2v3.4M13.2 9.2v3.4M15.4 9.2v3.4" stroke="currentColor" stroke-width="1.1" stroke-linecap="round" opacity="0.8"/><path d="M3.8 13h16.4v3.6H3.8z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M8.5 13v2M12 13v2M15.5 13v2" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>',
};

const QUALITY_LABEL: Record<string, string> = {
  high: '高画質',
  medium: '標準',
  low: '軽量',
};

export class AppUI {
  private bar!: HTMLDivElement;
  private playBtn!: HTMLButtonElement;
  private timeLabel!: HTMLSpanElement;
  private track!: HTMLDivElement;
  private fill!: HTMLDivElement;
  private handle!: HTMLDivElement;
  private hoverTip!: HTMLDivElement;
  private title!: HTMLDivElement;
  private drawer!: HTMLDivElement;
  private drawerBody!: HTMLDivElement;
  private tab: 'fingering' | 'light' | 'camera' | 'sound' | 'export' | 'debug' = 'fingering';
  private film = { aspect: 16 / 9, longSide: 1920, fps: 30, range: 'all' as 'all' | 'here' };
  private filming: AbortController | null = null;
  private filmState: { f: number; text: string } | null = null;
  private paintFilm: (() => void) | null = null;
  private autoBtn!: HTMLButtonElement;
  private shotLabel!: HTMLSpanElement;
  private openBtn!: HTMLButtonElement;
  private volBtn!: HTMLButtonElement;
  private speedSel!: HTMLSelectElement;
  private library!: LibrarySheet;
  private livePanel!: LivePanel;
  private debugInfo!: HTMLDivElement;
  private toastEl!: HTMLDivElement;
  private idleTimer = 0;
  private lastFingerRefresh = -1;

  constructor(private app: App, private root: HTMLElement) {}

  build() {
    const r = this.root;
    r.classList.add('ui');
    this.title = el('div', 'title-card');
    r.appendChild(this.title);

    this.bar = el('div', 'bar');
    const scrub = el('div', 'scrub');
    this.track = el('div', 'track');
    this.fill = el('div', 'fill');
    this.handle = el('div', 'handle');
    this.hoverTip = el('div', 'hover-tip');
    this.track.append(this.fill, this.handle, this.hoverTip);
    scrub.appendChild(this.track);
    const row = el('div', 'row');
    const left = el('div', 'group');
    const restart = this.btn(ICON.restart, '最初に戻る (Home)', () => this.app.restart());
    const back = this.btn(ICON.back, '1フレーム戻る (←)', () => this.app.step(-1));
    this.playBtn = this.btn(ICON.play, '再生 / 一時停止 (Space)', () => this.app.toggle(), 'play');
    const fwd = this.btn(ICON.fwd, '1フレーム進む (→)', () => this.app.step(1));
    this.timeLabel = el('span', 'time');
    left.append(restart, back, this.playBtn, fwd, this.timeLabel);

    const mid = el('div', 'group mid');
    const cams = el('div', 'cams');
    cams.setAttribute('role', 'group');
    cams.setAttribute('aria-label', 'カメラ');
    this.autoBtn = el('button', 'seg', 'Cinematic');
    this.autoBtn.title = 'Cinematic (1)：曲の流れに合わせてカメラワークを自動編集します';
    this.autoBtn.onclick = (e) => {
      e.stopPropagation();
      this.app.setCamera('cinematic');
    };
    const prev = this.btn(ICON.prev, '前のショット (,)', () => this.app.stepShot(-1), 'step');
    const next = this.btn(ICON.next, '次のショット (.)', () => this.app.stepShot(1), 'step');
    this.shotLabel = el('span', 'shot-name');
    const picker = el('div', 'shot');
    picker.append(prev, this.shotLabel, next);
    cams.append(this.autoBtn, picker);
    this.openBtn = el('button', 'pill open-btn');
    this.openBtn.onclick = (e) => {
      e.stopPropagation();
      this.app.setOpen(!this.app.view.look.openPiano);
    };
    mid.append(cams, this.openBtn);

    const right = el('div', 'group right');
    this.speedSel = el('select', 'speed');
    this.speedSel.title = '再生速度 ([ / ])';
    for (const s of SPEEDS) this.speedSel.appendChild(new Option(`${s}×`, String(s), s === 1, s === 1));
    this.speedSel.onchange = () => this.app.setSpeed(parseFloat(this.speedSel.value));
    this.volBtn = this.btn(ICON.vol, 'ミュート (M)', () => {
      this.app.audio.setMuted(!this.app.audio.muted);
      this.app.settingsChanged();
      this.sync();
    });
    const vol = el('input', 'vol') as HTMLInputElement;
    vol.type = 'range';
    vol.min = '0';
    vol.max = '1';
    vol.step = '0.01';
    vol.value = String(this.app.audio.volume);
    vol.title = '音量';
    vol.oninput = () => {
      this.app.audio.setVolume(parseFloat(vol.value));
      this.app.settingsChanged();
    };
    const lib = el('button', 'pill lib-btn', `${svg(NOTE_ICON, 17)}<span>ライブラリ</span>`);
    lib.title = '収録曲を選ぶ、またはお手元のMIDIファイルを開く (O)';
    lib.setAttribute('aria-label', 'ライブラリ');
    lib.onclick = (e) => {
      e.stopPropagation();
      this.library.toggle();
    };
    const gear = el('button', 'pill set-btn', `${svg(ICON.gear, 17)}<span>設定</span>`);
    gear.title = '設定：運指・照明・カメラ・サウンド・書き出し・デバッグ (A)';
    gear.setAttribute('aria-label', '設定');
    gear.onclick = (e) => {
      e.stopPropagation();
      this.toggleDrawer();
    };
    const live = el('button', 'live-btn', `${svg(KEYS_ICON, 17)}<span>ライブ演奏</span>`);
    live.title = 'MIDIキーボードやPCキーボードで演奏し、ロボットに弾かせます (K)';
    live.onclick = (e) => {
      e.stopPropagation();
      this.livePanel.toggle(true);
    };
    right.append(this.speedSel, this.volBtn, vol, lib, live, gear);
    row.append(left, mid, right);
    this.bar.append(scrub, row);
    r.appendChild(this.bar);
    this.bindScrub();

    this.drawer = el('div', 'drawer');
    const tabs = el('div', 'tabs');
    for (const [id, label] of [
      ['fingering', '運指'],
      ['light', '照明'],
      ['camera', 'カメラ'],
      ['sound', 'サウンド'],
      ['export', '書き出し'],
      ['debug', 'デバッグ'],
    ] as const) {
      const b = el('button', 'tab', label);
      b.dataset.tab = id;
      b.onclick = () => {
        this.tab = id;
        this.renderDrawer();
      };
      tabs.appendChild(b);
    }
    const close = el('button', 'close', '×');
    close.title = '閉じる';
    close.onclick = () => this.toggleDrawer(false);
    tabs.appendChild(close);
    this.drawerBody = el('div', 'drawer-body');
    this.drawer.append(tabs, this.drawerBody);
    r.appendChild(this.drawer);

    this.debugInfo = el('div', 'debug-info');
    r.appendChild(this.debugInfo);
    this.toastEl = el('div', 'toast');
    r.appendChild(this.toastEl);
    this.library = new LibrarySheet(this.app, r, { pickFile: () => this.pickFile(), toast: (m, ms) => this.toast(m, ms) });
    this.livePanel = new LivePanel(this.app, r, {
      openSettings: () => {
        this.tab = 'light';
        this.toggleDrawer(true);
      },
      closeOverlays: () => {
        this.library.close();
        this.toggleDrawer(false);
      },
    });

    this.bindDrop();
    this.bindKeys();
    this.bindIdle();
    this.app.on((what) => this.onApp(what));
    this.sync();
    this.renderTitle();
  }

  private btn(icon: string, title: string, fn: () => void, cls = '') {
    const b = el('button', `icon ${cls}`, svg(icon));
    b.title = title;
    b.setAttribute('aria-label', title);
    b.onclick = (e) => {
      e.stopPropagation();
      fn();
    };
    return b;
  }

  private onApp(what: string) {
    if (what === 'piece') {
      this.renderTitle();
      const p = this.app.piece;
      if (p?.perf.warnings.length) this.toast(p.perf.warnings.join(' · '));
      this.lastFingerRefresh = -1;
    }
    if (what === 'loading') this.renderTitle();
    if (what === 'live') this.livePanel?.sync();
    if (what === 'view' && this.drawer.classList.contains('open') && this.tab === 'camera') this.renderDrawer();
    this.library.refresh(what);
    if (what === 'quality')
      this.toast(`滑らかな再生を保つため画質を「${QUALITY_LABEL[this.app.view.post.quality] ?? this.app.view.post.quality}」に下げました（設定 → カメラで変更可）`, 6000);
    if (what === 'audio-locked') this.toast('画面をクリックまたはキーを押すと音声がオンになります', 8000);
    if (what === 'audio-unlocked') this.toast('');
    if (what === 'audio') {
      const s = this.app.audio.status;
      if (s === 'loading') this.toast('ピアノを調律中…');
      if (s === 'synth') this.toast('ピアノ音源を読み込めないため、内蔵シンセ音源で再生します');
      if (s === 'samples') this.toast('');
    }
    this.sync();
  }

  sync() {
    const a = this.app;
    const d = a.duration || 1;
    const pk = a.playing ? 'pause' : 'play';
    if (this.playBtn.dataset.icon !== pk) {
      this.playBtn.dataset.icon = pk;
      this.playBtn.innerHTML = svg(a.playing ? ICON.pause : ICON.play);
    }
    this.playBtn.classList.toggle('loading', a.playing && a.audio.status === 'loading');
    this.timeLabel.textContent = `${fmt(a.t)} / ${fmt(d)}`;
    const u = Math.min(1, a.t / d);
    this.fill.style.width = `${u * 100}%`;
    this.handle.style.left = `${u * 100}%`;
    const auto = a.camView === 'cinematic';
    this.autoBtn.classList.toggle('on', auto);
    this.autoBtn.setAttribute('aria-pressed', String(auto));
    const name = a.shotName();
    if (this.shotLabel.textContent !== name) {
      this.shotLabel.textContent = name;
      this.shotLabel.title = auto ? `現在: ${name}（自動編集／左右ボタンでショット固定）` : `固定中: ${name}`;
    }
    this.shotLabel.classList.toggle('held', !auto);
    const open = a.view.look.openPiano;
    if (this.openBtn.dataset.open !== String(open)) {
      this.openBtn.dataset.open = String(open);
      this.openBtn.innerHTML = `${svg(open ? ICON.pianoOpen : ICON.pianoClosed, 17)}<span>${open ? 'ピアノを閉じる' : 'ピアノを開く'}</span>`;
      this.openBtn.title = `${open ? 'ピアノを閉じる：前面パネルを元に戻します' : 'ピアノを開く：前面パネルを外してハンマーや弦を見せます'} (I)`;
      this.openBtn.setAttribute('aria-pressed', String(open));
      this.openBtn.classList.toggle('on', open);
    }
    const vk = a.audio.muted ? 'mute' : 'vol';
    if (this.volBtn.dataset.icon !== vk) {
      this.volBtn.dataset.icon = vk;
      this.volBtn.innerHTML = svg(a.audio.muted ? ICON.mute : ICON.vol);
    }
    this.speedSel.value = String(a.speed);
    document.body.classList.toggle('playing', a.playing);
    if (this.drawer.classList.contains('open')) {
      const bucket = Math.floor(a.t * 2);
      if (this.tab === 'fingering' && bucket !== this.lastFingerRefresh) {
        this.lastFingerRefresh = bucket;
        this.renderDrawer();
      }
    }
    if (a.debug?.visible) this.renderDebugInfo();
    this.debugInfo.style.display = a.debug?.visible ? 'block' : 'none';
  }

  private renderTitle() {
    const p = this.app.piece;
    if (!p) return;
    const approx = p.perf.stats.approximated;
    const year = p.source.kind === 'library' ? entryById(p.source.id)?.year : undefined;
    const ld = this.app.loading;
    const same = ld && ld.source.kind === p.source.kind && ld.source.id === p.source.id;
    const next = ld
      ? `<div class="next"><div class="next-l">${same ? '演奏を再計画中…' : `Next · <em>${escapeHtml(ld.title)}</em>`}</div><div class="next-bar"><i style="width:${(Math.max(0.03, ld.fraction) * 100).toFixed(1)}%"></i></div><div class="next-s">${escapeHtml(ld.label)}</div></div>`
      : '';
    const key = `${p.source.kind}:${p.source.id}|${p.title}|${approx}|${next}`;
    if (this.title.dataset.key === key) return;
    this.title.dataset.key = key;
    this.title.classList.toggle('busy', !!ld);
    this.title.innerHTML = `<div class="eyebrow">${escapeHtml(p.artist)}${year ? ` · ${year}` : ''}</div><button class="name" title="別の曲を選ぶ (O)">${escapeHtml(p.title)}<span class="chev" aria-hidden="true">${svg('<path d="M7 10l5 5 5-5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>', 18)}</span></button>${
      approx ? `<div class="note">${approx}音を簡易調整（ロボットの可動域を超えるため）</div>` : ''
    }${next}`;
    (this.title.querySelector('.name') as HTMLButtonElement).onclick = () => this.library.toggle(true);
  }

  toast(msg: string, ms = 4200) {
    this.toastEl.textContent = msg;
    this.toastEl.classList.toggle('show', !!msg);
    if (msg) setTimeout(() => this.toastEl.textContent === msg && this.toastEl.classList.remove('show'), ms);
  }

  private bindScrub() {
    const at = (e: PointerEvent) => {
      const r = this.track.getBoundingClientRect();
      return Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * this.app.duration;
    };
    this.track.addEventListener('pointerdown', (e) => {
      this.track.setPointerCapture(e.pointerId);
      this.app.beginScrub();
      this.app.seek(at(e));
      this.track.classList.add('drag');
    });
    this.track.addEventListener('pointermove', (e) => {
      const t = at(e);
      const r = this.track.getBoundingClientRect();
      this.hoverTip.textContent = fmt(t);
      this.hoverTip.style.left = `${((t / (this.app.duration || 1)) * r.width).toFixed(0)}px`;
      if (this.track.classList.contains('drag')) this.app.seek(t);
    });
    const end = () => {
      if (!this.track.classList.contains('drag')) return;
      this.track.classList.remove('drag');
      this.app.endScrub();
    };
    this.track.addEventListener('pointerup', end);
    this.track.addEventListener('pointercancel', end);
  }

  private pickFile() {
    const inp = el('input') as HTMLInputElement;
    inp.type = 'file';
    inp.accept = '.mid,.midi,audio/midi,audio/x-midi';
    inp.onchange = () => inp.files?.[0] && this.loadFile(inp.files[0]);
    inp.click();
  }

  private async loadFile(f: File) {
    try {
      const { bytes, parsed } = this.app.readFile(await f.arrayBuffer(), f.name);
      const melodic = parsed.tracks.filter((t) => t.noteCount > 0 && t.instrument !== 'percussion');
      if (!melodic.length) throw new Error('このファイルには音符が見つかりませんでした');
      this.library.close();
      if (melodic.length > 1) this.trackDialog(parsed, (tracks) => this.app.openFile(bytes, parsed, f.name, tracks));
      else this.perform(this.app.openFile(bytes, parsed, f.name), f.name);
    } catch (e) {
      this.toast(`${f.name} を読み込めませんでした: ${e instanceof Error ? e.message : e}`, 6000);
    }
  }

  private perform(job: Promise<void>, name: string) {
    job.catch((e) => this.toast(`${name} を演奏できませんでした: ${e instanceof Error ? e.message : e}`, 6000));
  }

  private trackDialog(parsed: ParsedMidi, go: (tracks: number[]) => Promise<void>, current?: number[]) {
    const back = el('div', 'modal-back');
    const box = el('div', 'modal');
    box.innerHTML = `<h3>${escapeHtml(parsed.name)}</h3><p>演奏するパートを選択してください。ピアノパートが自動選択されています（通常2トラックが右手・左手です）。</p>`;
    const list = el('div', 'track-list');
    const checks: [TrackInfo, HTMLInputElement][] = [];
    const sel = new Set(current ?? parsed.tracks.filter((t) => t.isPiano).map((t) => t.index));
    if (!sel.size) parsed.tracks.filter((t) => t.noteCount > 0 && t.instrument !== 'percussion').forEach((t) => sel.add(t.index));
    for (const t of parsed.tracks) {
      if (!t.noteCount) continue;
      const row = el('label', 'track-row');
      const cb = el('input') as HTMLInputElement;
      cb.type = 'checkbox';
      cb.checked = sel.has(t.index);
      cb.disabled = t.instrument === 'percussion';
      row.append(cb, el('span', 'tname', escapeHtml(t.name)), el('span', 'tmeta', `${escapeHtml(t.instrument)} · ${t.noteCount}音 · ${noteName(t.minMidi)}–${noteName(t.maxMidi)}`));
      list.appendChild(row);
      checks.push([t, cb]);
    }
    const perform = el('button', 'primary', '演奏する');
    const update = () => (perform.disabled = !checks.some(([, c]) => c.checked));
    for (const [, c] of checks) c.onchange = update;
    update();
    perform.onclick = () => {
      const tracks = checks.filter(([, c]) => c.checked).map(([t]) => t.index);
      back.remove();
      if (!tracks.length) return;
      this.perform(go(tracks), parsed.name);
    };
    const cancel = el('button', '', 'キャンセル');
    cancel.onclick = () => back.remove();
    const actions = el('div', 'actions');
    actions.append(cancel, perform);
    box.append(list, actions);
    back.appendChild(box);
    back.onclick = (e) => {
      if (e.target === back) back.remove();
    };
    this.root.appendChild(back);
  }

  private bindDrop() {
    const over = el('div', 'drop', '<div>MIDIファイルをドロップして演奏</div>');
    this.root.appendChild(over);
    let depth = 0;
    window.addEventListener('dragenter', (e) => {
      e.preventDefault();
      depth++;
      over.classList.add('show');
    });
    window.addEventListener('dragleave', () => {
      depth = Math.max(0, depth - 1);
      if (!depth) over.classList.remove('show');
    });
    window.addEventListener('dragover', (e) => e.preventDefault());
    window.addEventListener('drop', (e) => {
      e.preventDefault();
      depth = 0;
      over.classList.remove('show');
      const f = e.dataTransfer?.files?.[0];
      if (f) void this.loadFile(f);
    });
  }

  private bindKeys() {
    window.addEventListener('keydown', (e) => {
      if (this.livePanel.active && !(e.target as HTMLElement).closest('select, textarea, input[type="text"]')) {
        if (e.key === 'Escape' && this.drawer.classList.contains('open')) this.toggleDrawer(false);
        else if (this.livePanel.onKey(e)) e.preventDefault();
        return;
      }
      if ((e.target as HTMLElement).closest('input, select, textarea')) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const a = this.app;
      if (e.code === 'KeyK' && !this.library.isOpen && !document.querySelector('.modal-back')) {
        this.livePanel.toggle(true);
        return;
      }
      if (e.key === 'Escape') {
        if (document.querySelector('.modal-back')) document.querySelector('.modal-back')!.remove();
        else if (this.library.isOpen) this.library.close();
        else if (this.drawer.classList.contains('open')) this.toggleDrawer(false);
        return;
      }
      if (e.key === 'o' || e.key === 'O') {
        this.library.toggle();
        return;
      }
      if (this.library.isOpen) return;
      switch (e.key) {
        case ' ':
          e.preventDefault();
          a.toggle();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          if (e.shiftKey) a.seek(a.t - 1);
          else a.step(-1);
          break;
        case 'ArrowRight':
          e.preventDefault();
          if (e.shiftKey) a.seek(a.t + 1);
          else a.step(1);
          break;
        case 'Home':
          a.seek(0);
          break;
        case 'End':
          a.seek(a.duration);
          break;
        case '1':
          a.setCamera('cinematic');
          break;
        case '2':
          a.setCamera('follow');
          break;
        case '3':
          a.setCamera('overhead');
          break;
        case '4':
          a.setCamera('macro');
          break;
        case ',':
        case '<':
          a.stepShot(-1);
          break;
        case '.':
        case '>':
          a.stepShot(1);
          break;
        case 'i':
        case 'I':
          a.setOpen(!a.view.look.openPiano);
          this.toast(a.view.look.openPiano ? 'ピアノを開きました' : 'ピアノを閉じました', 1600);
          if (this.drawer.classList.contains('open') && this.tab === 'camera') this.renderDrawer();
          break;
        case 'd':
        case 'D':
          a.setDebug(!a.debug.visible);
          break;
        case 'a':
        case 'A':
          this.toggleDrawer();
          break;
        case 'n':
        case 'N':
          a.view.look.neonNotesOn = !a.view.look.neonNotesOn;
          a.settingsChanged();
          this.toast(a.view.look.neonNotesOn ? '空間ネオン音符: ON' : '空間ネオン音符: OFF', 1600);
          if (this.drawer.classList.contains('open') && this.tab === 'light') this.renderDrawer();
          break;
        case 'm':
        case 'M':
          a.audio.setMuted(!a.audio.muted);
          break;
        case 's':
        case 'S': {
          const i = STYLES.findIndex((s) => s.id === a.view.look.style);
          const st = a.setStyle(STYLES[(i + (e.shiftKey ? STYLES.length - 1 : 1)) % STYLES.length].id);
          this.toast(`Style: ${st.name}`, 1600);
          if (this.drawer.classList.contains('open') && this.tab === 'light') this.renderDrawer();
          break;
        }
        case '[':
        case ']': {
          const i = SPEEDS.indexOf(a.speed);
          const j = Math.max(0, Math.min(SPEEDS.length - 1, i + (e.key === ']' ? 1 : -1)));
          a.setSpeed(SPEEDS[j]);
          break;
        }
        default:
          return;
      }
      this.wake();
      this.sync();
    });
  }

  private bindIdle() {
    const wake = () => this.wake();
    window.addEventListener('pointermove', wake);
    window.addEventListener('pointerdown', wake);
    this.wake();
  }

  private wake() {
    document.body.classList.remove('idle');
    clearTimeout(this.idleTimer);
    this.idleTimer = window.setTimeout(() => {
      if (this.app.playing && !this.drawer.classList.contains('open') && !this.app.live) document.body.classList.add('idle');
    }, 2600);
  }

  private toggleDrawer(force?: boolean) {
    const open = force ?? !this.drawer.classList.contains('open');
    this.drawer.classList.toggle('open', open);
    document.body.classList.toggle('drawer-open', open);
    if (open) this.renderDrawer();
  }

  private renderDrawer() {
    for (const b of this.drawer.querySelectorAll<HTMLButtonElement>('.tab')) b.classList.toggle('on', b.dataset.tab === this.tab);
    const body = this.drawerBody;
    body.innerHTML = '';
    if (this.tab === 'fingering') this.renderFingering(body);
    else if (this.tab === 'light') this.renderLight(body);
    else if (this.tab === 'camera') this.renderCamera(body);
    else if (this.tab === 'sound') this.renderSound(body);
    else if (this.tab === 'export') this.renderExport(body);
    else this.renderDebugTab(body);
  }

  private renderFingering(body: HTMLElement) {
    const p = this.app.piece;
    if (!p) return;
    const t = this.app.t;
    const s = p.perf.stats;
    const head = el('div', 'fing-head');
    head.innerHTML = `<div>曲全体の運指を自動計算しています。ここで手や指を変更すると、その指定に合わせて演奏を再計画します。</div>
      <div class="stats">${p.perf.notes.length}音 · 手動変更 ${p.overrides.size}件 · 簡易調整 ${s.approximated}件 · 解析 ${s.planningMs.toFixed(0)} ms</div>`;
    const acts = el('div', 'actions small');
    const clear = el('button', '', '初期値に戻す');
    clear.title = 'すべての手・指の手動変更をリセット';
    clear.disabled = !p.overrides.size;
    clear.onclick = () => this.app.clearOverrides();
    const exp = el('button', '', '書き出し');
    exp.onclick = () => {
      const blob = new Blob([this.app.exportOverrides()], { type: 'application/json' });
      const a = el('a') as HTMLAnchorElement;
      a.href = URL.createObjectURL(blob);
      a.download = `${p.perf.score.name}-fingering.json`;
      a.click();
    };
    const imp = el('button', '', '読み込み');
    imp.onclick = () => {
      const inp = el('input') as HTMLInputElement;
      inp.type = 'file';
      inp.accept = '.json,application/json';
      inp.onchange = async () => {
        const f = inp.files?.[0];
        if (f) this.app.importOverrides(await f.text());
      };
      inp.click();
    };
    acts.append(clear, exp, imp);
    if (p.parsed.tracks.filter((tr) => tr.noteCount > 0).length > 1) {
      const tracks = el('button', '', 'トラック選択…');
      tracks.onclick = () => this.trackDialog(p.parsed, (sel) => this.app.selectTracks(sel), p.tracks);
      acts.appendChild(tracks);
    }
    head.appendChild(acts);
    body.appendChild(head);
    const notes = p.perf.notes.filter((n) => n.start > t - 1.2 && n.start < t + 3.5).slice(0, 48);
    const list = el('div', 'fing-list');
    if (!notes.length) list.appendChild(el('div', 'empty', '再生位置の付近に音符がありません。'));
    for (const n of notes) list.appendChild(this.noteRow(n, t));
    body.appendChild(list);
  }

  private noteRow(n: PerformanceNote, t: number) {
    const row = el('div', 'note-row');
    if (n.start <= t && t <= n.end) row.classList.add('now');
    const time = el('button', 'ntime', n.start.toFixed(2));
    time.title = 'この音符の位置へ移動';
    time.onclick = () => this.app.seek(n.start - 0.25);
    const name = el('span', 'nname', noteName(n.midi));
    const hands = el('span', 'seg2');
    for (const h of ['L', 'R'] as Hand[]) {
      const b = el('button', h === n.hand ? 'on' : '', h);
      b.title = h === 'L' ? '左手' : '右手';
      b.onclick = () => this.app.setOverride(n.id, { hand: h, finger: undefined });
      hands.appendChild(b);
    }
    const fingers = el('span', 'seg5');
    for (let f = 1; f <= 5; f++) {
      const b = el('button', f === n.finger ? 'on' : '', String(f));
      b.title = ['', '親指 (1)', '人差し指 (2)', '中指 (3)', '薬指 (4)', '小指 (5)'][f];
      b.onclick = () => this.app.setOverride(n.id, { finger: f as Finger, hand: n.hand });
      fingers.appendChild(b);
    }
    const flags = el('span', 'nflags');
    const shown = n.flags.filter((f) => f !== 'track-hand');
    flags.textContent = shown.map((f) => FLAG_LABEL[f] ?? f).join(' ');
    flags.title = shown.join(', ');
    if (n.flags.includes('hand-override') || n.flags.includes('finger-override')) row.classList.add('override');
    row.append(time, name, hands, fingers, flags);
    return row;
  }

  private slider(body: HTMLElement, label: string, min: number, max: number, step: number, get: () => number, set: (v: number) => void, fmt = (v: number) => v.toFixed(2)) {
    const row = el('label', 'slider');
    const lab = el('span', '', label);
    const inp = el('input') as HTMLInputElement;
    inp.type = 'range';
    inp.min = String(min);
    inp.max = String(max);
    inp.step = String(step);
    inp.value = String(get());
    const val = el('span', 'val', fmt(get()));
    inp.oninput = () => {
      set(parseFloat(inp.value));
      val.textContent = fmt(parseFloat(inp.value));
      this.app.settingsChanged();
    };
    row.append(lab, inp, val);
    body.appendChild(row);
    return row;
  }

  private sectionToggle(body: HTMLElement, title: string, get: () => boolean, set: (v: boolean) => void): (rows: HTMLElement[]) => void {
    const head = el('label', 'sec sec-toggle');
    const cb = el('input') as HTMLInputElement;
    cb.type = 'checkbox';
    cb.className = 'switch';
    cb.checked = get();
    cb.setAttribute('aria-label', `${title}のオン／オフ`);
    head.append(el('span', '', title), cb);
    body.appendChild(head);
    let rows: HTMLElement[] = [];
    const dim = () => rows.forEach((r) => r.classList.toggle('off', !cb.checked));
    cb.onchange = () => {
      set(cb.checked);
      dim();
      this.app.settingsChanged();
    };
    return (r) => {
      rows = r;
      dim();
    };
  }

  private resetButton(body: HTMLElement, reset: () => void, extra?: HTMLElement) {
    const acts = el('div', 'actions small');
    const b = el('button', '', '初期値に戻す');
    b.onclick = () => {
      reset();
      this.app.settingsChanged();
      this.renderDrawer();
    };
    acts.append(b);
    if (extra) acts.append(extra);
    body.appendChild(acts);
  }

  private renderSound(body: HTMLElement) {
    const a = this.app;
    const audio = a.audio;
    body.appendChild(el('div', 'sec', '空間・響き'));
    const room = el('select') as HTMLSelectElement;
    for (const [id, r] of Object.entries(ROOMS)) room.appendChild(new Option(r.label, id, id === audio.room, id === audio.room));
    room.onchange = () => {
      audio.setReverb(audio.reverb, room.value as RoomId);
      a.settingsChanged();
    };
    const row = el('label', 'slider');
    row.append(el('span', '', '残響タイプ'), room);
    body.appendChild(row);
    this.slider(body, 'リバーブ量', 0, 1, 0.01, () => audio.reverb, (v) => audio.setReverb(v), (v) => `${Math.round(v * 100)}%`);
    body.appendChild(el('div', 'sec', '出力'));
    this.slider(body, '音量', 0, 1, 0.01, () => audio.volume, (v) => audio.setVolume(v), (v) => `${Math.round(v * 100)}%`);
    this.slider(body, '映像同期補正', -150, 150, 5, () => a.syncMs, (v) => (a.syncMs = v), (v) => (v === 0 ? '0' : `${v > 0 ? '+' : ''}${v.toFixed(0)} ms`));
    body.appendChild(el('p', 'note', 'Bluetoothイヤホン等で音に対して手が遅れて見える場合は右へ、早く見える場合は左へ調整してください。'));
    body.appendChild(
      el('p', 'note', '音源には FreePats の Upright Piano KW を使用しています。録音時の部屋の響きに加え、上の設定で空間リバーブを重ねます。'),
    );
    this.resetButton(body, () => a.applySound(DEFAULT_SOUND));
  }

  private renderLight(body: HTMLElement) {
    const a = this.app;
    const look = a.view.look;
    const L = () => a.lights;
    const sl = (label: string, min: number, max: number, step: number, get: () => number, set: (v: number) => void, fmt?: (v: number) => string) =>
      this.slider(body, label, min, max, step, get, set, fmt);
    body.appendChild(el('div', 'sec', 'Style'));
    const chips = el('div', 'chips');
    for (const st of STYLES) {
      const b = el('button', 'chip', st.name);
      b.title = st.blurb;
      b.classList.toggle('on', look.style === st.id);
      b.onclick = () => {
        a.setStyle(st.id);
        this.renderDrawer();
      };
      chips.appendChild(b);
    }
    body.appendChild(chips);
    const cur = STYLES.find((s) => s.id === look.style);
    if (cur) body.appendChild(el('p', 'note', `${cur.blurb} Sキーでスタイルを順に切り替えられます。下のスライダーでさらに微調整できます。`));

    body.appendChild(el('div', 'sec', '空間演出'));
    const neon = this.sectionToggle(body, '空間ネオン音符 (N)', () => look.neonNotesOn, (v) => (look.neonNotesOn = v));
    neon([sl('発光の強さ', 0.2, 2, 0.05, () => look.neonNotes, (v) => (look.neonNotes = v))]);
    this.sectionToggle(body, '舞う和紙楽譜（演奏＆ネオン連動）', () => look.floatingSheetsOn, (v) => (look.floatingSheetsOn = v))([]);

    body.appendChild(el('div', 'sec', 'ライティング'));
    sl('窓からの太陽光', 0, 1.8, 0.01, () => L().sun, (v) => a.setLights({ sun: v }));
    sl('太陽の色温度', -1, 1, 0.01, () => L().warmth, (v) => a.setLights({ warmth: v }), (v) => (v < 0 ? `寒色 ${(-v).toFixed(2)}` : v.toFixed(2)));
    sl('室内環境光', 0, 2.5, 0.01, () => L().fill, (v) => a.setLights({ fill: v }));
    sl('クールリム光', 0, 2.5, 0.01, () => L().rim, (v) => a.setLights({ rim: v }));
    sl('関節の発光', 0, 2, 0.01, () => look.glow, (v) => (look.glow = v));

    const shafts = this.sectionToggle(body, '光の筋（光芒）', () => L().shaftsOn, (v) => a.setLights({ shaftsOn: v }));
    shafts([sl('強さ', 0, 2, 0.01, () => L().shafts, (v) => a.setLights({ shafts: v }))]);

    const rake = this.sectionToggle(body, '斜光ライト', () => L().rakeOn, (v) => a.setLights({ rakeOn: v }));
    rake([
      sl('強さ', 0, 2, 0.01, () => L().rake, (v) => a.setLights({ rake: v })),
      sl('仰角', 2, 35, 0.5, () => L().rakeAngle, (v) => a.setLights({ rakeAngle: v }), (v) => `${v.toFixed(1)}°`),
      sl('方向', -80, 80, 1, () => L().rakeDir, (v) => a.setLights({ rakeDir: v }), (v) => `${v.toFixed(0)}°`),
    ]);

    const bounce = this.sectionToggle(body, '間接反射光', () => L().bounceOn, (v) => a.setLights({ bounceOn: v }));
    bounce([sl('強さ', 0, 1.5, 0.01, () => L().bounce, (v) => a.setLights({ bounce: v }))]);
    const ao = this.sectionToggle(body, '接地影 (AO)', () => look.aoOn, (v) => (look.aoOn = v));
    ao([sl('濃さ', 0, 1, 0.01, () => look.ao, (v) => (look.ao = v))]);
    this.sectionToggle(body, '塗装面の映り込み', () => look.reflectionsOn, (v) => (look.reflectionsOn = v))([]);
    if (a.view.post.quality === 'low') body.appendChild(el('p', 'note', '接地影と塗装面の映り込みは「標準」または「高画質」で有効になります。'));

    body.appendChild(el('div', 'sec', 'カラーグレーディング'));
    sl('露出', 0.4, 1.8, 0.01, () => look.exposure, (v) => (look.exposure = v));
    sl('コントラスト', 0.8, 1.7, 0.01, () => look.contrast, (v) => (look.contrast = v));
    sl('彩度', 0, 1.4, 0.01, () => look.saturation, (v) => (look.saturation = v));
    sl('色温度', -1, 1, 0.01, () => look.warmth, (v) => (look.warmth = v));
    sl('ハイライト抑え', 0, 2, 0.01, () => look.rolloff, (v) => (look.rolloff = v));
    sl('黒のフェード', 0, 1, 0.01, () => look.fade, (v) => (look.fade = v));
    sl('シアン残し', 0, 1, 0.01, () => look.accent, (v) => (look.accent = v));

    this.resetButton(body, () => {
      a.setStyle('golden');
      for (const k of ['aoOn', 'ao', 'reflectionsOn', 'neonNotesOn', 'neonNotes', 'floatingSheetsOn'] as const) (look as unknown as Record<string, unknown>)[k] = DEFAULT_LOOK[k];
    });
  }

  private renderExport(body: HTMLElement) {
    const a = this.app;
    const p = a.piece;
    if (!p) return;
    const film = this.film;
    body.appendChild(
      el(
        'p',
        'note',
        '現在のカメラ・スタイル・色調のまま、全フレームを高画質でオフライン描画してMP4動画に書き出します。UIやタイトルは映り込みません。',
      ),
    );
    body.appendChild(el('div', 'sec', 'アスペクト比'));
    const chips = el('div', 'chips');
    for (const [v, label] of [
      [16 / 9, '16:9'],
      [2.39, '2.39:1 シネスコ'],
      [1.85, '1.85:1'],
      [4 / 3, '4:3'],
      [1, '1:1'],
      [4 / 5, '4:5'],
      [9 / 16, '9:16 縦動画'],
    ] as [number, string][]) {
      const b = el('button', 'chip', label);
      b.classList.toggle('on', Math.abs(film.aspect - v) < 1e-3);
      b.onclick = () => {
        film.aspect = v;
        this.renderDrawer();
      };
      chips.appendChild(b);
    }
    body.appendChild(chips);
    const row = (label: string, ctl: HTMLElement) => {
      const r = el('label', 'slider');
      r.append(el('span', '', label), ctl);
      body.appendChild(r);
      return r;
    };
    const select = (opts: [string, string][], value: string, set: (v: string) => void) => {
      const s = el('select') as HTMLSelectElement;
      for (const [v, l] of opts) s.appendChild(new Option(l, v, v === value, v === value));
      s.onchange = () => {
        set(s.value);
        this.renderDrawer();
      };
      return s;
    };
    body.appendChild(el('div', 'sec', '動画設定'));
    row('解像度', select([['1920', '1080p (HD)'], ['2560', '1440p'], ['3840', '4K (UHD)']], String(film.longSide), (v) => (film.longSide = +v)));
    row('フレームレート', select([['24', '24 fps（映画調）'], ['30', '30 fps'], ['60', '60 fps']], String(film.fps), (v) => (film.fps = +v)));
    row(
      '書き出し範囲',
      select(
        [
          ['all', '曲全体'],
          ['here', `現在位置から (${fmt(a.t, false)})`],
        ],
        film.range,
        (v) => (film.range = v as 'all' | 'here'),
      ),
    );
    const { width, height } = exportSize(film.aspect, film.longSide);
    const t0 = film.range === 'here' ? a.t : 0;
    const t1 = a.duration;
    const mb = ((width * height * film.fps * 0.35 + 320000) * (t1 - t0)) / 8 / 1e6;
    body.appendChild(el('p', 'note', `${width} × ${height} / 長さ ${fmt(t1 - t0, false)} / 目安サイズ 約 ${mb < 1000 ? `${Math.round(mb)} MB` : `${(mb / 1000).toFixed(1)} GB`}`));

    const status = el('div', 'export-status');
    const bar = el('div', 'export-bar', '<i></i>');
    const label = el('div', 'export-label');
    status.append(bar, label);
    const acts = el('div', 'actions');
    const go = el('button', 'primary', this.filming ? '書き出し中…' : 'MP4を書き出す');
    go.disabled = !!this.filming;
    const cancel = el('button', '', 'キャンセル');
    cancel.hidden = !this.filming;
    cancel.onclick = () => this.filming?.abort();
    acts.append(cancel, go);
    body.append(acts, status);
    this.paintFilm = () => {
      const st = this.filmState;
      status.hidden = !st;
      if (!st) return;
      (bar.firstChild as HTMLElement).style.width = `${(Math.max(0.01, Math.min(1, st.f)) * 100).toFixed(1)}%`;
      label.textContent = st.text;
    };
    this.paintFilm();
    const show = (f: number, text: string) => {
      this.filmState = { f, text };
      this.paintFilm?.();
    };
    go.onclick = async () => {
      if (this.filming) return;
      const support = await exportSupport(width, height, film.fps);
      if (!support.video) {
        show(0, `このブラウザでは ${width} × ${height} の H.264 書き出しに対応していません。解像度を下げるか、Chrome / Edge / Safari をお試しください。`);
        return;
      }
      const ac = new AbortController();
      this.filming = ac;
      go.disabled = true;
      go.textContent = '書き出し中…';
      cancel.hidden = false;
      const name = `${p.artist} - ${p.title}`.replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 150);
      try {
        const res = await exportVideo(
          a,
          { aspect: film.aspect, longSide: film.longSide, fps: film.fps, t0, t1 },
          (pr) => {
            if (pr.stage === 'sound') show(0.01, 'ピアノ音声をレンダリング中…');
            else if (pr.stage === 'finishing') show(1, 'MP4ファイルを仕上げ中…');
            else show(pr.frame / pr.frames, `フレーム ${pr.frame} / ${pr.frames}${pr.eta !== null ? ` · 残り約 ${fmt(pr.eta, false)}` : ''}`);
          },
          ac.signal,
        );
        const filename = `${name} (${res.width}x${res.height} ${film.fps}fps).mp4`;
        show(1, `完了：${(res.blob.size / 1e6).toFixed(0)} MB${res.audio ? '' : '（音声エンコード非対応のため無音）'}。保存中…`);
        const saved = await saveFile(filename, res.blob);
        show(1, saved ? `${filename} を保存しました` : '保存されませんでした。');
      } catch (e) {
        show(0, (e as Error)?.name === 'AbortError' ? '書き出しをキャンセルしました。' : `書き出しに失敗しました: ${e instanceof Error ? e.message : e}`);
      } finally {
        this.filming = null;
        if (this.tab === 'export' && this.drawer.classList.contains('open')) this.renderDrawer();
      }
    };
  }

  private renderCamera(body: HTMLElement) {
    const a = this.app;
    const look = a.view.look;
    const f = () => a.framing;
    const sl = (label: string, min: number, max: number, step: number, get: () => number, set: (v: number) => void, fmt?: (v: number) => string) =>
      this.slider(body, label, min, max, step, get, set, fmt);

    if (a.piece && a.camView === 'cinematic') {
      const sh = a.piece.camera.director.shotAt(a.t);
      body.appendChild(
        el(
          'p',
          'note',
          `Cinematicモードではフレーズに合わせてショットを自動切替します。現在 ${sh.index + 1} / ${sh.count}「${escapeHtml(sh.name)}」。バーの ‹ ›（, / .）で単一ショットを固定でき、「ピアノを開く」で内部ショットも加わります。`,
        ),
      );
    } else if (a.piece) {
      body.appendChild(el('p', 'note', `「${escapeHtml(a.shotName())}」を固定して手を緩やかに追従中。バーの Cinematic（1）で自動編集に戻ります。`));
    }
    const drama = this.sectionToggle(body, 'カメラ演出', () => f().dramaOn, (v) => (a.framing.dramaOn = v));
    drama([sl('強さ', 0, 1, 0.01, () => f().drama, (v) => (a.framing.drama = v), (v) => `${Math.round(v * 100)}%`)]);
    body.appendChild(el('p', 'note', 'Follow / Overhead / Macro 視点で、盛り上がりでの緩やかな寄りや主旋律の手へのフォーカス移動を加えます。'));

    body.appendChild(el('div', 'sec', 'レンズ・質感'));
    sl('被写界深度（ボケ）', 0, 2, 0.01, () => look.dofScale, (v) => (look.dofScale = v));
    sl('ブルーム', 0, 2, 0.01, () => look.bloom, (v) => (look.bloom = v));
    sl('フィルム粒子', 0, 2, 0.01, () => look.grain, (v) => (look.grain = v));
    sl('周辺減光', 0, 2, 0.01, () => look.vignette, (v) => (look.vignette = v));

    const blur = this.sectionToggle(body, 'モーションブラー', () => look.motionBlurOn, (v) => (look.motionBlurOn = v));
    blur([sl('シャッター開角', 45, 270, 5, () => look.shutter, (v) => (look.shutter = v), (v) => `${v.toFixed(0)}°`)]);
    if (a.view.post.quality === 'low') body.appendChild(el('p', 'note', 'モーションブラーは「標準」または「高画質」で有効になります。'));

    const streaks = this.sectionToggle(body, 'アナモルフィック光条', () => look.streaksOn, (v) => (look.streaksOn = v));
    streaks([sl('強さ', 0, 2, 0.01, () => look.streaks, (v) => (look.streaks = v))]);

    const lb = this.sectionToggle(body, 'レターボックス黒帯', () => look.letterboxOn, (v) => (look.letterboxOn = v));
    const ar = el('select') as HTMLSelectElement;
    for (const [v, label] of [
      [2.39, '2.39 : 1 (Scope)'],
      [2.0, '2 : 1'],
      [1.85, '1.85 : 1 (Flat)'],
    ] as const)
      ar.appendChild(new Option(label, String(v), v === look.letterbox, v === look.letterbox));
    ar.onchange = () => {
      look.letterbox = parseFloat(ar.value);
      a.settingsChanged();
    };
    const arRow = el('label', 'slider');
    arRow.append(el('span', '', '比率'), ar);
    body.appendChild(arRow);
    lb([arRow]);

    body.appendChild(el('div', 'sec', '構図'));
    sl('距離', 0.6, 1.8, 0.01, () => f().distance, (v) => (a.framing.distance = v));
    sl('高さ', -0.08, 0.25, 0.005, () => f().height, (v) => (a.framing.height = v));
    sl('回り込み角', -0.6, 0.6, 0.01, () => f().angle, (v) => (a.framing.angle = v));
    sl('焦点距離', 0.6, 1.6, 0.01, () => f().focalScale, (v) => (a.framing.focalScale = v));

    const q = el('select') as HTMLSelectElement;
    for (const v of ['high', 'medium', 'low']) q.appendChild(new Option(`画質: ${QUALITY_LABEL[v]}`, v, v === a.view.post.quality, v === a.view.post.quality));
    q.onchange = () => {
      a.autoQuality = false;
      a.view.setQuality(q.value as 'high');
      a.renderNow();
    };
    this.resetButton(
      body,
      () => {
        a.framing = { ...DEFAULT_FRAMING };
        for (const k of ['dof', 'dofScale', 'bloom', 'grain', 'vignette', 'motionBlurOn', 'shutter', 'streaksOn', 'streaks', 'letterboxOn', 'letterbox'] as const)
          (look as unknown as Record<string, unknown>)[k] = DEFAULT_LOOK[k];
      },
      q,
    );
  }

  private renderDebugTab(body: HTMLElement) {
    const a = this.app;
    const row = el('label', 'check');
    const cb = el('input') as HTMLInputElement;
    cb.type = 'checkbox';
    cb.checked = a.debug.visible;
    cb.onchange = () => a.setDebug(cb.checked);
    row.append(cb, el('span', '', 'キネマティクス可視化を表示 (D)'));
    body.appendChild(row);
    body.appendChild(
      el(
        'div',
        'legend',
        `<div><i style="background:#5bd37a"></i>押鍵保持</div><div><i style="background:#ff8a3d"></i>打鍵</div><div><i style="background:#4cc9d6"></i>離鍵</div><div><i style="background:#f2c84b"></i>準備</div><div><i style="background:#8a8a8a"></i>待機</div><div><i style="background:#ff2020"></i>到達不可</div><p>リングは実際の指先、球は目標位置、平面リングは鍵盤の接点、軌跡線は手首の過去1秒〜未来2秒の軌道を示します。</p>`,
      ),
    );
    const p = a.piece;
    if (p) {
      const w = el('div', 'stats');
      w.innerHTML = p.perf.warnings.length ? p.perf.warnings.map(escapeHtml).join('<br>') : '簡易調整なし：すべての音符が手の可動域内に収まっています。';
      body.appendChild(w);
    }
    this.resetButton(body, () => a.setDebug(false));
  }

  private renderDebugInfo() {
    const a = this.app;
    const f = a.frame;
    const p = a.piece;
    if (!f || !p) return;
    const lines: string[] = [];
    lines.push(`t ${a.t.toFixed(3)} s   ${a.fps.toFixed(0)} fps   pedal ${(f.pedal * 100).toFixed(0)}%`);
    if (a.camView === 'cinematic') {
      const sh = p.camera.director.shotAt(a.t);
      lines.push(`shot ${sh.index + 1}/${sh.count}  ${sh.name}  ${sh.start.toFixed(1)}–${sh.end.toFixed(1)} s`);
    } else lines.push(`holding  ${a.shotName()}${typeof a.camView === 'object' ? `  (${a.camView.hand})` : ''}`);
    for (const h of ['L', 'R'] as Hand[]) {
      const hp = f.hands[h];
      lines.push(`${h} wrist ${hp.wrist.map((v) => (v * 1000).toFixed(0)).join(', ')} mm`);
      const fingers = [1, 2, 3, 4, 5].map((k) => {
        const st = hp.states[k];
        const n = st.note ?? st.next;
        const e = Math.hypot(st.tip[0] - st.target[0], st.tip[1] - st.target[1], st.tip[2] - st.target[2]) * 1000;
        return `  ${k} ${st.phase.padEnd(7)} ${n ? noteName(n.note.midi).padEnd(4) : '    '} ${e > 0.5 ? e.toFixed(1) + 'mm' : ''}`;
      });
      lines.push(...fingers);
    }
    const active = f.sounding.slice(0, 12).map((n) => `${noteName(n.midi)}·${n.hand}${n.finger}`);
    lines.push(`sounding: ${active.join(' ') || '—'}`);
    this.debugInfo.textContent = lines.join('\n');
  }
}

const FLAG_LABEL: Record<string, string> = {
  'hand-override': '✎H',
  'finger-override': '✎F',
  stretch: '↔',
  unreachable: '⚠',
  'finger-conflict': '⇄',
  'early-release': '↑',
  'chord-overflow': '✕',
  scale: 'scale',
  chromatic: 'chrom.',
  arpeggio: 'arp.',
  motif: 'motif',
};

export { FRAME_STEP };

async function saveFile(filename: string, blob: Blob): Promise<boolean> {
  const claude = (window as unknown as { claude?: { use(name: string): Promise<unknown> } }).claude;
  const downloads = claude ? ((await claude.use('downloads')) as { save(r: { filename: string; data: Blob }): Promise<unknown> } | null) : null;
  if (downloads) {
    try {
      await downloads.save({ filename, data: blob });
      return true;
    } catch {
      return false;
    }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 60000);
  return true;
}
