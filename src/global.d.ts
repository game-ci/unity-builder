/* eslint-disable no-unused-vars */
export type Level = 'debug' | 'info' | 'warn' | 'error' | 'critical';

declare global {
  const log: (level: Level, ...args: any[]) => void;

  interface Window {
    log: any;
  }
}
