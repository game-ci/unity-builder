class ValidationError extends Error {
  constructor(message = '') {
    super(message);
    this.name = 'ValidationError';
  }
}

export default ValidationError;
