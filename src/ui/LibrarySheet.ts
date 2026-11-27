// ライブラリ画面（コンサートプログラム風）：収録曲とユーザーが読み込んだMIDIファイルを管理します。
import type { App, PieceSource, UserFile } from '../app/App';
import { LIBRARY, type LibraryEntry, type LibraryGroup } from '../app/library';
import { el, escapeHtml, fmt, svg } from './dom';

export const NOTE_ICON =
  '<path d="M9 18a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0zM20 15.4a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0z"/><path d="M7.5 6.3 20 3.6v11.8h-1.5V7.6L9 9.7V18H7.5z"/>';
const PLUS_ICON = '<path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>';

const GROUPS: { id: LibraryGroup; label: string }[] = [
  { id: 'Songs', label: 'Songs' },
  { id: 'Classical', label: 'Classical' },
  { id: 'Original', label: 'Original Works' },
];

export class LibrarySheet {
  private back = el('div', 'library');
  private panel = el('div', 'lib-panel');
  private body = el('div', 'lib-body');
  private statusCells = new Map<string, HTMLElement>();
  private files: UserFile[] = [];
  private prepared = false;
  private statusQueued = false;
  private returnFocus: HTMLElement | null = null;

  constructor(
    private app: App,
    root: HTMLElement,
    private actions: { pickFile(): void; toast(msg: string, ms?: number): void },
  ) {
    this.back.setAttribute('role', 'dialog');
    this.back.setAttribute('aria-modal', 'true');
    this.back.setAttribute('aria-label', 'ライブラリ');
    const head = el('header', 'lib-head');
    head.innerHTML = `<div><div class="eyebrow">Sonata Mechanica</div><h2>Programme</h2></div>`;
    const open = el('button', 'lib-open', `${svg(PLUS_ICON, 16)}<span>MIDIファイルを開く</span>`);
    open.title = 'お手元のMIDIファイルを演奏します（画面にドラッグ＆ドロップでも読み込み可能）';
    open.onclick = () => this.actions.pickFile();
    const close = el('button', 'close', '×');
    close.title = '閉じる (Esc)';
    close.setAttribute('aria-label', 'ライブラリを閉じる');
    close.onclick = () => this.close();
    head.append(open, close);
    const foot = el(
      'footer',
      'lib-foot',
      '各楽曲の運指と動作は一度だけ解析され、このブラウザに保存されます。 <span><kbd>O</kbd> ライブラリ · <kbd>Esc</kbd> 閉じる</span>',
    );
    this.panel.append(head, this.body, foot);
    this.back.appendChild(this.panel);
    this.back.onclick = (e) => {
      if (e.target === this.back) this.close();
    };
    root.appendChild(this.back);
    this.app.planner.onStatus = () => this.queueStatus();
  }

  get isOpen() {
    return this.back.classList.contains('open');
  }

  toggle(force?: boolean) {
    if (force ?? !this.isOpen) this.open();
    else this.close();
  }

  open() {
    if (this.isOpen) return;
    this.returnFocus = document.activeElement as HTMLElement | null;
    document.body.classList.add('library-open');
    this.back.classList.add('open');
    void this.render().then(() => {
      const cur = this.body.querySelector<HTMLElement>('.lib-row.current') ?? this.body.querySelector<HTMLElement>('.lib-row');
      cur?.focus({ preventScroll: false });
    });
    if (!this.prepared) {
      this.prepared = true;
      this.app.prepareLibrary();
    }
  }

  close() {
    if (!this.isOpen) return;
    this.back.classList.remove('open');
    document.body.classList.remove('library-open');
    this.returnFocus?.focus?.();
  }

  refresh(what: string) {
    if (what === 'files') {
      void this.loadFiles().then(() => {
        if (this.isOpen) void this.render();
      });
    } else if (this.isOpen && (what === 'piece' || what === 'loading')) this.queueStatus();
  }

  private async loadFiles() {
    this.files = await this.app.userFiles();
  }

