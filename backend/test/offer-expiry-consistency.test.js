import test from "node:test";
import assert from "node:assert/strict";
import pool from "../src/config/database.js";
import { listOffersService } from "../src/services/offer.service.js";
import { listCandidateOffers } from "../src/repositories/candidate-offer.repository.js";

test("management API derives EXPIRED and separates EXPIRED from ISSUED filters at the date boundary", async (t) => {
  const calls = [];
  t.mock.method(pool, "execute", async (sql, values) => {
    calls.push({ sql, values });
    return [[{ id: 5, status: "ISSUED", effective_status: "EXPIRED", expiry_date: "2026-06-10" }], []];
  });
  const user = { organization_id: 7 };
  const expired = await listOffersService({ status: "EXPIRED" }, user);
  assert.equal(expired[0].status, "EXPIRED");
  assert.equal("effective_status" in expired[0], false);
  assert.match(calls[0].sql, /o\.status = 'ISSUED' AND o\.expiry_date IS NOT NULL AND o\.expiry_date < CURRENT_DATE/);
  assert.deepEqual(calls[0].values, [7]);

  await listOffersService({ status: "ISSUED" }, user);
  assert.match(calls[1].sql, /o\.expiry_date IS NULL OR o\.expiry_date >= CURRENT_DATE/);
  assert.deepEqual(calls[1].values, [7]);
  await assert.rejects(listOffersService({ status: "NOT_A_STATUS" }, user), { statusCode: 400 });
});

test("candidate offer list retains expired issued offers and returns derived status", async (t) => {
  let call;
  t.mock.method(pool, "execute", async (sql, values) => {
    call = { sql, values };
    return [[{ id: 5, status: "EXPIRED", expiry_date: "2026-06-10" }], []];
  });
  const offers = await listCandidateOffers(19, 7);
  assert.equal(offers[0].status, "EXPIRED");
  assert.match(call.sql, /CASE WHEN o\.status = 'ISSUED'.*o\.expiry_date < CURRENT_DATE/s);
  assert.match(call.sql, /o\.status IN \('ISSUED', 'ACCEPTED', 'DECLINED'\)/);
  assert.deepEqual(call.values, [19, 7]);
});
