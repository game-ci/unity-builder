import { pad } from 'https://deno.land/std@0.36.0/strings/pad.ts';
import { FormatterFunction } from 'https://deno.land/std@0.151.0/log/handlers.ts';
import { LogRecord } from 'https://deno.land/std@0.151.0/log/logger.ts';

// See: https://github.com/denoland/deno_std/blob/0.151.0/log/README.md#custom-message-format
export const createFormatter = ({
  showTime = false,
  showLogger = false,
  showLevel = false,
  showLevelName = true,
  showBrackets = true,
  depth = 3,
} = {}): FormatterFunction => {
  const column = (input: string, { width = 0, align = 'left' } = {}) => {
    const totalWidth = showBrackets ? width + 2 : width;
    const value = showBrackets ? `[${input}]` : ` ${input}`;
    const paddingOptions = { side: align === 'left' ? 'right' : 'left' };

    return pad(value, totalWidth, paddingOptions);
  };

  const formatValue = (value) => {
    switch (typeof value) {
      case 'object':
        return Deno.inspect(value, { depth });
      case 'undefined':
        return 'undefined';
      case 'string':
        return value;
      default:
        return `${value} (${typeof value})`;
    }
  };

  return ({ level, levelName, msg, args, loggerName }: LogRecord) => {
    let line = '';

    if (showLogger) {
      line += column(loggerName);
    }

    if (showTime) {
      const now = new Date();
      const hours = pad(`${now.getHours()}`, 2, { char: '0' });
      const minutes = pad(`${now.getMinutes()}`, 2, { char: '0' });
      const seconds = pad(`${now.getSeconds()}`, 2, { char: '0' });
      const time = [hours, minutes, seconds].join(':');
      line += column(time);
    }

    if (showLevelName) {
      const shortName = levelName.length <= 5 ? levelName : levelName.slice(0, 4);
      line += column(shortName, { width: 5, align: 'right' });
    }

    if (showLevel) {
      line += column(level);
    }

    if (msg) {
      if (line.length > 0) line += ' ';
      line += formatValue(msg);
    }

    if (args) {
      if (line.length > 0) line += ' ';
      line += args.map((arg) => formatValue(arg)).join(' ');
    }

    return line;
  };
};

export const formatter = createFormatter();
export const consoleFormatter = createFormatter();
export const fileFormatter = createFormatter({ showTime: true, showLevel: true, showBrackets: false });
