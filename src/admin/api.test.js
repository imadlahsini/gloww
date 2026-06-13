import { describe, it, expect, vi, beforeEach } from "vitest";
import { callAdmin, loadData } from "./api.js";

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("callAdmin", () => {
  it("posts JSON and returns payload on ok+{ok:true}", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ ok: true, sha: "abc" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const out = await callAdmin({ action: "save", password: "p", data: { categories: [] } });
    expect(out).toEqual({ ok: true, sha: "abc" });
    expect(fetchMock).toHaveBeenCalledWith(
      "/.netlify/functions/admin",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("throws the server error message on non-ok", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ error: "Mot de passe incorrect." }),
    }));
    await expect(callAdmin({ action: "login", password: "x" })).rejects.toThrow("Mot de passe incorrect.");
  });

  it("throws on ok but missing ok:true (e.g. SPA fallback HTML)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => { throw new Error("not json"); },
    }));
    await expect(callAdmin({ action: "login", password: "x" })).rejects.toThrow(/inattendue/i);
  });
});

describe("loadData", () => {
  it("fetches /data.json with a cache-buster and returns parsed JSON", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ categories: [] }) });
    vi.stubGlobal("fetch", fetchMock);
    const data = await loadData();
    expect(data).toEqual({ categories: [] });
    expect(fetchMock.mock.calls[0][0]).toMatch(/^\/data\.json\?/);
  });
});
