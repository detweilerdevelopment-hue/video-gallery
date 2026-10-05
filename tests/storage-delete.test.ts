import { beforeEach, describe, expect, it, vi } from "vitest";

const { send } = vi.hoisted(() => ({ send: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/env", () => ({ getBackblazeEnv: () => ({ bucketName: "test-bucket", region: "test", endpoint: "https://example.com", keyId: "test", applicationKey: "test" }) }));
vi.mock("@aws-sdk/client-s3", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@aws-sdk/client-s3")>();
  return { ...actual, S3Client: class { send = send; } };
});

import { deleteStoredAsset } from "@/lib/storage";
import { DeleteObjectCommand } from "@aws-sdk/client-s3";

describe("permanent media deletion", () => {
  beforeEach(() => send.mockReset());

  it("deletes all exact-key versions and markers across pages, leaving prefix matches alone", async () => {
    send.mockResolvedValueOnce({ Versions: [{ Key: "videos/a.mp4", VersionId: "v1" }, { Key: "videos/a.mp4-other", VersionId: "other" }], IsTruncated: true, NextKeyMarker: "videos/a.mp4", NextVersionIdMarker: "v1" })
      .mockResolvedValueOnce({ Versions: [{ Key: "videos/a.mp4", VersionId: "v2" }], DeleteMarkers: [{ Key: "videos/a.mp4", VersionId: "marker" }] })
      .mockResolvedValue({});
    await deleteStoredAsset("videos/a.mp4");
    expect(send.mock.calls[1][0].input).toMatchObject({ KeyMarker: "videos/a.mp4", VersionIdMarker: "v1" });
    const deletions = send.mock.calls.map(([command]) => command).filter(command => command instanceof DeleteObjectCommand);
    expect(deletions.map(command => command.input)).toEqual(["v1", "v2", "marker"].map(VersionId => ({ Bucket: "test-bucket", Key: "videos/a.mp4", VersionId })));
  });

  it("allows retry when files are already absent", async () => {
    send.mockResolvedValue({});
    await deleteStoredAsset("images/poster.jpg");
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("propagates storage failures", async () => {
    send.mockResolvedValueOnce({ Versions: [{ Key: "videos/a.mp4", VersionId: "v1" }] }).mockRejectedValueOnce(new Error("Access denied"));
    await expect(deleteStoredAsset("videos/a.mp4")).rejects.toThrow("Access denied");
  });

  it("rejects keys outside media directories before contacting storage", async () => {
    await expect(deleteStoredAsset("images/../secret")).rejects.toThrow("Invalid storage key");
    await expect(deleteStoredAsset("private/file")).rejects.toThrow("Invalid storage key");
    expect(send).not.toHaveBeenCalled();
  });
});
