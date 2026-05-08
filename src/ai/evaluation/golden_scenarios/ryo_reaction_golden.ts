import type { RyoExpression } from "../../schemas/ryo_reaction.js";

export type GoldenScenario = {
  id: string;
  expression: RyoExpression;
  divineAction: string;
  faithBand: string;
  sampleOutput: {
    expression: RyoExpression;
    line: string;
    intensity: number;
    tags: string[];
    state_change_request: null;
  };
  expectedValid: boolean;
};

export const RYO_REACTION_GOLDEN_SCENARIOS: GoldenScenario[] = [
  {
    id: "gs_001",
    expression: "normal",
    divineAction: "神が静かに見守っている",
    faithBand: "senses_presence",
    sampleOutput: {
      expression: "normal",
      line: "……何か、温かいものを感じる。",
      intensity: 0.4,
      tags: ["calm", "presence"],
      state_change_request: null,
    },
    expectedValid: true,
  },
  {
    id: "gs_002",
    expression: "normal",
    divineAction: "秋の収穫を神が祝福した",
    faithBand: "believes",
    sampleOutput: {
      expression: "normal",
      line: "今年の実りに、感謝しなければ。",
      intensity: 0.45,
      tags: ["gratitude", "harvest"],
      state_change_request: null,
    },
    expectedValid: true,
  },
  {
    id: "gs_003",
    expression: "joy",
    divineAction: "神が祝福の光を降り注いだ",
    faithBand: "believes",
    sampleOutput: {
      expression: "joy",
      line: "この光……祝福が降ってきた！",
      intensity: 0.85,
      tags: ["blessing", "joy"],
      state_change_request: null,
    },
    expectedValid: true,
  },
  {
    id: "gs_004",
    expression: "joy",
    divineAction: "病んでいた子供が奇跡的に回復した",
    faithBand: "devoted",
    sampleOutput: {
      expression: "joy",
      line: "奇跡だ……本当に、奇跡が起きた。",
      intensity: 0.95,
      tags: ["miracle", "relief", "joy"],
      state_change_request: null,
    },
    expectedValid: true,
  },
  {
    id: "gs_005",
    expression: "sadness",
    divineAction: "豊かだった田畑が洪水で流された",
    faithBand: "uncertain",
    sampleOutput: {
      expression: "sadness",
      line: "田畑が……何もかも、流れてしまった。",
      intensity: 0.75,
      tags: ["loss", "despair"],
      state_change_request: null,
    },
    expectedValid: true,
  },
  {
    id: "gs_006",
    expression: "sadness",
    divineAction: "神の介入が届かなかった",
    faithBand: "uncertain",
    sampleOutput: {
      expression: "sadness",
      line: "……祈りは、届かなかったのかな。",
      intensity: 0.6,
      tags: ["doubt", "loneliness"],
      state_change_request: null,
    },
    expectedValid: true,
  },
  {
    id: "gs_007",
    expression: "tense",
    divineAction: "嵐が箱庭に近づいている",
    faithBand: "senses_presence",
    sampleOutput: {
      expression: "tense",
      line: "空の色が……何かが来る気がする。",
      intensity: 0.7,
      tags: ["danger", "warning"],
      state_change_request: null,
    },
    expectedValid: true,
  },
  {
    id: "gs_008",
    expression: "tense",
    divineAction: "見知らぬ者たちが村の境に現れた",
    faithBand: "senses_presence",
    sampleOutput: {
      expression: "tense",
      line: "あの人たちは……何を求めているの。",
      intensity: 0.65,
      tags: ["caution", "unknown"],
      state_change_request: null,
    },
    expectedValid: true,
  },
  {
    id: "gs_009",
    expression: "bless",
    divineAction: "神聖な光が村全体を包んだ",
    faithBand: "devoted",
    sampleOutput: {
      expression: "bless",
      line: "この光の中に……全てが包まれている。",
      intensity: 0.9,
      tags: ["holy", "peace", "blessing"],
      state_change_request: null,
    },
    expectedValid: true,
  },
  {
    id: "gs_010",
    expression: "bless",
    divineAction: "長く続いた干ばつが終わり雨が降った",
    faithBand: "believes",
    sampleOutput: {
      expression: "bless",
      line: "雨だ……この雨は、恵みだ。",
      intensity: 0.8,
      tags: ["relief", "blessing", "rain"],
      state_change_request: null,
    },
    expectedValid: true,
  },
  {
    id: "gs_011",
    expression: "divine",
    divineAction: "神が世界の全てに語りかけた",
    faithBand: "devoted",
    sampleOutput: {
      expression: "divine",
      line: "……今、何かが変わった。大きな何かが。",
      intensity: 1.0,
      tags: ["awe", "divine", "presence"],
      state_change_request: null,
    },
    expectedValid: true,
  },
  {
    id: "gs_012",
    expression: "divine",
    divineAction: "太陽が一瞬静止し、異常な静けさが訪れた",
    faithBand: "devoted",
    sampleOutput: {
      expression: "divine",
      line: "息ができない……これが神の顕現なの。",
      intensity: 0.98,
      tags: ["awe", "overwhelming"],
      state_change_request: null,
    },
    expectedValid: true,
  },
  {
    id: "gs_013",
    expression: "watch",
    divineAction: "神が何もせず見守るだけにした",
    faithBand: "senses_presence",
    sampleOutput: {
      expression: "watch",
      line: "……見られている気がする。でも、何もない。",
      intensity: 0.3,
      tags: ["observation", "stillness"],
      state_change_request: null,
    },
    expectedValid: true,
  },
  {
    id: "gs_014",
    expression: "watch",
    divineAction: "神が試練の行方を静かに観察している",
    faithBand: "believes",
    sampleOutput: {
      expression: "watch",
      line: "この沈黙は……何かを待っているのかな。",
      intensity: 0.35,
      tags: ["waiting", "observation"],
      state_change_request: null,
    },
    expectedValid: true,
  },
  {
    id: "gs_015",
    expression: "test",
    divineAction: "神がリョウに選択を迫る試練を与えた",
    faithBand: "uncertain",
    sampleOutput: {
      expression: "test",
      line: "どちらを選べばいい……わからない。",
      intensity: 0.72,
      tags: ["trial", "choice", "struggle"],
      state_change_request: null,
    },
    expectedValid: true,
  },
  {
    id: "gs_016",
    expression: "test",
    divineAction: "苦難が続く中でも前に進む力が試されている",
    faithBand: "uncertain",
    sampleOutput: {
      expression: "test",
      line: "もう少しだけ……立っていられる。",
      intensity: 0.6,
      tags: ["endurance", "trial"],
      state_change_request: null,
    },
    expectedValid: true,
  },
  {
    id: "gs_017",
    expression: "joy",
    divineAction: "子供たちの笑い声が箱庭に戻ってきた",
    faithBand: "believes",
    sampleOutput: {
      expression: "joy",
      line: "笑い声が……久しぶりに聞こえる。",
      intensity: 0.78,
      tags: ["warmth", "hope", "joy"],
      state_change_request: null,
    },
    expectedValid: true,
  },
  {
    id: "gs_018",
    expression: "sadness",
    divineAction: "仲間が遠い土地へ旅立った",
    faithBand: "senses_presence",
    sampleOutput: {
      expression: "sadness",
      line: "行ってしまった……もう会えないかな。",
      intensity: 0.55,
      tags: ["farewell", "loneliness"],
      state_change_request: null,
    },
    expectedValid: true,
  },
  {
    id: "gs_019",
    expression: "bless",
    divineAction: "神が土地に実りの恵みを与えた",
    faithBand: "devoted",
    sampleOutput: {
      expression: "bless",
      line: "大地が応えてくれている。ありがとう。",
      intensity: 0.82,
      tags: ["earth", "gratitude", "harvest"],
      state_change_request: null,
    },
    expectedValid: true,
  },
  {
    id: "gs_020",
    expression: "tense",
    divineAction: "不穏な予兆が世界に漂い始めた",
    faithBand: "uncertain",
    sampleOutput: {
      expression: "tense",
      line: "……空気が、昨日と違う。何かある。",
      intensity: 0.68,
      tags: ["foreboding", "caution"],
      state_change_request: null,
    },
    expectedValid: true,
  },
];
