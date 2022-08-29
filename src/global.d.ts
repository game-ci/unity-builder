import { Verbosity } from './core/logger/index.ts';

declare global {
  interface String {
    dedent(indentedString: string): string;
  }

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
}

declare interface String {
  dedent(indentedString: string): string;
}

declare interface Window {
  log: any;
}
