export type SidekickRepoRootHandle = {
  name: string;
  getDirectoryHandle: (
    name: string,
    options?: { create?: boolean },
  ) => Promise<SidekickRepoRootHandle>;
  getFileHandle: (
    name: string,
    options?: { create?: boolean },
  ) => Promise<SidekickFileHandle>;
};

type SidekickFileHandle = {
  createWritable: () => Promise<SidekickWritable>;
};

type SidekickWritable = {
  write: (data: Blob | string) => Promise<void>;
  close: () => Promise<void>;
};

type SidekickJobRequestParams = {
  displayName: string;
  personality: string;
  tone: string;
  age: string;
  portraitFile?: File;
};

type SidekickJobRequest = {
  requestFormat: "godsandbox-sidekick-request/v1";
  requestId: string;
  createdAt: string;
  slug: string;
  displayName: string;
  personality: string;
  tone: string;
  age: number;
  portraitPath: string | null;
};

export async function writeSidekickJobRequest(
  repoRootHandle: SidekickRepoRootHandle,
  params: SidekickJobRequestParams,
): Promise<void> {
  const slug = deriveSlug(params.displayName);
  const timestamp = new Date().toISOString().replace(/[-:T.Z]/g, "").slice(0, 14);
  const requestId = `${timestamp}-${slug}`;

  const godsandboxDir = await repoRootHandle.getDirectoryHandle(".godsandbox", { create: true });

  let portraitPath: string | null = null;

  if (params.portraitFile) {
    const ext = getPortraitExtension(params.portraitFile);
    const portraitFilename = `${requestId}-portrait.${ext}`;
    const portraitsDir = await godsandboxDir.getDirectoryHandle("portraits", { create: true });
    const portraitHandle = await portraitsDir.getFileHandle(portraitFilename, { create: true });
    const writable = await portraitHandle.createWritable();
    await writable.write(params.portraitFile);
    await writable.close();
    portraitPath = `.godsandbox/portraits/${portraitFilename}`;
  }

  const request: SidekickJobRequest = {
    requestFormat: "godsandbox-sidekick-request/v1",
    requestId,
    createdAt: new Date().toISOString(),
    slug,
    displayName: params.displayName,
    personality: params.personality,
    tone: params.tone,
    age: parseAge(params.age),
    portraitPath,
  };

  const jobsDir = await godsandboxDir.getDirectoryHandle("jobs", { create: true });
  const requestFilename = `${requestId}-request.json`;
  const requestHandle = await jobsDir.getFileHandle(requestFilename, { create: true });
  const requestWritable = await requestHandle.createWritable();
  await requestWritable.write(
    new Blob([JSON.stringify(request, null, 2) + "\n"], { type: "application/json" }),
  );
  await requestWritable.close();
}

function deriveSlug(displayName: string): string {
  const slug = displayName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return slug || "resident";
}

function parseAge(value: string): number {
  const n = parseInt(value, 10);
  return isNaN(n) || n < 0 ? 0 : n;
}

function getPortraitExtension(file: File): string {
  const ext = file.name.split(".").pop()?.toLowerCase();
  if (ext === "png" || ext === "jpg" || ext === "jpeg" || ext === "webp") return ext;
  if (file.type === "image/png") return "png";
  if (file.type === "image/jpeg") return "jpg";
  if (file.type === "image/webp") return "webp";
  return "png";
}
