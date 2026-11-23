import { randomUUID } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const storageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../private_uploads/resumes");
const allowedTypes = new Map([
  ["application/pdf", { extension: ".pdf", signature: (buffer) => buffer.subarray(0, 5).toString("ascii") === "%PDF-" }],
  ["application/msword", { extension: ".doc", signature: (buffer) => buffer.subarray(0, 8).equals(Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])) }],
  ["application/vnd.openxmlformats-officedocument.wordprocessingml.document", { extension: ".docx", signature: (buffer) => buffer.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04])) }],
]);

function resumeError(message, statusCode) { const error = new Error(message); error.statusCode = statusCode; return error; }

export function validateResumeUpload(buffer, mimeType, fileName) {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) throw resumeError("A non-empty resume file is required", 400);
  if (buffer.length > 10 * 1024 * 1024) throw resumeError("Resume files must be 10 MB or smaller", 413);
  const extension = path.extname(String(fileName ?? "")).toLowerCase();
  const type = allowedTypes.get(mimeType);
  if (!type || type.extension !== extension) throw resumeError("Only matching PDF, DOC and DOCX resumes are accepted", 415);
  if (!type.signature(buffer)) throw resumeError("The file content does not match its resume type", 400);
}

export async function storeCandidateResume(buffer, mimeType, fileName) {
  validateResumeUpload(buffer, mimeType, fileName);
  const extension = allowedTypes.get(mimeType).extension;
  const storageKey = `${randomUUID()}${extension}`;
  await mkdir(storageRoot, { recursive: true });
  await writeFile(path.join(storageRoot, storageKey), buffer, { flag: "wx", mode: 0o600 });
  return storageKey;
}

export function resolveCandidateResume(storageKey) {
  if (typeof storageKey !== "string" || !/^[a-f0-9-]{36}\.(pdf|doc|docx)$/.test(storageKey)) throw resumeError("Resume file is unavailable", 404);
  return path.join(storageRoot, storageKey);
}

export async function getCandidateResumeFile(storageKey) {
  const filePath = resolveCandidateResume(storageKey);
  const buffer = await readFile(filePath).catch((error) => {
    if (error.code === "ENOENT") throw resumeError("Resume file is unavailable", 404);
    throw error;
  });
  const extension = path.extname(storageKey);
  const mimeType = extension === ".pdf" ? "application/pdf" : extension === ".doc" ? "application/msword" : "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  return { path: filePath, file_name: `resume${extension}`, mime_type: mimeType, file_size: buffer.length };
}

export async function removeCandidateResume(storageKey) {
  if (!storageKey) return;
  try { await rm(resolveCandidateResume(storageKey), { force: true }); } catch { /* Best effort for unreferenced uploads. */ }
}
