export const asNumber = (value: string | number | null | undefined, fallback = 0) => {
  if (typeof value === "number") return Number.isFinite(value) ? value : fallback;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
};

export const timeAgo = (iso: string | null | undefined) => {
  if (!iso) return "No telemetry";
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  return `${Math.floor(minutes / 60)}h ago`;
};

export const completionEstimate = (volume: number | null, rate: string | number | null) => {
  const flow = asNumber(rate);
  if (!volume || flow <= 0) return "Unknown";
  const hours = volume / flow;
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return `${h}h ${m}m`;
};
