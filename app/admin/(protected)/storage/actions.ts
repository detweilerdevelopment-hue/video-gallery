"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { createStorageProbe, removeStorageProbe } from "@/lib/storage-probe";
import { migrateReferencedAssets } from "@/lib/storage-migration";

export async function createStorageProbeAction() {
  await requireAdmin();
  try {
    await createStorageProbe();
  } catch {
    redirect("/admin/storage?error=probe");
  }
  revalidatePath("/admin/storage");
  redirect("/admin/storage?success=created");
}

export async function removeStorageProbeAction() {
  await requireAdmin();
  try {
    await removeStorageProbe();
  } catch {
    redirect("/admin/storage?error=remove");
  }
  revalidatePath("/admin/storage");
  redirect("/admin/storage?success=removed");
}

export async function migrateStorageAction() {
  await requireAdmin();
  let result: Awaited<ReturnType<typeof migrateReferencedAssets>>;
  try {
    result = await migrateReferencedAssets();
  } catch {
    redirect("/admin/storage?error=migration");
  }
  revalidatePath("/admin/storage");
  revalidatePath("/");
  redirect(`/admin/storage?success=migrated&count=${result.migrated}`);
}
