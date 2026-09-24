import { useSyncExternalStore } from 'react';

const read = () => window.location.hash.replace(/^#/, '') || '/';
const subscribe = (cb: () => void) => {
  window.addEventListener('hashchange', cb);
  return () => window.removeEventListener('hashchange', cb);
};

export function useRoute() {
  const h = useSyncExternalStore(subscribe, read);
  const [path, qs] = h.split('?');
  const parts = path.split('/').filter(Boolean);
  return { path, parts, query: new URLSearchParams(qs ?? '') };
}

export const go = (to: string) => {
  window.location.hash = to;
};
