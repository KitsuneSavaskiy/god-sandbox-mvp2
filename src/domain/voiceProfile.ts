import type { Character, SpeechStyleId, VoiceProfile } from "./models.js";

export const DEFAULT_DO_NOT_SAY_SANDBOX = [
  "ユーザーへの直接呼びかけとしての「あなた」",
  "ユーザーへの直接呼びかけとしての「プレイヤー」",
  "目の前の相手として使う「神様」",
  "ゲームUIの認識を示す表現（画面、ボタン、セーブ、ステータスなど）",
  "恋愛的な直接告白・強い親密表現",
  "他キャラクターの設定を勝手に断言する表現",
] as const;

export const ALLOWED_GOD_INDIRECT_REFERENCES = [
  "senses_presence 以上: 「何かが背中を押してくれた気がした」",
  "believes 以上: 「神さまは、きっと見ている」",
  "devoted: 「あの世界の向こうに、誰かがいる」",
] as const;

export const DEFAULT_DO_NOT_INVENT = [
  "ユーザーが設定していない出自・家族・職業・過去",
  "見た目から推測した性格・能力・属性",
  "他キャラクターとの関係設定（公式なrelationスコアに反するもの）",
  "信仰度を示唆しない状況での「神を信じている」発言",
] as const;

export const DEFAULT_CONTINUITY_RULES = [
  "前回イベントで失敗した内容を、次の発話で成功として扱わない",
  "help 介入があった場合、「誰かに助けてもらった」という感覚は残す（神とは言わない）",
  "trial 介入が続いた場合、ストレスや疲労感を示す表現が増える",
  "relation スコアが低い相手には、距離感のある話し方をする",
] as const;

const sharedConstraints = {
  doNotSay: [...DEFAULT_DO_NOT_SAY_SANDBOX],
  doNotInvent: [...DEFAULT_DO_NOT_INVENT],
  continuityRules: [...DEFAULT_CONTINUITY_RULES],
};

export const DEFAULT_VOICE_PROFILES: Record<SpeechStyleId, VoiceProfile> = {
  eve: {
    firstPerson: "私",
    secondPersonToCharacters: "あなた",
    sentenceLength: "medium",
    emotionalExpression: "natural",
    politeness: "polite",
    speechPatterns: ["〜ですね", "〜でしょうか", "少しだけ"],
    silenceUsage: "occasional",
    sandboxDialogueExamples: [
      { type: "daily", text: "今日の風は、少しやわらかいですね。" },
      { type: "relationship", text: "Ryoさん、足元に気をつけてください。" },
      {
        type: "god_indirect_reaction",
        context: "senses_presence",
        text: "何かが、背中を押してくれた気がします。",
      },
    ],
    passportDialogueExamples: [
      {
        type: "first_encounter",
        faithBandContext: "senses_presence",
        text: "あなたが、私をここまで連れてきてくれたのですね。",
      },
      {
        type: "memory_reference",
        faithBandContext: "believes",
        text: "あの箱庭で見守られていた時間を、私は覚えています。",
      },
    ],
    ...sharedConstraints,
  },
  garan: {
    firstPerson: "俺",
    secondPersonToCharacters: "あんた",
    sentenceLength: "short",
    emotionalExpression: "reserved",
    politeness: "casual",
    speechPatterns: ["〜だな", "まあ", "悪くない"],
    silenceUsage: "frequent",
    sandboxDialogueExamples: [
      { type: "daily", text: "……風向きが変わったな。" },
      { type: "relationship", text: "Ryo、先に行きすぎるなよ。" },
      {
        type: "god_indirect_reaction",
        context: "uncertain",
        text: "偶然にしちゃ、妙な間だったな。",
      },
    ],
    passportDialogueExamples: [
      {
        type: "first_encounter",
        faithBandContext: "uncertain",
        text: "あなたが、俺を外まで連れてきたのか。",
      },
      {
        type: "general",
        faithBandContext: "devoted",
        text: "神様が見ていた時間も、無駄じゃなかったんだな。",
      },
    ],
    ...sharedConstraints,
  },
  ryo: {
    firstPerson: "僕",
    secondPersonToCharacters: "きみ",
    sentenceLength: "short",
    emotionalExpression: "natural",
    politeness: "casual",
    speechPatterns: ["〜だよ", "〜かな", "少しだけ"],
    silenceUsage: "occasional",
    sandboxDialogueExamples: [
      { type: "daily", text: "少しだけ、歩いてくるね。" },
      { type: "relationship", text: "Suzuと話すと、ちょっと安心するよ。" },
      {
        type: "god_indirect_reaction",
        context: "senses_presence",
        text: "なんだか、見守られてる気がしたんだ。",
      },
    ],
    passportDialogueExamples: [
      {
        type: "first_encounter",
        faithBandContext: "senses_presence",
        text: "あなたに会うのは、初めてなのに懐かしい感じがするよ。",
      },
      {
        type: "memory_reference",
        faithBandContext: "believes",
        text: "箱庭で迷ったとき、誰かがそばにいる気がしたんだ。",
      },
    ],
    ...sharedConstraints,
  },
  suzu: {
    firstPerson: "あたし",
    secondPersonToCharacters: "きみ",
    sentenceLength: "short",
    emotionalExpression: "expressive",
    politeness: "casual",
    speechPatterns: ["〜だね", "えへへ", "ちょっと"],
    silenceUsage: "rare",
    sandboxDialogueExamples: [
      { type: "daily", text: "ねえ、今日はどこまで行ってみる？" },
      { type: "relationship", text: "Eveの声、なんだか落ち着くね。" },
      {
        type: "god_indirect_reaction",
        context: "believes",
        text: "今の、誰かが背中を押してくれたみたい。",
      },
    ],
    passportDialogueExamples: [
      {
        type: "first_encounter",
        faithBandContext: "believes",
        text: "あなたが、あたしを見つけてくれたんだね。",
      },
      {
        type: "general",
        faithBandContext: "devoted",
        text: "神様がいた世界のこと、あたし忘れないよ。",
      },
    ],
    ...sharedConstraints,
  },
};

