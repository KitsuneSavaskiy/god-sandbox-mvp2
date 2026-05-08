import { useMemo } from "react";
import type { CharacterPassport } from "../../domain/models.js";
import type { RuntimeWorldState } from "../../state/runtimeState.js";
import "./ExternalHandoffSurface.css";

type ExternalHandoffSurfaceProps = {
  state: RuntimeWorldState;
};

export function ExternalHandoffSurface({ state }: ExternalHandoffSurfaceProps) {
  const latestPassport = [...state.passports.values()].at(-1);
  const bundle = useMemo(
    () => (latestPassport ? createHandoffBundle(latestPassport) : undefined),
    [latestPassport],
  );

  return (
    <section className="external-handoff" aria-labelledby="external-handoff-title">
      <div>
        <p className="eyebrow">External handoff</p>
        <h2 id="external-handoff-title">Passportを外部Codex / 外部ゲームへ渡す</h2>
        <p>
          GodSandbox は外部AIや外部ゲームをアプリ内から起動しません。発行済み Passport を
          手元のファイルとして渡し、外部側でゆるく解釈してもらう導線だけを用意します。
        </p>
      </div>

      <div className="external-handoff__grid">
        <section className="external-handoff__steps" aria-label="持ち出し手順">
          <h3>怖くない持ち出し手順</h3>
          <ol>
            <li>Snapshot を記録する。</li>
            <li>Snapshot から Passport を発行する。</li>
            <li>JSON と handoff memo を外部 Codex や外部ゲームへ渡す。</li>
            <li>外部側の結果を戻す処理は後続PBIで扱う。</li>
          </ol>
        </section>

        <section className="external-handoff__bundle" aria-label="外部持ち出しファイル">
          <h3>handoff bundle</h3>
          {bundle ? (
            <>
              <div className="external-handoff__download-row">
                <a
                  className="external-handoff__download"
                  href={bundle.passportHref}
                  download={`${latestPassport?.fileNameToken ?? "character-passport"}.json`}
                >
                  Passport JSON
                </a>
                <a
                  className="external-handoff__download"
                  href={bundle.memoHref}
                  download={`${latestPassport?.fileNameToken ?? "character-passport"}-handoff.md`}
                >
                  handoff memo
                </a>
              </div>
              <textarea readOnly value={bundle.memo} aria-label="handoff memo preview" />
            </>
          ) : (
            <p>Passport を発行すると、ここに外部へ渡す JSON と memo が表示されます。</p>
          )}
        </section>
      </div>
    </section>
  );
}

function createHandoffBundle(passport: CharacterPassport) {
  const passportJson = JSON.stringify(passport, null, 2);
  const memo = [
    "# GodSandbox Character Handoff",
    "",
    `Passport file token: ${passport.fileNameToken}`,
    `Character: ${String(passport.display.character.name ?? "Unnamed")}`,
    "",
    "## Use outside the app",
    "- Open Codex, Claude, or another external tool separately.",
    "- Upload or paste the Passport JSON with this memo.",
    "- Treat this as portable character context, not a live API contract.",
    "",
    "## Passport JSON",
    "```json",
    passportJson,
    "```",
  ].join("\n");

  return {
    memo,
    passportHref: toDataHref("application/json", passportJson),
    memoHref: toDataHref("text/markdown", memo),
  };
}

function toDataHref(type: string, content: string): string {
  return `data:${type};charset=utf-8,${encodeURIComponent(content)}`;
}
