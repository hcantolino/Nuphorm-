// Local filesystem storage for development
// Files are written to ./uploads/ and served by Express at /uploads/*
// No cloud credentials required.

import fs from "fs";
import path from "path";

export const UPLOADS_DIR = path.resolve(process.cwd(), "uploads");

// Ensure the directory exists as soon as this module loads
fs.mkdirSync(UPLOADS_DIR, { recursive: true });

/** Returns the base URL the Express server is listening on.
 *  index.ts sets process.env.PORT before calling server.listen, so this is accurate. */
function getBaseUrl(): string {
  return `http://localhost:${process.env.PORT ?? "3000"}`;
}

function normalizeKey(relKey: string): string {
  return relKey.replace(/^\/+/, "");
}

export async function storagePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType = "application/octet-stream"
): Promise<{ key: string; url: string }> {
  const key = normalizeKey(relKey);
  const fullPath = path.join(UPLOADS_DIR, key);

  // Keys may contain slashes (e.g. "1-files/timestamp-data.csv") — create parent dirs
  await fs.promises.mkdir(path.dirname(fullPath), { recursive: true });

  const buffer: Buffer =
    typeof data === "string"
      ? Buffer.from(data)
      : Buffer.from(data as Uint8Array);

  console.log("[storagePut] Writing to disk", {
    key,
    fullPath,
    bytes: buffer.length,
    contentType,
  });

  try {
    await fs.promises.writeFile(fullPath, buffer);
    console.log("[storagePut] ✓ Written:", fullPath);
  } catch (err: any) {
    console.error("[storagePut] ✗ Write failed", {
      fullPath,
      message: err.message,
      code: err.code,
    });
    throw new Error(`Local file write failed (${err.code}): ${err.message}`);
  }

  const url = `${getBaseUrl()}/uploads/${key}`;
  return { key, url };
}

export async function storageGet(
  relKey: string
): Promise<{ key: string; url: string }> {
  const key = normalizeKey(relKey);
  const url = `${getBaseUrl()}/uploads/${key}`;
  return { key, url };
}
