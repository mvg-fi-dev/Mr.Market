import { MRM_BACKEND_URL } from "$lib/helpers/constants";

const handleResponse = async (response: Response) => {
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  return await response.json();
};

export type ExecutionReportV0 = {
  orderId: string;
  from?: string;
  to?: string;
  totals: {
    trades: number;
    volume: string;
    buyVolume: string;
    sellVolume: string;
  };
  byDay: Array<{
    date: string;
    trades: number;
    volume: string;
    buyVolume: string;
    sellVolume: string;
  }>;
  facts: {
    source: string;
    fields: string[];
    sample: Array<Record<string, unknown>>;
  };
};

export const getExecutionReportV0 = async (params: {
  orderId: string;
  from?: string;
  to?: string;
}) => {
  const { orderId, from, to } = params;

  const qs = new URLSearchParams({ orderId });
  if (from) qs.set("from", from);
  if (to) qs.set("to", to);

  const response = await fetch(
    `${MRM_BACKEND_URL}/metrics/execution-report?${qs.toString()}`,
  );
  return (await handleResponse(response)) as ExecutionReportV0;
};
