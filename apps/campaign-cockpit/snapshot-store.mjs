import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { randomUUID } from "node:crypto";

const VERSION = 1;
const SOURCES = ["creators", "campaigns", "assignments"];

function emptyDocument() {
  return {
    version: VERSION,
    sources: { creators: null, campaigns: null, assignments: null },
    syncedAt: { creators: null, campaigns: null, assignments: null }
  };
}

function validate(document) {
  if (!document || typeof document !== "object" || document.version !== VERSION || !document.sources || !document.syncedAt) {
    throw new Error("invalid snapshot store document");
  }
  return document;
}

export class FileSnapshotStore {
  constructor(filePath) {
    if (!filePath?.trim()) throw new Error("filePath must not be empty");
    this.filePath = filePath.trim();
    this.tail = Promise.resolve();
  }

  async ensure() {
    return this.#exclusive(async () => {
      await mkdir(dirname(this.filePath), { recursive: true });
      try {
        return await this.#read();
      } catch (error) {
        if (error?.code !== "ENOENT") throw error;
        const document = emptyDocument();
        await this.#write(document);
        return document;
      }
    });
  }

  async load() {
    return this.#exclusive(() => this.#read());
  }

  async replaceSource(source, payload, syncedAt) {
    if (!SOURCES.includes(source)) throw new Error(`unknown snapshot source: ${source}`);
    if (!Number.isFinite(Date.parse(syncedAt))) throw new Error("syncedAt must be a valid timestamp");
    return this.#exclusive(async () => {
      const document = await this.#read();
      document.sources[source] = payload;
      document.syncedAt[source] = syncedAt;
      await this.#write(document);
      return document;
    });
  }

  async status() {
    const document = await this.load();
    return {
      version: document.version,
      configuredSources: SOURCES.filter((source) => document.sources[source] !== null),
      syncedAt: document.syncedAt
    };
  }

  async #read() {
    return validate(JSON.parse(await readFile(this.filePath, "utf8")));
  }

  async #write(document) {
    validate(document);
    await mkdir(dirname(this.filePath), { recursive: true });
    const temporary = `${this.filePath}.${process.pid}.${randomUUID()}.tmp`;
    await writeFile(temporary, `${JSON.stringify(document)}\n`, { encoding: "utf8", mode: 0o600 });
    await rename(temporary, this.filePath);
  }

  #exclusive(operation) {
    const run = this.tail.then(operation, operation);
    this.tail = run.then(() => undefined, () => undefined);
    return run;
  }
}
