import {
  getUserOrderMarketMakingById,
  getMarketMakingHistoryByInstanceId,
} from "$lib/helpers/mrm/strategy";
import { getExecutionReportV0 } from "$lib/helpers/mrm/metrics";

export async function load({ params }: { params: { id: string } }) {
  const [order, history, executionReport] = await Promise.all([
    getUserOrderMarketMakingById(params.id),
    getMarketMakingHistoryByInstanceId(params.id),
    getExecutionReportV0({ orderId: params.id }).catch((e) => {
      console.error("Failed to load execution report v0:", e);
      return null;
    }),
  ]);

  return {
    order,
    history,
    executionReport,
  };
}
