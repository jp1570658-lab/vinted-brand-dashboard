import { useOutletContext } from 'react-router-dom';

export interface LayoutContext {
  refreshKey: number;
  bumpRefresh: () => void;
  openIntake: () => void;
  onMenu: () => void;
}

export function useLayout(): LayoutContext {
  return useOutletContext<LayoutContext>();
}
