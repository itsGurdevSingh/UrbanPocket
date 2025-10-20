import reviewService from '../services/review.service.js';
import { ApiError } from '../utils/errors.js';
import logger from '../utils/logger.js';
import { ApiResponse } from '../utils/success.js';

class ReviewController {
    /**
     * Create a new review
     */
    async createReview(req, res, next) {
        try {
            const review = await reviewService.createReview(req.body, req.user);
            res.status(201).json(new ApiResponse(review, 'Review created successfully'));
        } catch (error) {
            logger.error('Error creating review:', error);
            if (error instanceof ApiError) return next(error);
            return next(new ApiError('Failed to create review', { statusCode: 500, code: 'CREATE_REVIEW_ERROR', details: error.message }));
        }
    }

    /**
     * Get review by ID
     */
    async getReviewById(req, res, next) {
        try {
            const reviewId = req.params.id;
            const review = await reviewService.getReviewById(reviewId);
            res.status(200).json(new ApiResponse(review, 'Review fetched successfully'));
        } catch (error) {
            logger.error('Error fetching review by ID:', error);
            if (error instanceof ApiError) return next(error);
            return next(new ApiError('Failed to fetch review', { statusCode: 500, code: 'FETCH_REVIEW_ERROR', details: error.message }));
        }
    }

    /**
     * Update review by ID
     */
    async updateReview(req, res, next) {
        try {
            const reviewId = req.params.id;
            const updated = await reviewService.updateReview(reviewId, req.body, req.user);
            res.status(200).json(new ApiResponse(updated, 'Review updated successfully'));
        } catch (error) {
            logger.error('Error updating review:', error);
            if (error instanceof ApiError) return next(error);
            return next(new ApiError('Failed to update review', { statusCode: 500, code: 'UPDATE_REVIEW_ERROR', details: error.message }));
        }
    }

    /**
     * Delete review by ID
     */
    async deleteReview(req, res, next) {
        try {
            const reviewId = req.params.id;
            await reviewService.deleteReview(reviewId, req.user);
            res.status(200).json(new ApiResponse(null, 'Review deleted successfully'));
        } catch (error) {
            logger.error('Error deleting review:', error);
            if (error instanceof ApiError) return next(error);
            return next(new ApiError('Failed to delete review', { statusCode: 500, code: 'DELETE_REVIEW_ERROR', details: error.message }));
        }
    }

    /**
     * Get reviews by product ID
     */
    async getReviewsByProduct(req, res, next) {
        try {
            const productId = req.params.productId;
            const result = await reviewService.getReviewsByProduct(productId, req.query);
            res.status(200).json(new ApiResponse(result, 'Reviews fetched successfully'));
        } catch (error) {
            logger.error('Error fetching reviews by product:', error);
            if (error instanceof ApiError) return next(error);
            return next(new ApiError('Failed to fetch reviews', { statusCode: 500, code: 'FETCH_REVIEWS_ERROR', details: error.message }));
        }
    }

    /**
     * Get all reviews with pagination
     */
    async getAllReviews(req, res, next) {
        try {
            const result = await reviewService.getAllReviews(req.query);
            res.status(200).json(new ApiResponse(result, 'All reviews fetched successfully'));
        } catch (error) {
            logger.error('Error fetching all reviews:', error);
            if (error instanceof ApiError) return next(error);
            return next(new ApiError('Failed to fetch all reviews', { statusCode: 500, code: 'FETCH_ALL_REVIEWS_ERROR', details: error.message }));
        }
    }
}

export default new ReviewController();
