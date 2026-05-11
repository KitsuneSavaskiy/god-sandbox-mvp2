export type EventArtViewModel = {
  assetId: string;
  src: string;
  fallbackSrc: string;
  alt: string;
  visualSourceKind: "preauthored_event_art" | "fallback";
};

const FALLBACK_SRC = "/art/events/_fallback/generic-event.svg";
const FALLBACK_ASSET_ID = "event-art-fallback-generic";

const EVENT_ART_MAP: Record<string, { assetId: string; src: string; alt: string }> = {
  "moving-stone": {
    assetId: "event-art-moving-stone-started",
    src: "/art/events/moving-stone/started.svg",
    alt: "謎の動く石",
  },
  "shrine-prayer-wish": {
    assetId: "event-art-shrine-prayer-wish-started",
    src: "/art/events/shrine-prayer-wish/started.svg",
    alt: "お参りと願い",
  },
  "strange-grass-found": {
    assetId: "event-art-strange-grass-found-started",
    src: "/art/events/strange-grass-found/started.svg",
    alt: "変な草を拾う",
  },
  "shared-nap-place": {
    assetId: "event-art-shared-nap-place-started",
    src: "/art/events/shared-nap-place/started.svg",
    alt: "同じ場所で昼寝",
  },
  "mysterious-footprints": {
    assetId: "event-art-mysterious-footprints-started",
    src: "/art/events/mysterious-footprints/started.svg",
    alt: "謎の足あと",
  },
  "legendary-big-fish": {
    assetId: "event-art-legendary-big-fish-started",
    src: "/art/events/legendary-big-fish/started.svg",
    alt: "伝説の大きな魚",
  },
  "shrine-fox-offering": {
    assetId: "event-art-shrine-fox-offering-started",
    src: "/art/events/shrine-fox-offering/started.svg",
    alt: "祠の油揚げ",
  },
};

export function resolveEventArt(templateId: string): EventArtViewModel {
  const entry = EVENT_ART_MAP[templateId];
  if (!entry) {
    return {
      assetId: FALLBACK_ASSET_ID,
      src: FALLBACK_SRC,
      fallbackSrc: FALLBACK_SRC,
      alt: "出来事の様子",
      visualSourceKind: "fallback",
    };
  }
  return {
    assetId: entry.assetId,
    src: entry.src,
    fallbackSrc: FALLBACK_SRC,
    alt: entry.alt,
    visualSourceKind: "preauthored_event_art",
  };
}
