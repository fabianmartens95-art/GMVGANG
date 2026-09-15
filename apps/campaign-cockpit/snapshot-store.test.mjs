import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { FileSnapshotStore } from "./snapshot-store.mjs";

async function withStore(run) {
  const directory = await mkdtemp(join(tmpdir(), "gmvgang-snapshot-store-"));
  const filePath = join(directory, "snapshot.json");
  try {
    const store = new FileSnapshotStore(filePath);
    await store.ensure();
    await run({ store, filePath });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

test("restores snapshots after restart", async () => {
  await withStore(async ({ store, filePath }) => {
    await store.replaceSource("creators", { object: "list", results: [{ id: "creator-1" }] }, "2026-09-15T21:00:00.000Z");
    await store.replaceSource("campaigns", { object: "list", results: [{ id: "campaign-1" }] }, "2026-09-15T21:00:01.000Z");

    const restarted = new FileSnapshotStore(filePath);
    const restored = await restarted.ensure();
    assert.equal(restored.sources.creators.results[0].id, "creator-1");
    assert.equal(restored.sources.campaigns.results[0].id, "campaign-1");
    assert.equal(restored.syncedAt.creators, "2026-09-15T21:00:00.000Z");
  });
});

test("serializes concurrent source writes", async () => {
  await withStore(async ({ store }) => {
    await Promise.all([
      store.replaceSource("creators", { results: [{ id: "creator-1" }] }, "2026-09-15T21:00:00.000Z"),
      store.replaceSource("campaigns", { results: [{ id: "campaign-1" }] }, "2026-09-15T21:00:01.000Z"),
      store.replaceSource("assignments", { results: [{ id: "assignment-1" }] }, "2026-09-15T21:00:02.000Z")
    ]);
    const restored = await store.load();
    assert.equal(restored.sources.creators.results[0].id, "creator-1");
    assert.equal(restored.sources.campaigns.results[0].id, "campaign-1");
    assert.equal(restored.sources.assignments.results[0].id, "assignment-1");
  });
});

test("rejects unknown sources", async () => {
  await withStore(async ({ store }) => {
    await assert.rejects(
      () => store.replaceSource("other", {}, "2026-09-15T21:00:00.000Z"),
      /unknown snapshot source/
    );
  });
});
