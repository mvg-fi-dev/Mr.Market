import { describe, expect, it, vi } from "vitest";

import { getSystemStatus } from "$lib/helpers/mrm/health";

const makeResponse = (init: { ok: boolean; status?: number; json?: any; text?: string }) => {
  return {
    ok: init.ok,
    status: init.status ?? (init.ok ? 200 : 500),
    statusText: init.ok ? "OK" : "Internal Server Error",
    json: async () => init.json,
    text: async () => init.text ?? "",
  } as unknown as Response;
};

describe("getSystemStatus", () => {
  it("returns parsed payload when ok", async () => {
    const payload = {
      timestamp: "2026-01-01T00:00:00Z",
      ok: true,
      queues: {
        snapshots: { name: "snapshots", isPaused: false, waiting: 0, active: 0, completed: 1, failed: 0, delayed: 0 },
        marketMaking: { name: "market-making", isPaused: false, waiting: 0, active: 1, completed: 0, failed: 0, delayed: 0 },
      },
      tick: {
        running: true,
        tickSizeMs: 1000,
        lastTickAtMs: 123,
        lastTickAt: "2026-01-01T00:00:00Z",
        tickCount: 10,
        recentlyTicked: true,
      },
      issues: [],
    };

    const fetchMock = vi.fn().mockResolvedValue(makeResponse({ ok: true, json: payload }));
    vi.stubGlobal("fetch", fetchMock);

    const res = await getSystemStatus();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toContain("/health/system-status");
    expect(res.ok).toBe(true);
    expect(res.queues.snapshots.name).toBe("snapshots");
  });

  it("throws with status and body when not ok", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      makeResponse({ ok: false, status: 500, text: "boom" }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(getSystemStatus()).rejects.toThrow(/HTTP 500: boom/);
  });
});
