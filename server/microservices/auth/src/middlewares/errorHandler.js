/**
 * Global error handling middleware.
 */
export const errorHandler = (error, req, res, next) => {
  // Use the status code from the error if it exists, otherwise default to 500
  const statusCode = error.statusCode || 500;
  
  // Use the message from the error
  const message = error.message || 'An unexpected error occurred';

  // Log the error for debugging purposes (optional but recommended)
  // console.error(error);2

  // Send a standardized error response
  res.status(statusCode).json({
    status: 'error',
    error: message,
  });
};