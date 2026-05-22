export function autoSendEnabled(): boolean {
  return process.env.AUTO_SEND_ENABLED === "1";
}

export function autoSendDailyCap(): number {
  return readPositiveInt("AUTO_SEND_DAILY_CAP", 50);
}

export function autoSendMinDelayMinutes(): number {
  return readPositiveInt("AUTO_SEND_MIN_DELAY_MINUTES", 20);
}

export function autoSendMaxDelayMinutes(): number {
  return Math.max(autoSendMinDelayMinutes(), readPositiveInt("AUTO_SEND_MAX_DELAY_MINUTES", 45));
}

export function autoSendMaxPerRun(): number {
  return Math.min(5, readPositiveInt("AUTO_SEND_MAX_PER_RUN", 3));
}

export function nextAutoSendDelayMinutes(): number {
  const min = autoSendMinDelayMinutes();
  const max = autoSendMaxDelayMinutes();
  return min + Math.floor(Math.random() * (max - min + 1));
}

function readPositiveInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}
