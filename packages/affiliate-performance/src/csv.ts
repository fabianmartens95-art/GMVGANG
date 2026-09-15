import { normalizePerformanceBatch, normalizePerformanceRecord } from "./normalize.js";
import {
  type AffiliatePerformanceMetrics,
  type AffiliatePerformanceRecord,
  type NormalizedPerformanceBatch,
  type PerformanceChannel,
  type PerformanceDimensions,
  type PerformanceGrain,
  type PerformanceProvider
} from "./types.js";

const GRAINS = new Set<PerformanceGrain>(["shop", "campaign", "creator", "product", "content"]);
const CHANNELS = new Set<PerformanceChannel>([
  "total",
  "affiliate-total",
  "affiliate-video",
  "affiliate-live",
  "seller-video",
  "seller-live",
  "seller-product-card",
  "shop-tab",
  "unknown"
]);

const REQUIRED_COLUMNS = [
  "external_record_id",
  "grain",
  "channel",
  "start_date",
  "end_date_exclusive",
  "time_zone",
  "currency",
  "status",
  "observed_at"
] as const;

const METRIC_COLUMNS = [
  ["gmv", "gmv"],
  ["orders", "orders"],
  ["units_sold", "unitsSold"],
  ["commission", "commission"],
  ["refunds", "refunds"],
  ["refunded_items", "refundedItems"],
  ["impressions", "impressions"],
  ["clicks", "clicks"],
  ["add_to_cart", "addToCart"],
  ["views", "views"],
  ["creator_posts", "creatorPosts"]
] as const;

export interface PerformanceCsvImportOptions {
  delimiter?: "," | ";";
  provider?: PerformanceProvider;
  connectionId?: string;
}

function parseCsvTable(input: string, delimiter: "," | ";"): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index]!;

    if (quoted) {
      if (char === '"') {
        if (input[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          quoted = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      if (field.length > 0) throw new Error("CSV quote must start at the beginning of a field");
      quoted = true;
      continue;
    }

    if (char === delimiter) {
      row.push(field);
      field = "";
      continue;
    }

    if (char === "\n" || char === "\r") {
      if (char === "\r" && input[index + 1] === "\n") index += 1;
      row.push(field);
      field = "";
      if (row.some((value) => value.trim() !== "")) rows.push(row);
      row = [];
      continue;
    }

    field += char;
  }

  if (quoted) throw new Error("CSV contains an unterminated quoted field");
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    if (row.some((value) => value.trim() !== "")) rows.push(row);
  }

  return rows;
}

function headerIndex(header: readonly string[]): Map<string, number> {
  const result = new Map<string, number>();
  header.forEach((raw, index) => {
    const name = raw.trim().toLowerCase();
    if (!name) throw new Error("CSV contains an empty header");
    if (result.has(name)) throw new Error(`CSV contains duplicate header ${name}`);
    result.set(name, index);
  });
  return result;
}

function cell(row: readonly string[], headers: ReadonlyMap<string, number>, name: string): string {
  const index = headers.get(name);
  if (index === undefined) return "";
  return (row[index] ?? "").trim();
}

function requireCell(row: readonly string[], headers: ReadonlyMap<string, number>, name: string): string {
  const value = cell(row, headers, name);
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function parseMetric(raw: string, label: string): number | undefined {
  if (!raw) return undefined;
  const value = Number(raw);
  if (!Number.isFinite(value)) throw new Error(`${label} must be numeric`);
  return value;
}

function dimensionsFromRow(row: readonly string[], headers: ReadonlyMap<string, number>): PerformanceDimensions {
  const dimensions: PerformanceDimensions = {};
  const mappings = [
    ["organization_id", "organizationId"],
    ["brand_id", "brandId"],
    ["campaign_id", "campaignId"],
    ["shop_id", "shopId"],
    ["product_id", "productId"],
    ["creator_id", "creatorId"],
    ["content_id", "contentId"]
  ] as const;

  for (const [column, key] of mappings) {
    const value = cell(row, headers, column);
    if (value) dimensions[key] = value;
  }
  return dimensions;
}

function metricsFromRow(row: readonly string[], headers: ReadonlyMap<string, number>): AffiliatePerformanceMetrics {
  const metrics: AffiliatePerformanceMetrics = {};
  for (const [column, key] of METRIC_COLUMNS) {
    const value = parseMetric(cell(row, headers, column), column);
    if (value !== undefined) metrics[key] = value;
  }
  return metrics;
}

export function importAffiliatePerformanceCsv(
  input: string,
  options: PerformanceCsvImportOptions = {}
): NormalizedPerformanceBatch {
  const delimiter = options.delimiter ?? ",";
  const table = parseCsvTable(input, delimiter);
  const header = table[0];
  if (!header) throw new Error("CSV must contain a header row");

  const headers = headerIndex(header);
  for (const required of REQUIRED_COLUMNS) {
    if (!headers.has(required)) throw new Error(`CSV is missing required column ${required}`);
  }

  const provider = options.provider ?? "csv-import";
  const connectionId = options.connectionId?.trim();
  const records: AffiliatePerformanceRecord[] = [];

  for (let index = 1; index < table.length; index += 1) {
    const row = table[index]!;
    const csvLine = index + 1;

    try {
      const grainRaw = requireCell(row, headers, "grain") as PerformanceGrain;
      if (!GRAINS.has(grainRaw)) throw new Error(`unsupported grain ${grainRaw}`);

      const channelRaw = requireCell(row, headers, "channel") as PerformanceChannel;
      if (!CHANNELS.has(channelRaw)) throw new Error(`unsupported channel ${channelRaw}`);

      const statusRaw = requireCell(row, headers, "status");
      if (statusRaw !== "provisional" && statusRaw !== "final") {
        throw new Error(`unsupported status ${statusRaw}`);
      }

      const record: AffiliatePerformanceRecord = {
        source: {
          provider,
          externalRecordId: requireCell(row, headers, "external_record_id"),
          ...(connectionId ? { connectionId } : {})
        },
        grain: grainRaw,
        channel: channelRaw,
        dimensions: dimensionsFromRow(row, headers),
        window: {
          startDate: requireCell(row, headers, "start_date"),
          endDateExclusive: requireCell(row, headers, "end_date_exclusive"),
          timeZone: requireCell(row, headers, "time_zone")
        },
        currency: requireCell(row, headers, "currency"),
        status: statusRaw,
        metrics: metricsFromRow(row, headers),
        observedAt: requireCell(row, headers, "observed_at")
      };

      records.push(normalizePerformanceRecord(record));
    } catch (error) {
      const message = error instanceof Error ? error.message : "invalid performance row";
      throw new Error(`CSV row ${csvLine}: ${message}`);
    }
  }

  if (records.length === 0) throw new Error("CSV must contain at least one performance row");
  return normalizePerformanceBatch(records);
}
