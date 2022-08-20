import { Verbosity } from './core/logger/index.ts';

let log: {
  verbosity: Verbosity;
  isQuiet: boolean;
  isVerbose: boolean;
  isVeryVerbose: boolean;
  isMaxVerbose: boolean;
  debug: (msg: any, ...args: any[]) => void;
  info: (msg: any, ...args: any[]) => void;
  warning: (msg: any, ...args: any[]) => void;
  error: (msg: any, ...args: any[]) => void;
};

declare interface Window {
  log: any;
}
