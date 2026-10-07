// Current viewer (owner G1). Re-renders on login/logout/view-as and when the viewer's own data changes
// (e.g. onboarding completed, notification preference). Identity is stable while the content is unchanged.
import { useSyncExternalStore } from 'react';
import type { Viewer } from '@/services/contract';
import { api } from '@/services/api';

let cache: { key: string; viewer: Viewer | null } | null = null;

function getSnapshot(): Viewer | null {
  const viewer = api.getViewer();
  const key = viewer ? JSON.stringify(viewer) : 'null';
  if (cache && cache.key === key) return cache.viewer;
  cache = { key, viewer };
  return viewer;
}

function subscribe(onChange: () => void): () => void {
  const offViewer = api.onViewerChange(onChange);
  const offData = api.onDataChange(onChange);
  return () => {
    offViewer();
    offData();
  };
}

export function useViewer(): Viewer | null {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
