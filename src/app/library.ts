// 収録曲ライブラリ：9曲のクラシック・ピアノ名曲をビルド時にインライン化して同梱します。
import fantaisieImpromptu from '../music/chopin-fantaisie-impromptu.mid?inline';
import laChevaleresque from '../music/burgmuller-la-chevaleresque.mid?inline';
import golliwoggsCakewalk from '../music/debussy-golliwoggs-cakewalk.mid?inline';
import arabesque from '../music/burgmuller-arabesque.mid?inline';
import newWorld from '../music/dvorak-new-world.mid?inline';
import vivaldiWinter from '../music/vivaldi-winter.mid?inline';
import moonlight3 from '../music/beethoven-moonlight-3.mid?inline';
import laCampanella from '../music/liszt-la-campanella.mid?inline';
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

/** 収録曲一覧（プログラム順・全9曲／フニクリ・フニクラを最後に配置） */
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
    id: 'new-world-4',
    title: '交響曲第9番「新世界より」第4楽章',
    artist: 'Antonín Dvořák',
    year: '1893',
    group: 'Classical',
    style: 'velvet-hall',
    blurb: 'Allegro con fuoco。力強い弦の刻みから金管の壮大な主題が轟く、劇的フィナーレのピアノ編。',
    bytes: fromDataUrl(newWorld),
  },
  {
    id: 'vivaldi-winter',
    title: '四季より「冬」第1楽章',
    artist: 'Antonio Vivaldi',
    year: '1725',
    group: 'Classical',
    style: 'winter-frost',
    blurb: 'ヴァイオリン協奏曲『四季』作品8 第4番 第1楽章 Allegro non molto。凍てつく風と鋭い刻みが疾走するバロックの名作ピアノ編。',
    bytes: fromDataUrl(vivaldiWinter),
  },
  {
    id: 'moonlight-3',
    title: '月光ソナタ 第3楽章',
    artist: 'Ludwig van Beethoven',
    year: '1801',
    group: 'Classical',
    style: 'moonlight',
    blurb: 'ピアノ・ソナタ第14番 嬰ハ短調 作品27-2 第3楽章 Presto agitato。嵐のように駆け上がる分散和音と激しい情熱の傑作。',
    bytes: fromDataUrl(moonlight3),
  },
  {
    id: 'la-campanella',
    title: 'ラ・カンパネラ',
    artist: 'Franz Liszt',
    year: '1851',
    group: 'Classical',
    style: 'bell-crystal',
    blurb: '『パガニーニによる大練習曲』第3番 嬰ト短調。高音域に澄んだ鐘の音が響き渡る超絶技巧の名曲。',
    bytes: fromDataUrl(laCampanella),
  },
  {
    id: 'funiculi-funicula',
    title: 'フニクリ・フニクラ',
    artist: 'Luigi Denza',
    year: '1880',
    group: 'Classical',
    style: 'napoli-sun',
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
