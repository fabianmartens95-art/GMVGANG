import { Client } from "@notionhq/client";

export function createNotionClient() {
  const auth = process.env.NOTION_TOKEN;
  if (!auth) throw new Error("NOTION_TOKEN is required");
  return new Client({ auth, notionVersion: process.env.NOTION_API_VERSION || "2026-03-11" });
}
