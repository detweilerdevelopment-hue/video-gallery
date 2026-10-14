import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({ getDb: vi.fn() }));
vi.mock("@/lib/env", () => ({
  getServerEnv: () => ({
    APP_URL: "http://localhost:3000",
    AUTH_SECRET: "test-secret-at-least-thirty-two-characters",
    MONGODB_URI: "mongodb://example",
    MONGODB_DB_NAME: "test",
  }),
}));

import { assertSameOrigin } from "@/lib/security";

describe("same-origin request validation", () => {
  it("accepts the configured application origin", () => {
    const request = new Request("http://internal:3000/api/storage/upload", {
      headers: { origin: "http://localhost:3000" },
    });
    expect(() => assertSameOrigin(request)).not.toThrow();
  });

  it("accepts the public request host when APP_URL is stale", () => {
    const request = new Request("http://internal:3000/api/storage/upload", {
      headers: { host: "husky-und-foxy.com", origin: "https://husky-und-foxy.com" },
    });
    expect(() => assertSameOrigin(request)).not.toThrow();
  });

  it("accepts Hostinger forwarded host and protocol headers", () => {
    const request = new Request("http://internal:3000/api/storage/upload", {
      headers: {
        host: "internal:3000",
        origin: "https://www.husky-und-foxy.com",
        "x-forwarded-host": "www.husky-und-foxy.com",
        "x-forwarded-proto": "https",
      },
    });
    expect(() => assertSameOrigin(request)).not.toThrow();
  });

  it("rejects cross-site and protocol-mismatched origins", () => {
    const crossSite = new Request("http://internal:3000/api/storage/upload", {
      headers: { host: "husky-und-foxy.com", origin: "https://attacker.example" },
    });
    const wrongProtocol = new Request("http://internal:3000/api/storage/upload", {
      headers: {
        origin: "http://husky-und-foxy.com",
        "x-forwarded-host": "husky-und-foxy.com",
        "x-forwarded-proto": "https",
      },
    });
    expect(() => assertSameOrigin(crossSite)).toThrow("Invalid request origin");
    expect(() => assertSameOrigin(wrongProtocol)).toThrow("Invalid request origin");
  });

  it("rejects requests without an Origin header", () => {
    expect(() => assertSameOrigin(new Request("https://husky-und-foxy.com/api/storage/upload"))).toThrow("Invalid request origin");
  });
});
