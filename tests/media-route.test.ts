import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

vi.mock("server-only", () => ({}));

import { GET, HEAD } from "@/app/media/[...key]/route";

describe("local media delivery", () => {
  let directory: string;
  const previousRoot = process.env.STORAGE_ROOT;

  beforeEach(async () => {
    directory = await mkdtemp(path.join(tmpdir(), "framevault-media-route-"));
    process.env.STORAGE_ROOT = directory;
    await mkdir(path.join(directory, "videos"));
    await writeFile(path.join(directory, "videos", "example.mp4"), "0123456789");
  });

  afterEach(async () => {
    if (previousRoot === undefined) delete process.env.STORAGE_ROOT;
    else process.env.STORAGE_ROOT = previousRoot;
    await rm(directory, { recursive: true, force: true });
  });

  it("serves a byte range for browser seeking", async () => {
    const response = await GET(
      new Request("http://localhost/media/videos/example.mp4", { headers: { range: "bytes=2-5" } }),
      { params: Promise.resolve({ key: ["videos", "example.mp4"] }) },
    );
    expect(response.status).toBe(206);
    expect(response.headers.get("content-range")).toBe("bytes 2-5/10");
    expect(response.headers.get("accept-ranges")).toBe("bytes");
    expect(await response.text()).toBe("2345");
  });

  it("returns 416 for an unsatisfiable range", async () => {
    const response = await GET(
      new Request("http://localhost/media/videos/example.mp4", { headers: { range: "bytes=20-30" } }),
      { params: Promise.resolve({ key: ["videos", "example.mp4"] }) },
    );
    expect(response.status).toBe(416);
    expect(response.headers.get("content-range")).toBe("bytes */10");
  });

  it("supports HEAD without returning a body", async () => {
    const response = await HEAD(
      new Request("http://localhost/media/videos/example.mp4"),
      { params: Promise.resolve({ key: ["videos", "example.mp4"] }) },
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("content-length")).toBe("10");
    expect(await response.text()).toBe("");
  });
});
