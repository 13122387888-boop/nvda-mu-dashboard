import { afterEach, describe, expect, it, vi } from "vitest";
import { getSiteOrigin } from "./site-url";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("getSiteOrigin", () => {
  it("prefers an explicitly configured public origin", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://eodradar.example/path");
    vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "project.vercel.app");

    expect(getSiteOrigin()).toBe("https://eodradar.example");
  });

  it("does not publish localhost metadata in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "http://localhost:3000");
    vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "project.vercel.app");

    expect(getSiteOrigin()).toBe("https://project.vercel.app");
  });

  it("keeps localhost for local development", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "http://localhost:3000");
    vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "");
    vi.stubEnv("VERCEL_URL", "");

    expect(getSiteOrigin()).toBe("http://localhost:3000");
  });

  it("uses the canonical public origin as the production fallback", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
    vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "");
    vi.stubEnv("VERCEL_URL", "");

    expect(getSiteOrigin()).toBe("https://eodradar.com");
  });
});
