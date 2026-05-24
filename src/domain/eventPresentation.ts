export type EventPresentationContent = {
  templateId: string;
  displayName: string;
  flavorText: string;
  startedDialogueLines: readonly string[];
  interventionAppliedDialogueLines: readonly string[];
  successDialogueLines?: readonly string[];
  failureDialogueLines?: readonly string[];
};

export type ResolvedEventPresentation = {
  displayName: string;
  flavorText: string;
};

export const EVENT_PRESENTATION_CONTENT: readonly EventPresentationContent[] = [
  {
    templateId: "daily-sandbox-observation",
    displayName: "小さな日常",
    flavorText: "いつもの箱庭に、少しだけ違う空気が流れている。",
    startedDialogueLines: [
      "今日は、風がやわらかいね。",
      "なんだか、少し違う日みたい。",
    ],
    interventionAppliedDialogueLines: [
      "今の感じ、覚えておきたいな。",
      "少しだけ、前に進めそう。",
    ],
  },
  {
    templateId: "small-disagreement",
    displayName: "言葉の行き違い",
    flavorText: "何気ない一言が、少しだけ心の距離を揺らしている。",
    startedDialogueLines: [
      "今の、そういう意味じゃなくて。",
      "うまく伝わらなかったかも。",
    ],
    interventionAppliedDialogueLines: [
      "少し、落ち着いて話せそう。",
      "もう一度、言い直してみる。",
    ],
  },
  {
    templateId: "shared-work",
    displayName: "共同作業",
    flavorText: "小さな作業を通して、誰かと呼吸を合わせる時間が生まれている。",
    startedDialogueLines: [
      "ここ、手伝ってくれる？",
      "一緒なら、早く終わりそう。",
    ],
    interventionAppliedDialogueLines: [
      "息が合ってきた気がする。",
      "ひとりより、ずっと楽だね。",
    ],
  },
  {
    templateId: "quiet-trial",
    displayName: "静かな試練",
    flavorText: "誰にも見えにくい場所で、小さな勇気が試されている。",
    startedDialogueLines: [
      "これ、ちゃんとできるかな。",
      "少しだけ、怖いかも。",
    ],
    interventionAppliedDialogueLines: [
      "もう少し、やってみる。",
      "逃げないでいられそう。",
    ],
  },
  {
    templateId: "small-sadness",
    displayName: "小さな沈黙",
    flavorText: "言葉にならない気持ちが、静かな空気の中に残っている。",
    startedDialogueLines: [
      "今日は、少し静かにしたい。",
      "なんでもない、と思う。",
    ],
    interventionAppliedDialogueLines: [
      "少しだけ、軽くなった。",
      "ここにいても、いいのかな。",
    ],
  },
  {
    templateId: "moving-stone",
    displayName: "謎の動く石",
    flavorText: "昨日とは違う場所に、小さな石が移動している。誰も動かした覚えはない。",
    startedDialogueLines: [
      "この石、昨日ここにあった？",
      "足あともないのに、変だね。",
    ],
    interventionAppliedDialogueLines: [
      "次は、もっとよく見てみる。",
      "石のまわり、少し冷たい。",
    ],
    successDialogueLines: ["動く前の気配、分かったかも。"],
    failureDialogueLines: ["また、見失っちゃった。"],
  },
  {
    templateId: "shrine-prayer-wish",
    displayName: "お参りと願い",
    flavorText: "小さな祠の前で、胸の奥にある願いが言葉を探している。",
    startedDialogueLines: [
      "何をお願いしようかな。",
      "声に出すの、少し照れるね。",
    ],
    interventionAppliedDialogueLines: [
      "ちゃんと、言えそうな気がする。",
      "願いって、形があるのかな。",
    ],
    successDialogueLines: ["今の願い、大事にしたい。"],
    failureDialogueLines: ["まだ、言葉にならないな。"],
  },
  {
    templateId: "strange-grass-found",
    displayName: "変な草を拾う",
    flavorText: "見慣れない草が、草むらの中で不思議に光っている。",
    startedDialogueLines: [
      "この草、見たことない。",
      "なんだか、いい匂いがする。",
    ],
    interventionAppliedDialogueLines: [
      "持って帰って調べてみる？",
      "そっと触ったほうがよさそう。",
    ],
    successDialogueLines: ["扱い方、少し分かったよ。"],
    failureDialogueLines: ["うう、匂いが強すぎる。"],
  },
  {
    templateId: "shared-nap-place",
    displayName: "同じ場所で昼寝",
    flavorText: "木陰のやわらかい場所で、眠気がゆっくり広がっている。",
    startedDialogueLines: [
      "ここ、ちょうどいい日陰だね。",
      "少しだけ、休んでいこう。",
    ],
    interventionAppliedDialogueLines: [
      "なんだか、安心するね。",
      "起こさないようにしよう。",
    ],
    successDialogueLines: ["いい夢を見た気がする。"],
    failureDialogueLines: ["あ、先に起きてたんだ。"],
  },
  {
    templateId: "mysterious-footprints",
    displayName: "謎の足あと",
    flavorText: "広場に残された足あとが、どこかへ続いている。けれど主の姿は見えない。",
    startedDialogueLines: [
      "この足あと、誰のだろう。",
      "途中で向きが変わってる。",
    ],
    interventionAppliedDialogueLines: [
      "跡をたどってみよう。",
      "消える前に見ておきたい。",
    ],
    successDialogueLines: ["向かった先、分かったよ。"],
    failureDialogueLines: ["途中で消えちゃった。"],
  },
  {
    templateId: "legendary-big-fish",
    displayName: "伝説の大きな魚",
    flavorText: "水面の奥で、大きな影がゆっくり揺れた。見間違いとは思えない。",
    startedDialogueLines: [
      "今、水の中で何か動いた。",
      "あれ、魚にしては大きいよ。",
    ],
    interventionAppliedDialogueLines: [
      "静かにしてたら、見えるかな。",
      "水面をよく見てみよう。",
    ],
    successDialogueLines: ["見えた、本当に大きかった。"],
    failureDialogueLines: ["波だけが残ってる。"],
  },
  {
    templateId: "shrine-fox-offering",
    displayName: "祠の油揚げ",
    flavorText: "祠のそばに、油揚げがそっと置かれている。誰かが来た気配だけが残っている。",
    startedDialogueLines: [
      "これ、誰が置いたのかな。",
      "なんだか、いい匂いがする。",
    ],
    interventionAppliedDialogueLines: [
      "そっとしておいた方がいいかな。",
      "誰か、近くにいる気がする。",
    ],
    successDialogueLines: ["祠の空気が変わった。"],
    failureDialogueLines: ["いつの間にか消えてる。"],
  },
];

