const errorHandler = (err, req, res, next) => {
  console.error('[Error Middleware]', err);

  // Mongoose duplicate key error
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    return res.status(409).json({
      success: false,
      message: `A record with that ${field} already exists.`,
    });
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map((val) => val.message);
    return res.status(400).json({
      success: false,
      message: messages.join(', '),
    });
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      success: false,
      message: 'Invalid authorization token.',
    });
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      success: false,
      message: 'Authorization token has expired. Please log in again.',
    });
  }

  // Blockchain / revert error
  if (err.reason || err.shortMessage) {
    return res.status(400).json({
      success: false,
      message: `Blockchain Error: ${err.reason || err.shortMessage}`,
    });
  }

  // Generic internal server error
  return res.status(err.statusCode || 500).json({
    success: false,
    message: err.message || 'An unexpected internal server error occurred.',
  });
};

module.exports = errorHandler;