  private async render() {
    await this.loadFiles();
    this.body.innerHTML = '';
    this.statusCells.clear();
    let n = 0;
    for (const g of GROUPS) {
      if (!LIBRARY.some((x) => x.group === g.id)) continue;
      const sec = el('section', 'lib-sec');
      sec.appendChild(el('h3', 'sec', g.label));
      for (const e of LIBRARY.filter((x) => x.group === g.id)) sec.appendChild(this.entryRow(e, ++n));
      this.body.appendChild(sec);
    }
    const mine = el('section', 'lib-sec');
    mine.appendChild(el('h3', 'sec', 'あなたのMIDIファイル'));
    if (!this.files.length) {
      const empty = el('button', 'lib-empty');
      empty.innerHTML = `${svg(PLUS_ICON, 18)}<span><b>MIDIファイルを開く</b>か、画面のどこかにドロップしてください。すぐに解析・演奏され、このブラウザに保存されます。</span>`;
      empty.onclick = () => this.actions.pickFile();
      mine.appendChild(empty);
    }
    for (const f of this.files) mine.appendChild(this.fileRow(f));
    this.body.appendChild(mine);
    const credits = el('section', 'lib-sec lib-credits');
    credits.innerHTML = `<h3 class="sec">Credits</h3>
      <p>ピアノ音源: <a href="https://freepats.zenvoid.org/Piano/acoustic-grand-piano.html" target="_blank" rel="noopener">Upright Piano KW</a> (FreePats, CC0) / 離鍵ノイズ: <a href="https://archive.org/details/SalamanderGrandPianoV3" target="_blank" rel="noopener">Salamander Grand Piano V3</a> by Alexander Holm (<a href="https://creativecommons.org/licenses/by/3.0/" target="_blank" rel="noopener">CC BY 3.0</a>)</p>
      <p>収録MIDI: <a href="https://www.mutopiaproject.org/" target="_blank" rel="noopener">Mutopia Project</a> (Public Domain) および <a href="https://bitmidi.com/" target="_blank" rel="noopener">BitMidi</a>。使用ライブラリ: <a href="https://threejs.org" target="_blank" rel="noopener">three.js</a>, <a href="https://github.com/Tonejs/Midi" target="_blank" rel="noopener">@tonejs/midi</a>, <a href="https://github.com/Vanilagy/mp4-muxer" target="_blank" rel="noopener">mp4-muxer</a>。</p>`;
    this.body.appendChild(credits);
    await this.updateStatus();
  }

  private entryRow(e: LibraryEntry, n: number) {
    const info = this.app.entryInfo(e);
    const row = el('button', 'lib-row');
    row.dataset.key = `library:${e.id}`;
    row.innerHTML = `<span class="no">${String(n).padStart(2, '0')}</span>
      <span class="what"><span class="t">${escapeHtml(e.title)}</span><span class="a">${escapeHtml(e.artist)}${e.year ? ` · ${e.year}` : ''}</span><span class="b">${escapeHtml(e.blurb)}</span></span>
      <span class="len">${fmt(info.duration, false)}</span>`;
    const st = el('span', 'st');
    row.appendChild(st);
    this.statusCells.set(`library:${e.id}`, st);
    row.onclick = () => {
      this.close();
      if (this.isCurrent(`library:${e.id}`)) return;
      this.app.openEntry(e, undefined, true).catch((err) => this.actions.toast(`「${e.title}」を演奏できませんでした: ${err instanceof Error ? err.message : err}`, 6000));
    };
    return row;
  }

  private fileRow(f: UserFile) {
    const wrap = el('div', 'lib-file');
    const row = el('button', 'lib-row');
    row.dataset.key = `file:${f.id}`;
    const added = new Date(f.added).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' });
    row.innerHTML = `<span class="no">${svg(NOTE_ICON, 14)}</span>
      <span class="what"><span class="t">${escapeHtml(f.title)}</span><span class="a">${escapeHtml(f.name)} · ${escapeHtml(added)}追加</span></span>
      <span class="len"></span>`;
    const st = el('span', 'st');
    row.appendChild(st);
    this.statusCells.set(`file:${f.id}`, st);
    row.onclick = () => {
      this.close();
      if (this.isCurrent(`file:${f.id}`)) return;
      this.app.openUserFile(f).catch((err) => this.actions.toast(`「${f.title}」を演奏できませんでした: ${err instanceof Error ? err.message : err}`, 6000));
    };
    const rm = el('button', 'lib-remove', '×');
    rm.title = `${f.name} をこのブラウザから削除`;
    rm.setAttribute('aria-label', rm.title);
    rm.onclick = () => void this.app.forgetFile(f.id);
    wrap.append(row, rm);
    return wrap;
  }

  private isCurrent(key: string) {
    const s = this.app.piece?.source;
    return !!s && sourceKey(s) === key;
  }

  private queueStatus() {
    if (this.statusQueued || !this.isOpen) return;
    this.statusQueued = true;
    requestAnimationFrame(() => {
      this.statusQueued = false;
      void this.updateStatus();
    });
  }

  private async updateStatus() {
    const loading = this.app.loading;
    for (const [key, cell] of this.statusCells) {
      const row = cell.parentElement!;
      const current = this.isCurrent(key);
      row.classList.toggle('current', current);
      let html = '';
      if (current) html = `<span class="eq${this.app.playing ? ' on' : ''}"><i></i><i></i><i></i></span>再生中`;
      else if (key.startsWith('library:')) {
        const e = LIBRARY.find((x) => `library:${x.id}` === key)!;
        const opening = loading && sourceKey(loading.source) === key;
        const f = opening ? loading.fraction : await this.app.entryStatus(e);
        if (opening) html = `${ring(f ?? 0)}読み込み中`;
        else if (f === 1) html = '<span class="ready">準備完了</span>';
        else if (f !== null) html = `${ring(f)}解析中 ${Math.round(f * 100)}%`;
      } else if (loading && sourceKey(loading.source) === key) {
        html = `${ring(loading.fraction)}読み込み中`;
      }
      if (cell.innerHTML !== html) cell.innerHTML = html;
    }
  }
}

const sourceKey = (s: PieceSource) => `${s.kind}:${s.id}`;

function ring(f: number) {
  return `<span class="ring" style="--p:${Math.max(0.04, Math.min(1, f)).toFixed(3)}"></span>`;
}
