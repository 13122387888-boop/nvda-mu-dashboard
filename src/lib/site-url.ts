const CANONICAL_PRODUCTION_ORIGIN = "https://eodradar.com";

function normalizeOrigin(value: string) {
  const withProtocol = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  return new URL(withProtocol).origin;
}

function isLocalOrigin(value: string) {
  try {
    const hostname = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`).hostname;
    return hostname === "localhost" || hostname === "127.0.0.1";
  } catch {
    return false;
  }
}

export function getSiteOrigin() {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();

  if (configured && (process.env.NODE_ENV !== "production" || !isLocalOrigin(configured))) {
    return normalizeOrigin(configured);
  }

  const vercelOrigin =
    process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim() ||
    process.env.VERCEL_URL?.trim();

  if (vercelOrigin) return normalizeOrigin(vercelOrigin);
  if (configured) return normalizeOrigin(configured);

  return process.env.NODE_ENV === "production"
    ? CANONICAL_PRODUCTION_ORIGIN
    : "http://localhost:3000";
}
