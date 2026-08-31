import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

async function main() {
  const [{ hash }, { getDb, ensureIndexes }, { DEFAULT_SETTINGS }, { slugify }] = await Promise.all([
    import("bcryptjs"),
    import("@/lib/db"),
    import("@/lib/default-settings"),
    import("@/lib/validation"),
  ]);
  const email = String(process.env.ADMIN_EMAIL || "").trim().toLowerCase();
  const password = String(process.env.ADMIN_PASSWORD || "");
  if (!email || password.length < 8) throw new Error("Set ADMIN_EMAIL and an ADMIN_PASSWORD of at least 8 characters");

  await ensureIndexes();
  const db = await getDb();
  const now = new Date();
  const passwordHash = await hash(password, 12);
  await db.collection("users").updateOne(
    { email },
    { $set: { email, name: "Site Owner", passwordHash, role: "owner", active: true, updatedAt: now }, $setOnInsert: { createdAt: now } },
    { upsert: true },
  );
  await db.collection("siteSettings").updateOne({ key: "main" }, { $setOnInsert: DEFAULT_SETTINGS }, { upsert: true });
  const categoryNames = ["Documentary", "Nature", "Talks"];
  for (const [sortOrder, name] of categoryNames.entries()) {
    await db.collection("categories").updateOne(
      { slug: slugify(name) },
      { $setOnInsert: { name, slug: slugify(name), sortOrder, isActive: true, createdAt: now, updatedAt: now } },
      { upsert: true },
    );
  }
  process.stdout.write(`Seed complete. Owner created for ${email}.\n`);
  process.exit(0);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : "Seed failed"}\n`);
  process.exit(1);
});
