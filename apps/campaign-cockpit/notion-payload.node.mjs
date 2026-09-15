import assert from "node:assert/strict";
import test from "node:test";
import { notionResults } from "./notion-payload.mjs";

const rows = [{ id: "a" }, { id: "b" }];

test("reads raw paginated item arrays", () => {
  assert.equal(notionResults(rows), rows);
});

test("reads standard Notion list envelopes", () => {
  assert.deepEqual(notionResults({ results: rows }), rows);
});

test("reads wrapped Notion list envelopes", () => {
  assert.deepEqual(notionResults({ body: { results: rows } }), rows);
  assert.deepEqual(notionResults({ data: { results: rows } }), rows);
});

test("returns an empty array for missing or invalid payloads", () => {
  assert.deepEqual(notionResults(null), []);
  assert.deepEqual(notionResults({}), []);
});