const FALLBACK_EVENT_PRESENTATION: EventPresentationContent = {
  templateId: "unknown",
  displayName: "小さな出来事",
  flavorText: "箱庭のどこかで、静かな変化が起きている。",
  startedDialogueLines: ["何か、少し変わったみたい。"],
  interventionAppliedDialogueLines: ["今の感じ、覚えておきたい。"],
};

export function resolveEventPresentation(templateId: string): ResolvedEventPresentation {
  const content = findEventPresentationContent(templateId);
  return {
    displayName: content.displayName,
    flavorText: content.flavorText,
  };
}

export function resolveEventDialogueLines(input: {
  templateId: string;
  trigger: "event_started" | "intervention_applied";
  outcome?: "success" | "failure";
}): readonly string[] {
  const content = findEventPresentationContent(input.templateId);
  if (input.outcome === "success" && content.successDialogueLines) {
    return content.successDialogueLines;
  }
  if (input.outcome === "failure" && content.failureDialogueLines) {
    return content.failureDialogueLines;
  }
  return input.trigger === "event_started"
    ? content.startedDialogueLines
    : content.interventionAppliedDialogueLines;
}

function findEventPresentationContent(templateId: string): EventPresentationContent {
  return (
    EVENT_PRESENTATION_CONTENT.find((content) => content.templateId === templateId) ??
    FALLBACK_EVENT_PRESENTATION
  );
}
