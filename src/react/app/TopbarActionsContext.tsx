import { createContext, useContext, type ReactNode } from 'react';

type TopbarActionsSetter = (content: ReactNode | null) => void;

const TopbarActionsContext = createContext<TopbarActionsSetter>(() => {});

function useTopbarActions() {
  return useContext(TopbarActionsContext);
}

export { TopbarActionsContext, useTopbarActions };
