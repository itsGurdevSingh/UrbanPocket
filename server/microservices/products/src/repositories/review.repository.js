import Review from '../models/review.model.js';
import { ApiError } from '../utils/errors.js';

class ReviewRepository {
    constructor() {
        this.model = Review;
    }

    /**
     * Create a new review
     * @param {object} reviewData - Review data
     * @returns {Promise<object>} Created review
     */
    async create(reviewData) {
        const review = await Review.create(reviewData);
        return review;
    }

    /**
     * Find review by ID
     * @param {string} id - Review ID
     * @returns {Promise<object>} Review
     */
    async findById(id) {
        const review = await Review.findById(id);
        if (!review) {
            throw new ApiError('Review not found', { statusCode: 404, code: 'REVIEW_NOT_FOUND' });
        }
        return review;
    }

    /**
     * Find one review by filter
     * @param {object} filter - Filter criteria
     * @returns {Promise<object>} Review or null
     */
    async findOne(filter) {
        return await Review.findOne(filter).lean();
    }

    /**
     * Update review by ID
     * @param {string} id - Review ID
     * @param {object} updateData - Update data
     * @returns {Promise<object>} Updated review
     */
    async updateById(id, updateData) {
        const review = await Review.findById(id);
        if (!review) {
            throw new ApiError('Review not found', { statusCode: 404, code: 'REVIEW_NOT_FOUND' });
        }

        // Update fields and save to trigger hooks for rating recalculation
        Object.assign(review, updateData);
        await review.save();

        return review;
    }

    /**
     * Delete review by ID
     * @param {string} id - Review ID
     * @returns {Promise<object>} Deleted review
     */
    async deleteById(id) {
        const review = await Review.findById(id);
        if (!review) {
            throw new ApiError('Review not found', { statusCode: 404, code: 'REVIEW_NOT_FOUND' });
        }
        await review.remove(); // Use remove() to trigger the pre/post hooks for rating recalculation
        return review;
    }

    /**
     * Get reviews by product ID with pagination
     * @param {string} productId - Product ID
     * @param {object} pagination - Page and limit
     * @returns {Promise<object>} Reviews and total count
     */
    async getByProduct(productId, pagination = {}) {
        const page = parseInt(pagination.page, 10) || 1;
        const limit = parseInt(pagination.limit, 10) || 20;
        const skip = (page - 1) * limit;

        const reviews = await Review.find({ product: productId })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean();

        const total = await Review.countDocuments({ product: productId });

        return { reviews, total };
    }

    /**
     * Get all reviews using aggregation pipeline with pagination
     * @param {object} filters - Filter criteria (optional, for future enhancements)
     * @param {object} pagination - Page and limit
     * @returns {Promise<object>} Reviews and total count
     */
    async getAllReviews(filters = {}, pagination = {}) {
        const pipeline = [];

        // ----------------------------------------------------------------------------------
        // STAGE 1: INITIAL MATCH (FILTER)
        // ----------------------------------------------------------------------------------
        // For now, no filters. Can add productId, userId, rating filters in future
        const matchStage = {};

        if (Object.keys(matchStage).length > 0) {
            pipeline.push({ $match: matchStage });
        }

        // ----------------------------------------------------------------------------------
        // STAGE 2: SORTING
        // Sort by createdAt descending (newest first)
        // ----------------------------------------------------------------------------------
        pipeline.push({ $sort: { createdAt: -1 } });

        // ----------------------------------------------------------------------------------
        // STAGE 3: PAGINATION & COUNT ($facet)
        // ----------------------------------------------------------------------------------
        const page = parseInt(pagination.page, 10) || 1;
        const limit = parseInt(pagination.limit, 10) || 20;
        const skip = (page - 1) * limit;

        pipeline.push({
            $facet: {
                paginatedResults: [{ $skip: skip }, { $limit: limit }],
                totalCount: [{ $count: 'count' }],
            },
        });

        // ----------------------------------------------------------------------------------
        // STAGE 4: CLEANUP & RESHAPE OUTPUT
        // ----------------------------------------------------------------------------------
        pipeline.push(
            {
                $project: {
                    reviews: '$paginatedResults',
                    total: { $arrayElemAt: ['$totalCount.count', 0] },
                },
            },
            {
                $addFields: {
                    total: { $ifNull: ['$total', 0] },
                },
            }
        );

        // ----------------------------------------------------------------------------------
        // EXECUTION
        // ----------------------------------------------------------------------------------
        const results = await Review.aggregate(pipeline);

        return results[0] || { reviews: [], total: 0 };
    }
}

export default new ReviewRepository();
