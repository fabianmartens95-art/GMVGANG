import { describe, expect, it } from "vitest";
import { aggregateAffiliatePerformance, importAffiliatePerformanceCsv } from "./index.js";

const header = [
  "external_record_id",
  "grain",
  "channel",
  "organization_id",
  "brand_id",
  "campaign_id",
  "shop_id",
  "product_id",
  "creator_id",
  "content_id",
  "start_date",
  "end_date_exclusive",
  "time_zone",
  "currency",
  "status",
  "observed_at",
  "gmv",
  "orders",
  "impressions",
  "clicks",
  "views"
].join(",");

describe("performance CSV adapter", () => {
  it("imports synthetic product rows into the canonical model", () => {
    const csv = [
      header,
      'csv-1,product,affiliate-total,org-1,"Brand, Demo",,shop-1,product-1,,,2026-09-01,2026-09-08,Europe/Berlin,EUR,final,2026-09-09T06:00:00.000Z,100,1,1000,100,10000',
      "csv-2,product,affiliate-total,org-1,brand-1,,shop-1,product-2,,,2026-09-01,2026-09-08,Europe/Berlin,EUR,final,2026-09-09T06:00:00.000Z,200,2,2000,200,20000"
    ].join("\n");

    const batch = importAffiliatePerformanceCsv(csv, { connectionId: "fixture-import-1" });
    expect(batch.records).toHaveLength(2);
    expect(batch.records[0]?.source.provider).toBe("csv-import");
    expect(batch.records[0]?.dimensions.brandId).toBe("Brand, Demo");

    const aggregate = aggregateAffiliatePerformance(batch.records);
    expect(aggregate.metrics.gmv).toBe(300);
    expect(aggregate.metrics.orders).toBe(3);
    expect(aggregate.metrics.views).toBe(30000);
  });

  it("drops identical retry rows through canonical idempotency", () => {
    const row = "csv-1,product,affiliate-total,org-1,brand-1,,shop-1,product-1,,,2026-09-01,2026-09-08,Europe/Berlin,EUR,final,2026-09-09T06:00:00.000Z,100,1,1000,100,10000";
    const batch = importAffiliatePerformanceCsv([header, row, row].join("\n"));

    expect(batch.records).toHaveLength(1);
    expect(batch.duplicateRecordsDropped).toBe(1);
  });

  it("supports semicolon-delimited controlled exports", () => {
    const csv = [
      "external_record_id;grain;channel;shop_id;product_id;start_date;end_date_exclusive;time_zone;currency;status;observed_at;gmv;orders",
      "csv-1;product;affiliate-total;shop-1;product-1;2026-09-01;2026-09-08;Europe/Berlin;EUR;final;2026-09-09T06:00:00.000Z;100;1"
    ].join("\n");

    const batch = importAffiliatePerformanceCsv(csv, { delimiter: ";" });
    expect(batch.records[0]?.metrics.gmv).toBe(100);
  });

  it("reports row-level validation errors", () => {
    const csv = [
      header,
      "csv-1,product,affiliate-total,org-1,brand-1,,shop-1,product-1,,,2026-09-01,2026-09-08,Europe/Berlin,EUR,final,2026-09-09T06:00:00.000Z,not-a-number,1,1000,100,10000"
    ].join("\n");

    expect(() => importAffiliatePerformanceCsv(csv)).toThrow(/CSV row 2: gmv must be numeric/);
  });
});
