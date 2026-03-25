// Storage abstraction: uses Cloudflare R2 (S3-compatible) when S3_BUCKET is set,
// falls back to local filesystem (./uploads/) for development.

import fs from "fs";
import path from "path";
import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// ── Local fallback directory (always exists for dev / non-S3 mode) ──────────
export const UPLOADS_DIR = path.resolve(process.cwd(), "uploads");
fs.mkdirSync(UPLOADS_DIR, { recursive: true });

// ── S3 / R2 client (initialised only when credentials are present) ──────────
const s3Bucket = process.env.S3_BUCKET;
const s3Endpoint = process.env.S3_ENDPOINT;
const s3AccessKey = process.env.S3_ACCESS_KEY;
const s3SecretKey = process.env.S3_SECRET_KEY;

const useS3 = !!(s3Bucket && s3Endpoint && s3AccessKey && s3SecretKey);

const s3 = useS3
  ? new S3Client({
      region: "auto",
      endpoint: s3Endpoint,
      credentials: { accessKeyId: s3AccessKey!, secretAccessKey: s3SecretKey! },
    })
  : null;

if (useS3) {
  console.log(`[storage] Using S3/R2 bucket: ${s3Bucket}`);
} else {
  console.log("[storage] S3 credentials not set — using local filesystem");
}

// ── Helpers ─────────────────────────────────────────────────────────────────
function getBaseUrl(): string {
  return `http://localhost:${process.env.PORT ?? "3000"}`;
}

function normalizeKey(relKey: string): string {
  return relKey.replace(/^\/+/, "");
}

// ── Public API ──────────────────────────────────────────────────────────────

export async function storagePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType = "application/octet-stream"
): Promise<{ key: string; url: string }> {
  const key = normalizeKey(relKey);
  const buffer: Buffer =
    typeof data === "string" ? Buffer.from(data) : Buffer.from(data as Uint8Array);

  if (s3) {
    console.log("[storagePut] Uploading to R2", { key, bytes: buffer.length, contentType });
    await s3.send(
      new PutObjectCommand({
        Bucket: s3Bucket,
        Key: key,
        Body: buffer,
        ContentType: contentType,
      })
    );
    // Return a signed read URL (valid 1 hour)
    const url = await getSignedUrl(
      s3,
      new GetObjectCommand({ Bucket: s3Bucket, Key: key }),
      { expiresIn: 3600 }
    );
    console.log("[storagePut] ✓ Uploaded to R2:", key);
    return { key, url };
  }

  // ── Local filesystem fallback ───────────────────────────────────────────
  const fullPath = path.join(UPLOADS_DIR, key);
  await fs.promises.mkdir(path.dirname(fullPath), { recursive: true });

  console.log("[storagePut] Writing to disk", { key, fullPath, bytes: buffer.length, contentType });
  try {
    await fs.promises.writeFile(fullPath, buffer);
    console.log("[storagePut] ✓ Written:", fullPath);
  } catch (err: any) {
    console.error("[storagePut] ✗ Write failed", { fullPath, message: err.message, code: err.code });
    throw new Error(`Local file write failed (${err.code}): ${err.message}`);
  }

  const url = `${getBaseUrl()}/uploads/${key}`;
  return { key, url };
}

export async function storageGet(
  relKey: string
): Promise<{ key: string; url: string }> {
  const key = normalizeKey(relKey);

  if (s3) {
    const url = await getSignedUrl(
      s3,
      new GetObjectCommand({ Bucket: s3Bucket, Key: key }),
      { expiresIn: 3600 }
    );
    return { key, url };
  }

  const url = `${getBaseUrl()}/uploads/${key}`;
  return { key, url };
}
