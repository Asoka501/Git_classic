// 収録曲ライブラリ：5曲のクラシック・ピアノ名曲をビルド時にインライン化して同梱します。
import fantaisieImpromptu from '../music/chopin-fantaisie-impromptu.mid?inline';
import laChevaleresque from '../music/burgmuller-la-chevaleresque.mid?inline';
import golliwoggsCakewalk from '../music/debussy-golliwoggs-cakewalk.mid?inline';
import arabesque from '../music/burgmuller-arabesque.mid?inline';
import funiculiFunicula from '../music/denza-funiculi-funicula.mid?inline';
import extra from 'virtual:extra-music';

export type LibraryGroup = 'Original' | 'Classical' | 'Songs';

export interface LibraryEntry {
  id: string;
  title: string;
  artist: string;
  year?: string;
  group: LibraryGroup;
  /** 選曲時に自動適用するビジュアルスタイルID */
  style?: string;
  blurb: string;
  bytes(): Uint8Array;
}

function fromDataUrl(url: string): () => Uint8Array {
  let cache: Uint8Array | null = null;
  return () => {
    if (cache) return cache;
    const b64 = url.slice(url.indexOf(',') + 1);
    const raw = atob(b64);
    const out = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
    return (cache = out);
  };
}

/** 収録曲一覧（プログラム順） */
const BUILT_IN: LibraryEntry[] = [
  {
    id: 'fantaisie-impromptu',
    title: '幻想即興曲',
    artist: 'Frédéric Chopin',
    year: '1834',
    group: 'Classical',
    style: 'moonlight',
    blurb: '嬰ハ短調 作品66。疾走する16分音符と左手の3連符が織りなす情熱的な主部と、甘美な中間部の対比が際立つ名曲。',
    bytes: fromDataUrl(fantaisieImpromptu),
  },
  {
    id: 'la-chevaleresque',
    title: '貴婦人の乗馬',
    artist: 'Friedrich Burgmüller',
    year: '1851',
    group: 'Classical',
    style: 'studio',
    blurb: '『25の練習曲』作品100 第25番。軽快なスタッカートと華やかなアルペジオで駆け抜けるフィナーレ。',
    bytes: fromDataUrl(laChevaleresque),
  },
  {
    id: 'golliwoggs-cakewalk',
    title: 'ゴリウォーグのケークウォーク',
    artist: 'Claude Debussy',
    year: '1908',
    group: 'Classical',
    style: 'golden',
    blurb: '組曲『子供の領分』第6曲。ラグタイム風のシンコペーションと軽妙なユーモアが弾ける代表作。',
    bytes: fromDataUrl(golliwoggsCakewalk),
  },
  {
    id: 'arabesque',
    title: 'アラベスク',
    artist: 'Friedrich Burgmüller',
    year: '1851',
    group: 'Classical',
    style: 'faded',
    blurb: '『25の練習曲』作品100 第2番。軽やかな16分音符の装飾音型と弾む和音が印象的な定番曲。',
    bytes: fromDataUrl(arabesque),
  },
  {
    id: 'funiculi-funicula',
    title: 'フニクリ・フニクラ',
    artist: 'Luigi Denza',
    year: '1880',
    group: 'Classical',
    style: 'golden',
    blurb: 'ヴェスヴィオ火山の登山鉄道開通を記念して作られた陽気なナポリ民謡のピアノソロ編。',
    bytes: fromDataUrl(funiculiFunicula),
  },
];

const GROUPS: LibraryGroup[] = ['Songs', 'Classical', 'Original'];
const EXTRA: LibraryEntry[] = extra.pieces.map(({ data, ...p }) => ({ ...p, bytes: fromDataUrl(data) }));
export const LIBRARY: LibraryEntry[] = [...EXTRA, ...BUILT_IN.filter((e) => !EXTRA.some((x) => x.id === e.id))]
  .map((e, i) => ({ e, i }))
  .sort((a, b) => GROUPS.indexOf(a.e.group) - GROUPS.indexOf(b.e.group) || a.i - b.i)
  .map(({ e }) => e);

/** デフォルト起動曲：幻想即興曲 */
export const DEFAULT_PIECE: string = extra.defaultPiece ?? 'fantaisie-impromptu';

export const entryById = (id: string) => LIBRARY.find((e) => e.id === id);
