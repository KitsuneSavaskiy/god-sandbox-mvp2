# Sprint8 Guardrails

Sprint8は「生活シミュレーションを広げる」ではなく「見えている箱庭を動かす」Sprint。

## Sprint8 Goal

背景つき箱庭の中で、4名の住民が自然に存在して見え、idle / walk の最小モーションで動き、1〜4名参加イベント、キャラ詳細、Passport導線が破綻しない状態にする。

## 必須にしないこと

- 4キャラ x 11motion 完成をSprint8の必須Doneにしない。
- 本格生活AIを入れない。
- 自由移動AIを入れない。
- 衝突判定を入れない。
- 3D engineを入れない。
- Passport schemaを変更しない。

## 優先すること

- 1キャラで `prompt -> incoming -> 検査 -> 切り出し -> manifest -> 表示` の流れを通す。
- sprite sheet未生成時は portrait / icon / placeholder fallbackで壊さない。
- GodSandbox本体は manifest / read model だけを見る。
- 箱庭上にはキャラ名、場所、状態ラベルを表示しない。
