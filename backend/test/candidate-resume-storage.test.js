import test from "node:test";
import assert from "node:assert/strict";
import { resolveCandidateResume, validateResumeUpload } from "../src/services/candidate-resume-storage.js";

const docMagic = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
const docxMagic = Buffer.from([0x50, 0x4b, 0x03, 0x04]);

test("accepts supported resume types with matching file signatures", () => {
  assert.doesNotThrow(() => validateResumeUpload(Buffer.from("%PDF-1.7 content"), "application/pdf", "resume.pdf"));
  assert.doesNotThrow(() => validateResumeUpload(docMagic, "application/msword", "resume.doc"));
  assert.doesNotThrow(() => validateResumeUpload(docxMagic, "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "resume.docx"));
});

test("rejects unsupported, mismatched, empty, oversized, or spoofed resume files", () => {
  assert.throws(() => validateResumeUpload(Buffer.from("file"), "text/plain", "resume.txt"), { statusCode: 415 });
  assert.throws(() => validateResumeUpload(docMagic, "application/pdf", "resume.pdf"), { statusCode: 400 });
  assert.throws(() => validateResumeUpload(Buffer.alloc(0), "application/pdf", "resume.pdf"), { statusCode: 400 });
  assert.throws(() => validateResumeUpload(Buffer.alloc(10 * 1024 * 1024 + 1), "application/pdf", "resume.pdf"), { statusCode: 413 });
});

test("only resolves generated resume storage keys", () => {
  assert.match(resolveCandidateResume("123e4567-e89b-12d3-a456-426614174000.pdf"), /private_uploads[\\/]resumes[\\/]123e4567-e89b-12d3-a456-426614174000\.pdf$/);
  assert.throws(() => resolveCandidateResume("../../secrets.pdf"), { statusCode: 404 });
});
