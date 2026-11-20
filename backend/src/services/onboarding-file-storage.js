import { randomUUID } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const storageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../private_uploads/onboarding");
const allowedTypes = new Map([
  ["application/pdf", ".pdf"],
  ["image/jpeg", ".jpg"],
  ["image/png", ".png"],
]);

function uploadError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

export function validateDocumentUpload(buffer, mimeType) {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) throw uploadError("A non-empty document file is required", 400);
  if (buffer.length > 10 * 1024 * 1024) throw uploadError("Document files must be 10 MB or smaller", 413);
  if (!allowedTypes.has(mimeType)) throw uploadError("Only PDF, JPEG and PNG documents are accepted", 415);
  const validSignature = mimeType === "application/pdf"
    ? buffer.subarray(0, 5).toString("ascii") === "%PDF-"
    : mimeType === "image/png"
      ? buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
      : buffer.subarray(0, 3).equals(Buffer.from([255, 216, 255]));
  if (!validSignature) throw uploadError("The file content does not match its MIME type", 400);
}

export async function storeOnboardingDocument(buffer, mimeType) {
  validateDocumentUpload(buffer, mimeType);
  const storageKey = `${randomUUID()}${allowedTypes.get(mimeType)}`;
  await mkdir(storageRoot, { recursive: true });
  await writeFile(path.join(storageRoot, storageKey), buffer, { flag: "wx", mode: 0o600 });
  return storageKey;
}

export function resolveOnboardingDocument(storageKey) {
  if (typeof storageKey !== "string" || !/^[a-f0-9-]{36}\.(pdf|jpg|png)$/.test(storageKey)) {
    throw uploadError("Document file is unavailable", 404);
  }
  return path.join(storageRoot, storageKey);
}

export async function removeOnboardingDocument(storageKey) {
  if (!storageKey) return;
  try { await rm(resolveOnboardingDocument(storageKey), { force: true }); } catch { /* Cleanup is best effort. */ }
}
