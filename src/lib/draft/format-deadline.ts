/**
 * Format a discount "good through" date as "Month D" (e.g. "June 23").
 * timeZone:"UTC" is mandatory so the displayed day never shifts with the
 * server's local timezone.
 */
export function formatDeadline(d: Date): string {
  return d.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}
