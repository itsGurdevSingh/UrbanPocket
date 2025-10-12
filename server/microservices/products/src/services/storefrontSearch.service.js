import storefrontRepository from '../repositories/storefront.repository.js';
import { ApiError } from '../utils/errors.js';

/**
 * Orchestrates the storefront search.
 * It parses query parameters, calls the repository to execute the search,
 * and calculates pagination metadata for the final response.
 * @param {object} queryParams - The raw req.query object from the controller.
 * @returns {Promise<object>} - A promise that resolves to the final structured response.
 */
const searchProducts = async (queryParams) => {
  // 1. Sanitize and structure the inputs for the repository.
  const filters = {
    search: queryParams.search,
    category: queryParams.category,
    brand: queryParams.brand,
    sellerId: queryParams.sellerId,
    minPrice: queryParams.minPrice,
    maxPrice: queryParams.maxPrice,
    minRating: queryParams.minRating,
    tags: queryParams.tags,
  };

  // Add dynamic option filters (e.g., option_Size=M)
  for (const key in queryParams) {
    if (key.startsWith('option_')) {
      filters[key] = queryParams[key];
    }
  }

  const sort = {
    sortBy: queryParams.sortBy || 'relevance',
    sortOrder: (queryParams.sortOrder || 'desc').toLowerCase() === 'asc' ? 'asc' : 'desc',
  };

  const pagination = {
    page: Number(queryParams.page) || 1,
    limit: Number(queryParams.limit) || 10,
  };

  // 2. Call the repository to execute the aggregation pipeline.
  const { products, total } = await storefrontRepository.search(filters, sort, pagination);

  // 3. Calculate pagination metadata.
  const totalPages = Math.ceil(total / pagination.limit) || 0;
  const meta = {
    totalProducts: total,
    currentPage: pagination.page,
    totalPages,
    hasNextPage: pagination.page < totalPages,
    hasPrevPage: pagination.page > 1,
  };

  // 4. Return the final, structured response object.
  return { products, meta };
};

export default {
  searchProducts,
};
