export const CURRENT_SAVE_VERSION = 1;

export type MigrationContext = {
  worldId: string;
};

export type MigrationStep = {
  fromVersion: number;
  toVersion: number;
  description: string;
  migrate: (context: MigrationContext) => MigrationContext;
};

export type MigrationRegistry = {
  currentSaveVersion: number;
  steps: MigrationStep[];
  migrateToCurrent: (context: MigrationContext, fromVersion: number) => MigrationContext;
};

export function createMigrationRegistry(steps: MigrationStep[] = []): MigrationRegistry {
  return {
    currentSaveVersion: CURRENT_SAVE_VERSION,
    steps: [...steps].sort((left, right) => left.fromVersion - right.fromVersion),
    migrateToCurrent(context, fromVersion) {
      let nextContext = context;
      let version = fromVersion;

      for (const step of this.steps) {
        if (step.fromVersion === version) {
          nextContext = step.migrate(nextContext);
          version = step.toVersion;
        }
      }

      if (version !== CURRENT_SAVE_VERSION) {
        throw new Error(`No migration path from saveVersion ${fromVersion} to ${CURRENT_SAVE_VERSION}.`);
      }

      return nextContext;
    },
  };
}
