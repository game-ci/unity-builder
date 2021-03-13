class CommandExecutionError extends Error {
  constructor(message = '') {
    super(message);
    this.name = 'CommandExecutionError';
  }
}

export default CommandExecutionError;
