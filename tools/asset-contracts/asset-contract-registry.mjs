#!/usr/bin/env node
/**
 * Asset Contract Registry — machine-readable specs for all generated asset lanes.
 * Imported by prompt builders, validators, and review-pack tools.
 * Source of truth: docs/operations/resident-sprite-spec.md
 */

export const CONTRACTS = {
  "resident-canonical-two-sheet-v1": {
    contractId: "resident-canonical-two-sheet-v1",
    lane: "resident-sprite-sheet",
    variant: "canonical",
    sheetCount: 2,
    sheets: [
      {
        kind: "motion",
        canvasWidth: 1536, canvasHeight: 1872,
        columns: 8, rows: 9,
        frameWidth: 192, frameHeight: 208,
        rowManifest: ["idle","walk-right","walk-left","waving","jumping","failed","waiting","running","review"],
      },
      {
        kind: "extended",
        canvasWidth: 1536, canvasHeight: 1872,
        columns: 8, rows: 9,
        frameWidth: 192, frameHeight: 208,
        rowManifest: ["walk-up","walk-down","walk-forward","walk-back","emote-happy","emote-angry","emote-sad","emote-surprised","spare"],
      },
    ],
    alphaRequired: true,
    transparentBackgroundRequired: true,
    forbiddenArtifacts: ["labels","text","frame-markers","checkerboard","solid-background","grid-lines"],
    identityConsistencyRules: ["same-character-across-all-rows","consistent-costume","consistent-scale"],
    safeMargins: { top: 4, bottom: 4, left: 4, right: 4 },
  },

  "resident-po-combined-preview-v1": {
    contractId: "resident-po-combined-preview-v1",
    lane: "resident-sprite-sheet",
    variant: "po-combined",
    note: "PO preview exception — combined sheet for human inspection only. Not used in production game.",
    canvasWidth: 826, canvasHeight: 1904,
    columns: 7, rows: 14,
    frameWidth: 118, frameHeight: 136,
    rowManifest: [
      "idle","walk-right","walk-left","waving","jumping","failed","waiting","review",
      "walk-up/walk-back","walk-down/walk-forward",
      "emote-happy","emote-angry","emote-sad","emote-surprised",
    ],
    alphaRequired: true,
    transparentBackgroundRequired: true,
    forbiddenArtifacts: ["labels","text","frame-markers","checkerboard","solid-background","grid-lines"],
    identityConsistencyRules: ["same-character-across-all-rows","consistent-costume","consistent-scale"],
    safeMargins: { top: 4, bottom: 4, left: 4, right: 4 },
  },

  "portrait-expression-set-v1": {
    contractId: "portrait-expression-set-v1",
    lane: "portrait-expressions",
    requiredExpressions: ["neutral","happy","angry","sad","surprised"],
    allowedExpressions: ["neutral","happy","angry","sad","surprised"],
    canvasSizeConsistencyRequired: true,
    alphaRequired: true,
    transparentBackgroundRequired: true,
    identityConsistencyRules: [
      "same-character-across-all-expressions",
      "same-pose","same-costume","same-camera-angle",
      "expression-only-variation",
    ],
    forbiddenArtifacts: ["labels","text","solid-background","checkerboard"],
    safeMargins: { top: 8, bottom: 8, left: 8, right: 8 },
  },

  "event-standing-expression-set-v1": {
    contractId: "event-standing-expression-set-v1",
    lane: "event-standing-expressions",
    requiredExpressions: ["neutral","happy","angry","sad","surprised","worried","determined","shocked"],
    allowedExpressions: ["neutral","happy","angry","sad","surprised","worried","determined","shocked"],
    canvasSizeConsistencyRequired: true,
    alphaRequired: true,
    transparentBackgroundRequired: true,
    identityConsistencyRules: [
      "same-character-across-all-expressions",
      "same-pose","same-costume","same-camera-angle","same-crop",
      "expression-only-variation",
    ],
    forbiddenArtifacts: ["labels","text","solid-background","checkerboard"],
    safeMargins: { top: 16, bottom: 16, left: 16, right: 16 },
    eventUiNote: "Consistent framing for event UI overlay; transparent background required; portrait-style framing",
  },
};

/** Returns the contract for the given contractId. Throws if not found. */
export function getContract(contractId) {
  if (!CONTRACTS[contractId]) {
    throw new Error(`Unknown contractId: "${contractId}". Available: ${Object.keys(CONTRACTS).join(", ")}`);
  }
  return CONTRACTS[contractId];
}

/** Returns array of { contractId, lane, variant/note } for --list display. */
export function listContracts() {
  return Object.values(CONTRACTS).map(({ contractId, lane, variant, note }) => ({
    contractId,
    lane,
    summary: variant ?? note ?? contractId,
  }));
}

/** Returns true if the contractId is known. */
export function validateContractId(id) {
  return id in CONTRACTS;
}
