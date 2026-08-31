import { loadEnvConfig } from "@next/env";
import { PutBucketCorsCommand, S3Client } from "@aws-sdk/client-s3";

loadEnvConfig(process.cwd());

function required(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

async function main() {
  const endpoint = required("B2_ENDPOINT");
  const region = required("B2_REGION");
  const bucketName = required("B2_BUCKET_NAME");
  const appOrigin = new URL(required("APP_URL")).origin;
  const allowedOrigins = [...new Set([appOrigin, "http://localhost:3000", "https://*.netlify.app"])];
  const client = new S3Client({
    endpoint,
    region,
    forcePathStyle: true,
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
    credentials: { accessKeyId: required("B2_KEY_ID"), secretAccessKey: required("B2_APPLICATION_KEY") },
  });
  await client.send(new PutBucketCorsCommand({
    Bucket: bucketName,
    CORSConfiguration: {
      CORSRules: [{
        AllowedHeaders: ["*"],
        AllowedMethods: ["GET", "HEAD", "PUT"],
        AllowedOrigins: allowedOrigins,
        ExposeHeaders: ["ETag"],
        MaxAgeSeconds: 3600,
      }],
    },
  }));
  process.stdout.write(`Backblaze CORS configured for ${allowedOrigins.join(", ")}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : "Backblaze configuration failed"}\n`);
  process.exit(1);
});
