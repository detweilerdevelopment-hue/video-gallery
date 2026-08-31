import { z } from "zod";

const serverSchema = z.object({
  MONGODB_URI: z.string().min(1),
  MONGODB_DB_NAME: z.string().min(1).default("framevault"),
  AUTH_SECRET: z.string().min(32),
  APP_URL: z.string().url().default("http://localhost:3000"),
});

export function getServerEnv() {
  const result = serverSchema.safeParse({
    ...process.env,
    APP_URL: process.env.APP_URL || process.env.URL || "http://localhost:3000",
  });
  if (!result.success) {
    throw new Error(
      `Invalid server environment: ${result.error.issues.map((issue) => issue.path.join(".")).join(", ")}`,
    );
  }
  return result.data;
}

export function isLocalDemoMode() {
  return process.env.NODE_ENV !== "production" && !process.env.MONGODB_URI;
}

export function hasServerConfiguration() {
  return Boolean(process.env.MONGODB_URI && process.env.AUTH_SECRET);
}

const backblazeSchema = z.object({
  B2_KEY_ID: z.string().min(1),
  B2_APPLICATION_KEY: z.string().min(1),
  B2_BUCKET_NAME: z.string().min(6),
  B2_REGION: z.string().min(1),
  B2_ENDPOINT: z.string().url(),
  B2_PUBLIC_BASE_URL: z.string().url(),
});

export function getBackblazeEnv() {
  const result = backblazeSchema.safeParse(process.env);
  if (!result.success) {
    throw new Error(
      `Backblaze server environment is missing or invalid: ${result.error.issues.map((issue) => issue.path.join(".")).join(", ")}`,
    );
  }
  return {
    keyId: result.data.B2_KEY_ID,
    applicationKey: result.data.B2_APPLICATION_KEY,
    bucketName: result.data.B2_BUCKET_NAME,
    region: result.data.B2_REGION,
    endpoint: result.data.B2_ENDPOINT.replace(/\/$/, ""),
    publicBaseUrl: result.data.B2_PUBLIC_BASE_URL.replace(/\/$/, ""),
  };
}
