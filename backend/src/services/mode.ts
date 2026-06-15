/**
 * Single source of truth for DEMO vs LIVE mode.
 * Read once from APP_MODE (default DEMO). Every external integration
 * branches on this so LIVE swaps are surgical.
 */
export type AppMode = 'DEMO' | 'LIVE';

export const APP_MODE: AppMode = process.env.APP_MODE === 'LIVE' ? 'LIVE' : 'DEMO';

export const isDemo = (): boolean => APP_MODE === 'DEMO';
export const isLive = (): boolean => APP_MODE === 'LIVE';
