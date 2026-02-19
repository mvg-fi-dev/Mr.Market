import { getMarketMakingHistoryByInstanceId } from "$lib/helpers/mrm/strategy";

export async function load({ params }: { params: { id: string } }) {
  const history = await getMarketMakingHistoryByInstanceId(params.id).catch((e) => {
    console.error("Failed to load market making history:", e);
    return [];
  });

  return {
    history,
  };
}
