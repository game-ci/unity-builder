let log: {
  debug: (msg: any, ...args: any[]) => void;
  info: (msg: any, ...args: any[]) => void;
  warning: (msg: any, ...args: any[]) => void;
  error: (msg: any, ...args: any[]) => void;
};

interface Window {
  log: any;
}
