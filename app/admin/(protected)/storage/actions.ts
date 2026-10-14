"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { createStorageProbe, removeStorageProbe } from "@/lib/storage-probe";

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