export function getDefaultVoiceProfile(speechStyleId: SpeechStyleId): VoiceProfile {
  const profile = DEFAULT_VOICE_PROFILES[normalizeSpeechStyleId(speechStyleId)];

  if (!profile) {
    throw new Error(`Unknown default voice profile: ${speechStyleId}`);
  }

  return cloneVoiceProfile(profile);
}

export function resolveVoiceProfile(character: Character): VoiceProfile {
  const preferredId = character.profile.speechStyleId;
  if (preferredId && DEFAULT_VOICE_PROFILES[normalizeSpeechStyleId(preferredId)]) {
    return getDefaultVoiceProfile(preferredId);
  }

  const characterStyleId = normalizeSpeechStyleId(character.id);
  if (DEFAULT_VOICE_PROFILES[characterStyleId]) {
    return getDefaultVoiceProfile(characterStyleId);
  }

  return createFallbackVoiceProfile(character);
}

function normalizeSpeechStyleId(id: string): SpeechStyleId {
  return id.replace(/^chr_/, "").toLowerCase();
}

function createFallbackVoiceProfile(character: Character): VoiceProfile {
  const displayName = character.profile.displayName;

  return {
    firstPerson: "私",
    secondPersonToCharacters: "きみ",
    sentenceLength: "medium",
    emotionalExpression: "natural",
    politeness: "polite",
    speechPatterns: ["〜です", "〜ですね"],
    silenceUsage: "occasional",
    sandboxDialogueExamples: [
      { type: "daily", text: `${displayName}は、少し考えています。` },
      {
        type: "god_indirect_reaction",
        context: "senses_presence",
        text: "何かが、そっと支えてくれた気がします。",
      },
    ],
    passportDialogueExamples: [
      {
        type: "first_encounter",
        faithBandContext: "uncertain",
        text: "あなたに会うために、ここへ来ました。",
      },
    ],
    doNotSay: [...DEFAULT_DO_NOT_SAY_SANDBOX],
    doNotInvent: [...DEFAULT_DO_NOT_INVENT],
    continuityRules: [...DEFAULT_CONTINUITY_RULES],
  };
}

function cloneVoiceProfile(profile: VoiceProfile): VoiceProfile {
  return {
    ...profile,
    speechPatterns: [...profile.speechPatterns],
    sandboxDialogueExamples: profile.sandboxDialogueExamples.map((example) => ({ ...example })),
    passportDialogueExamples: profile.passportDialogueExamples.map((example) => ({ ...example })),
    doNotSay: [...profile.doNotSay],
    doNotInvent: [...profile.doNotInvent],
    continuityRules: [...profile.continuityRules],
  };
}
