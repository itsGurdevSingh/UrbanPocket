import storefrontService from '../services/storefrontSearch.service.js';

/**
 * Handles the incoming request for the storefront search API.
 * @param {object} req - The Express request object.
 * @param {object} res - The Express response object.
 * @param {function} next - The Express next middleware function.
 */
const search = async (req, res, next) => {
  try {
    // 1. Pass the entire raw query object directly to the service.
    const result = await storefrontService.searchProducts(req.query);

    // 2. Send the structured response from the service.
    res.status(200).json({
      success: true,
      message: 'Products retrieved successfully',
      ...result,
    });
  } catch (error) {
    // 3. Pass any errors to the global error handler.
    next(error);
  }
};

export default {
  search,
};