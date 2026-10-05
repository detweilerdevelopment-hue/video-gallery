import { beforeEach, expect, it, vi } from "vitest";
import { ObjectId } from "mongodb";

const mocks = vi.hoisted(() => ({ auth: vi.fn(), find: vi.fn(), settingsFind: vi.fn(), update: vi.fn(), remove: vi.fn(), audit: vi.fn(), storage: vi.fn() }));
vi.mock("@/lib/auth", () => ({ requireAdmin: mocks.auth }));
vi.mock("@/lib/db", () => ({ getDb: async () => ({ collection: (name: string) => name === "videos" ? { findOne: mocks.find, deleteOne: mocks.remove } : name === "siteSettings" ? { findOne: mocks.settingsFind, updateOne: mocks.update } : { insertOne: mocks.audit } }) }));
vi.mock("@/lib/storage", () => ({ deleteStoredAsset: mocks.storage }));
vi.mock("@/lib/repositories", () => ({ uniqueSlug: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: (url: string) => { throw new Error(url); } }));
import { deleteVideoAction } from "@/app/admin/actions";

const id = "0123456789abcdef01234567";
function form() { const data = new FormData(); data.set("id", id); return data; }
beforeEach(() => {
  vi.resetAllMocks();
  mocks.auth.mockResolvedValue({ userId: id });
  mocks.find.mockResolvedValueOnce({ _id: new ObjectId(id), slug: "test", videoAsset: { key: "videos/test.mp4" }, poster: { key: "images/test.jpg" } }).mockResolvedValue(null);
  mocks.settingsFind.mockResolvedValue(null);
});
it("deletes both assets before removing the record", async () => {
  await expect(deleteVideoAction(form())).rejects.toThrow("success=deleted");
  expect(mocks.storage.mock.calls).toEqual([["videos/test.mp4"], ["images/test.jpg"]]);
  expect(mocks.remove).toHaveBeenCalledWith({ _id: new ObjectId(id) });
  expect(mocks.storage.mock.invocationCallOrder[1]).toBeLessThan(mocks.remove.mock.invocationCallOrder[0]);
});
it("keeps the record when storage deletion fails partway through", async () => {
  mocks.storage.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error("Storage failed"));
  await expect(deleteVideoAction(form())).rejects.toThrow("error=delete-storage");
  expect(mocks.remove).not.toHaveBeenCalled();
});
it("blocks deletion of media shared with a banner", async () => {
  mocks.settingsFind.mockResolvedValue({ heroImage: { key: "videos/test.mp4" } });
  await expect(deleteVideoAction(form())).rejects.toThrow("error=shared-media");
  expect(mocks.storage).not.toHaveBeenCalled();
  expect(mocks.remove).not.toHaveBeenCalled();
});
it("requires authentication before accessing records or storage", async () => {
  mocks.auth.mockRejectedValue(new Error("Unauthorized"));
  await expect(deleteVideoAction(form())).rejects.toThrow("Unauthorized");
  expect(mocks.find).not.toHaveBeenCalled();
  expect(mocks.storage).not.toHaveBeenCalled();
});
