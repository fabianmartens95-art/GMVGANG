export function round(value: number): number {
  return Math.round((value + Number.EPSILON) * 10000) / 10000;
}

export function clampScore(value: number): number {
  return Math.max(0, Math.min(100, value));
}

export function normalize(value: string): string {
  return value.trim().toLocaleLowerCase("en-US");
}

export function anyMatch(target: string[], actual: string[]): number {
  const set = new Set(actual.map(normalize));
  return target.map(normalize).some((value) => set.has(value)) ? 100 : 0;
}

export function overlap(target: string[], actual: string[]): number {
  if (target.length === 0 || actual.length === 0) return 0;
  const set = new Set(actual.map(normalize));
  const matches = target.map(normalize).filter((value) => set.has(value)).length;
  return clampScore((matches / target.length) * 100);
}

export function gmvScore(gmv: number): number {
  if (gmv <= 0) return 0;
  return clampScore((Math.log10(gmv + 1) / Math.log10(10001)) * 100);
}

export function conversionScore(rate: number): number {
  return clampScore((rate / 0.08) * 100);
}

export function recencyScore(date: string | null): number {
  if (!date) return 0;
  const parsed = Date.parse(date);
  if (!Number.isFinite(parsed)) return 0;
  const days = Math.max(0, (Date.now() - parsed) / 86400000);
  if (days <= 7) return 100;
  if (days <= 30) return 70;
  if (days <= 60) return 45;
  if (days <= 90) return 25;
  return 10;
}
