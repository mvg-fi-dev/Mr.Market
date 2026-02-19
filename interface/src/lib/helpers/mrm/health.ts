import { MRM_BACKEND_URL } from "$lib/helpers/constants";

const handleResponse = async (response: Response) => {
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`HTTP ${response.status}: ${text || response.statusText}`);
  }
  return (await response.json()) as unknown;
};

export type SystemStatus = {
  timestamp: string;
  ok: boolean;
  queues: {
    snapshots: {
      name: string;
      isPaused: boolean;
      waiting: number;
      active: number;
      completed: number;
      failed: number;
      delayed: number;
    };
    marketMaking: {
      name: string;
      isPaused: boolean;
      waiting: number;
      active: number;
      completed: number;
      failed: number;
      delayed: number;
    };
  };
  tick: {
    running: boolean;
    tickSizeMs: number;
    lastTickAtMs: number | null;
    lastTickAt: string | null;
    tickCount: number;
    recentlyTicked: boolean;
  };
  issues: string[];
};

export const getSystemStatus = async (): Promise<SystemStatus> => {
  const response = await fetch(`${MRM_BACKEND_URL}/health/system-status`);
  return (await handleResponse(response)) as SystemStatus;
};
