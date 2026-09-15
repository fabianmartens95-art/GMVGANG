export const euro = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0
});

export const integer = new Intl.NumberFormat("de-DE");
export const percentage = new Intl.NumberFormat("de-DE", { maximumFractionDigits: 1 });

export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function label(value: string): string {
  return value.replaceAll("_", " ").replace(/(^|\s)\S/g, (character) => character.toUpperCase());
}

export function tone(value: string): string {
  if (["active", "posted", "accepted", "delivered", "complete", "healthy"].includes(value)) return "positive";
  if (["declined", "rejected", "cancelled", "blocked"].includes(value)) return "negative";
  if (["draft", "approved", "queued", "requested", "content_due", "attention", "paused"].includes(value)) return "warning";
  return "neutral";
}

export function pill(value: string): string {
  return `<span class="pill pill--${tone(value)}">${escapeHtml(label(value))}</span>`;
}
