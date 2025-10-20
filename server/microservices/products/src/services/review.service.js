import reviewRepository from '../repositories/review.repository.js';
import productRepository from '../repositories/product.repository.js';
import { ApiError } from '../utils/errors.js';
import logger from '../utils/logger.js';

class ReviewService {
    /**
     * Create a new review
     * @param {object} reviewData - Review data from request body
     * @param {object} currentUser - Authenticated user from req.user
     * @returns {Promise<object>} Created review
     */
    async createReview(reviewData, currentUser) {
        try {
            // Ensure userId comes from authenticated user, not from request body
            const userId = currentUser.userId;

            // Validate product exists and is active
            const product = await productRepository.findById(reviewData.product);
            if (!product) {
                throw new ApiError('Product not found', { statusCode: 404, code: 'PRODUCT_NOT_FOUND' });
            }
            if (!product.isActive) {
                throw new ApiError('Cannot review an inactive product', { statusCode: 400, code: 'PRODUCT_INACTIVE' });
            }

            // Check if user already reviewed this product
            const existingReview = await reviewRepository.findOne({
                product: reviewData.product,
                userId: userId
            });
            if (existingReview) {
                throw new ApiError('You have already reviewed this product', { statusCode: 400, code: 'DUPLICATE_REVIEW' });
            }

            // Create review with userId from authenticated user
            const data = {
                ...reviewData,
                userId: userId
            };
            const review = await reviewRepository.create(data);

            logger.info(`Review created successfully for product ${review.product} by user ${review.userId}`);
            return review;
        } catch (error) {
            logger.error('Error creating review:', error);
            if (error instanceof ApiError) throw error;
            throw new ApiError('Failed to create review', { statusCode: 500, code: 'CREATE_REVIEW_FAILED', details: error.message });
        }
    }

    /**
     * Get review by ID
     * @param {string} id - Review ID
     * @returns {Promise<object>} Review
     */
    async getReviewById(id) {
        try {
            const review = await reviewRepository.findById(id);
            return review;
        } catch (error) {
            logger.error('Error fetching review by ID:', error);
            if (error instanceof ApiError) throw error;
            throw new ApiError('Failed to fetch review', { statusCode: 500, code: 'FETCH_REVIEW_FAILED', details: error.message });
        }
    }

    /**
     * Update review by ID (only by review owner)
     * @param {string} id - Review ID
     * @param {object} updateData - Update data
     * @param {object} currentUser - Authenticated user
     * @returns {Promise<object>} Updated review
     */
    async updateReview(id, updateData, currentUser) {
        try {
            // Check if review exists and user owns it
            const review = await reviewRepository.findById(id);

            if (review.userId.toString() !== currentUser.userId) {
                throw new ApiError('You can only update your own reviews', { statusCode: 403, code: 'FORBIDDEN' });
            }

            const updated = await reviewRepository.updateById(id, updateData);
            logger.info(`Review ${id} updated by user ${currentUser.userId}`);
            return updated;
        } catch (error) {
            logger.error('Error updating review:', error);
            if (error instanceof ApiError) throw error;
            throw new ApiError('Failed to update review', { statusCode: 500, code: 'UPDATE_REVIEW_FAILED', details: error.message });
        }
    }

    /**
     * Delete review by ID (only by review owner)
     * @param {string} id - Review ID
     * @param {object} currentUser - Authenticated user
     * @returns {Promise<void>}
     */
    async deleteReview(id, currentUser) {
        try {
            // Check if review exists and user owns it
            const review = await reviewRepository.findById(id);

            if (review.userId.toString() !== currentUser.userId) {
                throw new ApiError('You can only delete your own reviews', { statusCode: 403, code: 'FORBIDDEN' });
            }

            await reviewRepository.deleteById(id);
            logger.info(`Review ${id} deleted by user ${currentUser.userId}`);
        } catch (error) {
            logger.error('Error deleting review:', error);
            if (error instanceof ApiError) throw error;
            throw new ApiError('Failed to delete review', { statusCode: 500, code: 'DELETE_REVIEW_FAILED', details: error.message });
        }
    }

    /**
     * Get reviews by product ID
     * @param {string} productId - Product ID
     * @param {object} queryParams - Query parameters (page, limit)
     * @returns {Promise<object>} Reviews and pagination metadata
     */
    async getReviewsByProduct(productId, queryParams = {}) {
        try {
            const pagination = {
                page: Number(queryParams.page) || 1,
                limit: Number(queryParams.limit) || 20
            };

            const { reviews, total } = await reviewRepository.getByProduct(productId, pagination);

            const totalPages = Math.ceil(total / pagination.limit) || 0;
            const meta = {
                page: pagination.page,
                limit: pagination.limit,
                total,
                totalPages,
                hasNextPage: pagination.page < totalPages,
                hasPrevPage: pagination.page > 1
            };

            return { reviews, meta };
        } catch (error) {
            logger.error('Error fetching reviews by product:', error);
            if (error instanceof ApiError) throw error;
            throw new ApiError('Failed to fetch reviews', { statusCode: 500, code: 'FETCH_REVIEWS_FAILED', details: error.message });
        }
    }

    /**
     * Get all reviews with pagination
     * @param {object} queryParams - Query parameters (page, limit)
     * @returns {Promise<object>} Reviews and pagination metadata
     */
    async getAllReviews(queryParams = {}) {
        try {
            // 1. Parse and sanitize query parameters
            const filters = {}; // Can add filters in future (productId, userId, rating, etc.)

            const pagination = {
                page: Number(queryParams.page) || 1,
                limit: Number(queryParams.limit) || 20,
            };

            // 2. Call the repository to execute the aggregation pipeline
            const { reviews, total } = await reviewRepository.getAllReviews(filters, pagination);

            // 3. Calculate pagination metadata
            const totalPages = Math.ceil(total / pagination.limit) || 0;
            const meta = {
                page: pagination.page,
                limit: pagination.limit,
                total,
                totalPages,
                hasNextPage: pagination.page < totalPages,
                hasPrevPage: pagination.page > 1,
            };

            // 4. Return the final structured response
            return { reviews, meta };
        } catch (error) {
            logger.error('Error fetching all reviews:', error);
            if (error instanceof ApiError) throw error;
            throw new ApiError('Failed to fetch all reviews', { statusCode: 500, code: 'FETCH_ALL_REVIEWS_FAILED', details: error.message });
        }
    }
}

export default new ReviewService();
