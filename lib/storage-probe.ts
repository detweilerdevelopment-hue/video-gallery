import "server-only";

import { randomUUID } from "node:crypto";
import { constants } from "node:fs";
import { access, readFile, stat, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

const PROBE_FILE_NAME = ".framevault-storage-probe.json";

interface ProbeMarker {
  id: string;
  createdAt: string;
}

export interface StorageProbeStatus {
  configured: boolean;
  root?: string;
  directoryExists: boolean;
  writable: boolean;
  marker?: ProbeMarker;
  error?: string;
}

function storageRoot() {
  const configured = process.env.STORAGE_ROOT?.trim();
  if (!configured) return null;
  if (!path.isAbsolute(configured)) throw new Error("STORAGE_ROOT must be an absolute path");
  const normalized = path.normalize(configured);
  if (normalized === path.parse(normalized).root) throw new Error("STORAGE_ROOT cannot be a filesystem root");
  return normalized;
}

function errorMessage(error: unknown) {
  if (error instanceof Error && "code" in error) {
    const code = String((error as NodeJS.ErrnoException).code || "");
    if (code === "ENOENT") return "The configured directory or probe marker does not exist.";
    if (code === "EACCES" || code === "EPERM") return "The Node.js process does not have permission to use this directory.";
  }
  return error instanceof Error ? error.message : "The storage probe failed.";
}

function probePath(root: string) {
  return path.join(root, PROBE_FILE_NAME);
}

async function readMarker(root: string) {
  try {
    const parsed = JSON.parse(await readFile(/* turbopackIgnore: true */ probePath(root), "utf8")) as Partial<ProbeMarker>;
    if (typeof parsed.id !== "string" || typeof parsed.createdAt !== "string") throw new Error("The persistence marker is invalid.");
    return { id: parsed.id, createdAt: parsed.createdAt };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  }
}

export async function getStorageProbeStatus(): Promise<StorageProbeStatus> {
  let root: string | null;
  try {
    root = storageRoot();
  } catch (error) {
    return { configured: true, directoryExists: false, writable: false, error: errorMessage(error) };
  }
  if (!root) return { configured: false, directoryExists: false, writable: false };

  try {
    const directory = await stat(/* turbopackIgnore: true */ root);
    if (!directory.isDirectory()) throw new Error("STORAGE_ROOT is not a directory.");
    await access(/* turbopackIgnore: true */ root, constants.R_OK | constants.W_OK);
    return {
      configured: true,
      root,
      directoryExists: true,
      writable: true,
      marker: await readMarker(root),
    };
  } catch (error) {
    return {
      configured: true,
      root,
      directoryExists: false,
      writable: false,
      error: errorMessage(error),
    };
  }
}

export async function createStorageProbe() {
  const root = storageRoot();
  if (!root) throw new Error("STORAGE_ROOT is not configured");
  const directory = await stat(/* turbopackIgnore: true */ root);
  if (!directory.isDirectory()) throw new Error("STORAGE_ROOT is not a directory");
  await access(/* turbopackIgnore: true */ root, constants.R_OK | constants.W_OK);

  const existing = await readMarker(root);
  if (existing) return existing;

  const marker: ProbeMarker = { id: randomUUID(), createdAt: new Date().toISOString() };
  await writeFile(/* turbopackIgnore: true */ probePath(root), `${JSON.stringify(marker)}\n`, { encoding: "utf8", flag: "wx", mode: 0o600 });
  return marker;
}

export async function removeStorageProbe() {
  const root = storageRoot();
  if (!root) throw new Error("STORAGE_ROOT is not configured");
  try {
    await unlink(/* turbopackIgnore: true */ probePath(root));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
}
