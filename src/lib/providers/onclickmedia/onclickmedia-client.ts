const BASE_URL = "https://api.onclickmedia.com";
const TIMEOUT_MS = 20_000;
const MAX_ATTEMPTS = 3;

export class OnclickMediaError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = "OnclickMediaError";
  }
}

function safeProviderMessage(value: unknown): string {
  if (typeof value !== "object" || value === null || !("error" in value)) {
    return "OnclickMedia returned an invalid response";
  }
  const message = String(value.error);
  return message.replace(/(?:postgres(?:ql)?|https?):\/\/\S+/gi, "[redacted-url]");
}

export class OnclickMediaClient {
  constructor(private readonly apiKey = process.env.ONCLICKMEDIA_API_KEY?.trim()) {}

  async get(path: string, params: Record<string, string | undefined>): Promise<unknown> {
    const url = new URL(path, BASE_URL);
    for (const [key, value] of Object.entries(params)) {
      if (value) url.searchParams.set(key, value);
    }
    if (this.apiKey) url.searchParams.set("apikey", this.apiKey);

    let lastError: unknown;
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
      try {
        const response = await fetch(url, {
          headers: { Accept: "application/json" },
          cache: "no-store",
          signal: controller.signal,
        });
        const text = await response.text();
        let json: unknown;
        try {
          json = JSON.parse(text);
        } catch {
          throw new OnclickMediaError("OnclickMedia returned non-JSON data", response.status);
        }
        if (!response.ok) {
          throw new OnclickMediaError(`OnclickMedia request failed (${response.status})`, response.status);
        }
        if (typeof json === "object" && json !== null && "error" in json) {
          throw new OnclickMediaError(safeProviderMessage(json), response.status);
        }
        return json;
      } catch (error) {
        lastError = error;
        if (attempt === MAX_ATTEMPTS - 1) break;
        await new Promise((resolve) => setTimeout(resolve, 400 * 2 ** attempt));
      } finally {
        clearTimeout(timeout);
      }
    }

    if (lastError instanceof OnclickMediaError) throw lastError;
    throw new OnclickMediaError(
      lastError instanceof Error && lastError.name === "AbortError"
        ? "OnclickMedia request timed out"
        : "OnclickMedia request failed",
    );
  }
}
