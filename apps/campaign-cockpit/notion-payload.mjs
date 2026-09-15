export function notionResults(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  if (Array.isArray(raw.results)) return raw.results;
  if (raw.body && Array.isArray(raw.body.results)) return raw.body.results;
  if (raw.data && Array.isArray(raw.data.results)) return raw.data.results;
  return [];
}
