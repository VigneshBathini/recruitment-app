import test from "node:test";
import assert from "node:assert/strict";
import { rejectRequirementController } from "../src/controllers/requirement.controller.js";

test("requirement rejection requires a nonempty string reason and returns 400 for malformed bodies", async () => {
  for (const body of [undefined, {}, { rejection_reason: 12 }, { rejection_reason: "   " }]) {
    let statusCode;
    let payload;
    let nextError;
    const response = {
      status(code) { statusCode = code; return this; },
      json(value) { payload = value; return this; },
    };
    await rejectRequirementController({ body }, response, (error) => { nextError = error; });
    assert.equal(statusCode, 400);
    assert.equal(payload.success, false);
    assert.equal(nextError, undefined);
  }
});
