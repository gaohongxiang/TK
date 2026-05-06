import { createRoot } from 'react-dom/client';
import { ReactIsland } from './app/ReactIsland';

function mountReactIsland(documentRef: Document = document) {
  const root = documentRef.getElementById('react-island-root');
  if (!root || root.dataset.reactMounted === 'true') return false;
  createRoot(root).render(<ReactIsland />);
  root.dataset.reactMounted = 'true';
  return true;
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => mountReactIsland(), { once: true });
  } else {
    mountReactIsland();
  }
}

export { mountReactIsland };
