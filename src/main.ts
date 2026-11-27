import './ui/styles.css';
import { App } from './app/App';
import { AppUI } from './ui/AppUI';

const STAFF_W = 540;
const loader = document.createElement('div');
loader.className = 'loader';
loader.innerHTML = `
  <div class="inner">
    <div class="eyebrow">Concert Automata · Opus 2026</div>
    <h1>Sonata Mechanica</h1>
    <div class="staff-loader" aria-hidden="true">
      <svg viewBox="0 0 ${STAFF_W} 118" preserveAspectRatio="xMidYMid meet">
        <defs>
          <clipPath id="staff-reveal">
            <rect class="reveal-rect" x="0" y="0" width="24" height="118" />
          </clipPath>
          <linearGradient id="gold-ink" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stop-color="#d7b47c" stop-opacity="0.72" />
            <stop offset="60%" stop-color="#f3dbb0" stop-opacity="0.98" />
            <stop offset="100%" stop-color="#7eeaf3" stop-opacity="0.95" />
          </linearGradient>
        </defs>
        <!-- ベースとなる淡い五線ガイド -->
        <g class="staff-guide" stroke="rgba(236,228,216,0.11)" stroke-width="0.9">
          <line x1="16" y1="24" x2="524" y2="24" />
          <line x1="16" y1="35" x2="524" y2="35" />
          <line x1="16" y1="46" x2="524" y2="46" />
          <line x1="16" y1="57" x2="524" y2="57" />
          <line x1="16" y1="68" x2="524" y2="68" />
        </g>
        <!-- ロード率に合わせて左から右へ描写される五線・ト音記号・音符・筆記体ミックス -->
        <g clip-path="url(#staff-reveal)">
          <g stroke="url(#gold-ink)" stroke-width="1.15" opacity="0.88">
            <line x1="16" y1="24" x2="524" y2="24" />
            <line x1="16" y1="35" x2="524" y2="35" />
            <line x1="16" y1="46" x2="524" y2="46" />
            <line x1="16" y1="57" x2="524" y2="57" />
            <line x1="16" y1="68" x2="524" y2="68" />
          </g>
          <!-- 左端：ト音記号 -->
          <text x="20" y="69" class="clef" fill="#f2d6a2">𝄞</text>
          <!-- 五線上に舞う繊細な音符とスラー -->
          <g fill="#f2d6a2" stroke="#f2d6a2" stroke-linecap="round">
            <!-- スラー1 -->
            <path d="M 74 52 Q 112 22 152 38" fill="none" stroke-width="1.1" opacity="0.7" />
            <!-- 8分音符ペア -->
            <ellipse cx="78" cy="57" rx="5.2" ry="3.5" transform="rotate(-24 78 57)" />
            <line x1="82.5" y1="56" x2="82.5" y2="27" stroke-width="1.25" />
            <ellipse cx="106" cy="46" rx="5.2" ry="3.5" transform="rotate(-24 106 46)" />
            <line x1="110.5" y1="45" x2="110.5" y2="19" stroke-width="1.25" />
            <path d="M 82.5 27 L 110.5 19" stroke-width="2.4" />
            <!-- スタッカート四分音符 -->
            <ellipse cx="148" cy="40.5" rx="5.2" ry="3.5" transform="rotate(-24 148 40.5)" />
            <line x1="152.5" y1="39.5" x2="152.5" y2="14" stroke-width="1.25" />
            <circle cx="148" cy="49.5" r="1.4" />
            <!-- 後半の音符＋連桁 -->
            <path d="M 382 40 Q 430 14 482 34" fill="none" stroke-width="1.1" opacity="0.7" />
            <ellipse cx="388" cy="46" rx="5.2" ry="3.5" transform="rotate(-24 388 46)" />
            <line x1="392.5" y1="45" x2="392.5" y2="18" stroke-width="1.25" />
            <ellipse cx="422" cy="35" rx="5.2" ry="3.5" transform="rotate(-24 422 35)" />
            <line x1="426.5" y1="34" x2="426.5" y2="11" stroke-width="1.25" />
            <path d="M 392.5 18 L 426.5 11" stroke-width="2.3" />
            <path d="M 392.5 23 L 426.5 16" stroke-width="1.7" />
            <!-- 白抜き二分音符 -->
            <ellipse cx="476" cy="40.5" rx="5.6" ry="3.7" transform="rotate(-24 476 40.5)" fill="none" stroke-width="1.5" />
            <line x1="481" y1="39.5" x2="481" y2="14" stroke-width="1.25" />
            <!-- 複縦線 -->
            <line x1="516" y1="24" x2="516" y2="68" stroke-width="1.1" opacity="0.85" />
            <line x1="521" y1="24" x2="521" y2="68" stroke-width="2.5" opacity="0.95" />
          </g>
          <!-- 五線に重なる優美な英語筆記体：created by tsuda -->
          <text x="272" y="96" text-anchor="middle" class="script-sig" fill="url(#gold-ink)">created by tsuda</text>
        </g>
        <!-- 描写の先端で光るペン先スパーク -->
        <circle class="pen-tip" cx="24" cy="46" r="2.6" fill="#7eeaf3" />
      </svg>
    </div>
    <div class="label"></div>
  </div>
`;
document.body.appendChild(loader);
const revealRect = loader.querySelector('.reveal-rect') as SVGRectElement;
const penTip = loader.querySelector('.pen-tip') as SVGCircleElement;
const label = loader.querySelector('.label') as HTMLDivElement;

const app = new App(document.getElementById('stage') as HTMLCanvasElement, document.getElementById('ui') as HTMLElement);
(window as unknown as { app: App }).app = app;
if (app.params.get('ui') === '0') {
  document.body.classList.add('shot');
  loader.remove();
}

app
  .start((f, text) => {
    const clamped = Math.max(0.04, Math.min(1, f));
    const w = 16 + clamped * (STAFF_W - 24);
    revealRect.setAttribute('width', w.toFixed(1));
    penTip.setAttribute('cx', w.toFixed(1));
    penTip.setAttribute('cy', (46 + Math.sin(clamped * Math.PI * 4) * 10).toFixed(1));
    penTip.style.opacity = clamped >= 0.99 ? '0' : '0.95';
    label.textContent = text;
  })
  .then(() => {
    const ui = new AppUI(app, document.getElementById('ui') as HTMLElement);
    ui.build();
    if (app.params.get('ui') !== '0' && app.params.get('play') !== '0') void app.play();
    loader.classList.add('done');
    setTimeout(() => loader.remove(), 1600);
  })
  .catch((e) => {
    console.error(e);
    label.textContent = '';
    app.fail(e);
  });
