import { Db, MongoClient } from "mongodb";
import { getServerEnv } from "@/lib/env";

declare global {
  // eslint-disable-next-line no-var
  var __framevaultMongoClient: Promise<MongoClient> | undefined;
}

async function createClient() {
  const { MONGODB_URI } = getServerEnv();
  const client = new MongoClient(MONGODB_URI, {
    maxPoolSize: 10,
    minPoolSize: 0,
    serverSelectionTimeoutMS: 8_000,
  });
  return client.connect();
}

export async function getDb(): Promise<Db> {
  const { MONGODB_DB_NAME } = getServerEnv();
  if (!global.__framevaultMongoClient) {
    global.__framevaultMongoClient = createClient().catch((error) => {
      global.__framevaultMongoClient = undefined;
      throw error;
    });
  }
  const client = await global.__framevaultMongoClient;
  return client.db(MONGODB_DB_NAME);
}

export async function ensureIndexes() {
  const db = await getDb();
  await Promise.all([
    db.collection("videos").createIndex({ slug: 1 }, { unique: true }),
    db.collection("videos").createIndex({ status: 1, publishedAt: -1 }),
    db.collection("videos").createIndex({ categoryId: 1, status: 1 }),
    db.collection("categories").createIndex({ slug: 1 }, { unique: true }),
    db.collection("users").createIndex({ email: 1 }, { unique: true }),
    db.collection("videoViews").createIndex(
      { videoId: 1, viewerHash: 1, dayBucket: 1 },
      { unique: true },
    ),
    db.collection("videoViews").createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
    db.collection("rateLimits").createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
    db.collection("auditLogs").createIndex({ createdAt: -1 }),
  ]);
}
