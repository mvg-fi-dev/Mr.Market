export type OutboxSummaryV0 = {
  total: number;
  topicCounts: Record<string, number>;
  firstCreatedAt?: string;
  lastCreatedAt?: string;
};

export function buildOutboxSummaryV0(
  events: Array<{ topic?: string; createdAt?: string }>,
): OutboxSummaryV0 {
  const topicCounts: Record<string, number> = {};

  let firstCreatedAt: string | undefined;
  let lastCreatedAt: string | undefined;

  for (const e of events) {
    const topic = e.topic || 'unknown';
    topicCounts[topic] = (topicCounts[topic] || 0) + 1;

    if (e.createdAt) {
      if (!firstCreatedAt || e.createdAt < firstCreatedAt) firstCreatedAt = e.createdAt;
      if (!lastCreatedAt || e.createdAt > lastCreatedAt) lastCreatedAt = e.createdAt;
    }
  }

  return {
    total: events.length,
    topicCounts,
    firstCreatedAt,
    lastCreatedAt,
  };
}
