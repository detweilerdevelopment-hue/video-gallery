import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { createStorageProbe, getStorageProbeStatus, removeStorageProbe } from "@/lib/storage-probe";

describe("Hostinger persistence probe", () => {
  let directory: string;

  beforeEach(async () => {
    directory = await mkdtemp(path.join(tmpdir(), "framevault-storage-probe-"));
    process.env.STORAGE_ROOT = directory;
  });

  afterEach(async () => {
    delete process.env.STORAGE_ROOT;
    await rm(directory, { recursive: true, force: true });
  });

  it("creates a stable marker and removes it", async () => {
    const created = await createStorageProbe();
    const repeated = await createStorageProbe();
    expect(repeated).toEqual(created);

    const present = await getStorageProbeStatus();
    expect(present).toMatchObject({ configured: true, directoryExists: true, writable: true, marker: created });

    await removeStorageProbe();
    const removed = await getStorageProbeStatus();
    expect(removed.marker).toBeUndefined();
  });

  it("rejects a relative storage root", async () => {
    process.env.STORAGE_ROOT = "media-storage";
    await expect(createStorageProbe()).rejects.toThrow("absolute path");
    await expect(getStorageProbeStatus()).resolves.toMatchObject({ configured: true, writable: false });
  });
});
