export function requireServerEnv(name: "DATABASE_URL" | "CRON_SECRET"): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required for this operation`);
  return value;
}

export function sanitizeError(error: unknown): string {
  const message = error instanceof Error ? error.message : "Unknown error";
  return message
    .replace(/(?:postgres(?:ql)?|https?):\/\/[^\s]+/gi, "[redacted-url]")
    .replace(/(apikey|api_key|authorization|password)=?[^\s&]+/gi, "$1=[redacted]")
    .slice(0, 1000);
}
