import test from "node:test";
import assert from "node:assert/strict";
import { candidateOfferResponseSchema } from "../src/schemas/candidate.schema.js";

test("candidate offer response allows omitted or trimmed optional comments", () => {
  assert.deepEqual(candidateOfferResponseSchema.parse({}), {});
  assert.deepEqual(candidateOfferResponseSchema.parse({ comments: "  Thank you  " }), { comments: "Thank you" });
  assert.deepEqual(candidateOfferResponseSchema.parse({ comments: null }), { comments: null });
});

test("candidate offer response rejects identity fields in the body", () => {
  assert.equal(candidateOfferResponseSchema.safeParse({ candidate_id: 3 }).success, false);
  assert.equal(candidateOfferResponseSchema.safeParse({ organization_id: 8, comments: "Yes" }).success, false);
});

test("candidate offer response rejects invalid comments", () => {
  assert.equal(candidateOfferResponseSchema.safeParse({ comments: 12 }).success, false);
  assert.equal(candidateOfferResponseSchema.safeParse({ comments: "x".repeat(5001) }).success, false);
  assert.equal(candidateOfferResponseSchema.safeParse(null).success, false);
});
