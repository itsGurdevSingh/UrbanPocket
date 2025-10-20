import express from 'express';
import reviewController from '../controllers/review.controller.js';
import { authenticate } from '../middlewares/authenticateUser.js';
import {
    createReviewValidation,
    updateReviewValidation,
    reviewIdValidation,
    productIdValidation,
    getAllReviewsValidation
} from '../validators/review.validator.js';

const router = express.Router();

// POST /api/review/create - authenticated users only
router.post('/create', authenticate, createReviewValidation, reviewController.createReview);

// GET /api/review/getAll - get all reviews with pagination (authenticated)
router.get('/getAll', authenticate, getAllReviewsValidation, reviewController.getAllReviews);

// GET /api/review/product/:productId - get reviews by product (authenticated)
router.get('/product/:productId', authenticate, productIdValidation, reviewController.getReviewsByProduct);

// GET /api/review/:id - get review by ID (authenticated)
router.get('/:id', authenticate, reviewIdValidation, reviewController.getReviewById);

// PUT /api/review/:id - update review (authenticated, owner only)
router.put('/:id', authenticate, updateReviewValidation, reviewController.updateReview);

// DELETE /api/review/:id - delete review (authenticated, owner only)
router.delete('/:id', authenticate, reviewIdValidation, reviewController.deleteReview);

export default router;
