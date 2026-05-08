export type AppRouteId =
  | "sandbox"
  | "roster"
  | "relations"
  | "logs"
  | "passports"
  | "passport-detail"
  | "handoff"
  | "character-editor"
  | "sidekick-setup"
  | "dialogue-preview"
  | "not-found";

export interface AppRoute {
  id: AppRouteId;
  path: string;
  label: string;
  params?: Record<string, string>;
}

export const navigationRoutes: AppRoute[] = [
  { id: "sandbox", path: "/sandbox", label: "箱庭" },
  { id: "roster", path: "/roster", label: "住民" },
  { id: "passports", path: "/passports", label: "Passport" },
  { id: "dialogue-preview", path: "/dialogue-preview", label: "発話プレビュー" },
];

export function parseRoute(pathname: string): AppRoute {
  if (pathname === "/" || pathname === "/sandbox") {
    return { id: "sandbox", path: "/sandbox", label: "箱庭" };
  }

  if (pathname === "/roster") {
    return { id: "roster", path: "/roster", label: "住民" };
  }

  if (pathname === "/relations") {
    return { id: "relations", path: "/relations", label: "関係" };
  }

  if (pathname === "/logs") {
    return { id: "logs", path: "/logs", label: "ログ" };
  }

  if (pathname === "/passports") {
    return { id: "passports", path: "/passports", label: "Passport" };
  }

  if (pathname === "/handoff") {
    return { id: "handoff", path: "/handoff", label: "持ち出し" };
  }

  if (pathname === "/sidekick-setup") {
    return { id: "sidekick-setup", path: "/sidekick-setup", label: "サイドキック設定" };
  }

  if (pathname === "/dialogue-preview") {
    return { id: "dialogue-preview", path: "/dialogue-preview", label: "発話プレビュー" };
  }

  const passportMatch = pathname.match(/^\/passports\/([^/]+)$/);
  if (passportMatch) {
    return {
      id: "passport-detail",
      path: pathname,
      label: "Passport詳細",
      params: { passportId: decodeURIComponent(passportMatch[1]) }
    };
  }

  if (pathname === "/character-editor/new") {
    return {
      id: "character-editor",
      path: pathname,
      label: "キャラクター作成",
      params: { characterId: "new" }
    };
  }

  const editorMatch = pathname.match(/^\/character-editor\/([^/]+)$/);
  if (editorMatch) {
    return {
      id: "character-editor",
      path: pathname,
      label: "キャラクター編集",
      params: { characterId: decodeURIComponent(editorMatch[1]) }
    };
  }

  return { id: "not-found", path: pathname, label: "未定義" };
}
