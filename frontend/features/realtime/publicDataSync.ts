export type PublicSyncTable =
  | 'announcements'
  | 'emergency_contacts'
  | 'events'
  | 'knowledge_base'
  | 'community_reports';

const publicDataSyncEvent = 'cora:public-data-sync';

export function subscribeToPublicDataSync(
  table: PublicSyncTable,
  callback: () => void,
): () => void {
  if (typeof window === 'undefined') return () => {};

  const listener = (event: Event) => {
    const detail = (event as CustomEvent<{ table?: string }>).detail;
    if (detail?.table === table) callback();
  };

  window.addEventListener(publicDataSyncEvent, listener);
  return () => window.removeEventListener(publicDataSyncEvent, listener);
}

export function dispatchPublicDataSync(table: PublicSyncTable): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(publicDataSyncEvent, { detail: { table } }));
}
