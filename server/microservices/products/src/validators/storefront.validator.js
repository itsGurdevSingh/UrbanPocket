// src/validators/storefront.validator.js
import { query } from 'express-validator';
import { ApiError } from '../utils/errors.js';
import { handleValidationErrors } from './utils.js';

const ALLOWED_SORT_BY = ['relevance', 'price', 'createdAt'];
const MONGO_ID_REGEX = /^[a-fA-F0-9]{24}$/;

export const storefrontSearchValidation = [
  // Basic types and bounds
  query('search').optional().isString().trim().isLength({ min: 1, max: 100 }).withMessage('search must be 1-100 chars'),
  query('sellerId').optional().isMongoId().withMessage('sellerId must be a valid Mongo ID'),
  query('minPrice').optional().isFloat({ min: 0 }).toFloat().withMessage('minPrice must be >= 0'),
  query('maxPrice').optional().isFloat({ min: 0 }).toFloat().withMessage('maxPrice must be >= 0'),
  query('minRating').optional().isFloat({ min: 0, max: 5 }).toFloat().withMessage('minRating must be between 0 and 5'),
  query('page').optional().isInt({ min: 1 }).toInt().withMessage('page must be >= 1'),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt().withMessage('limit must be 1-100'),
  query('sortBy').optional().isIn(ALLOWED_SORT_BY).withMessage(`sortBy must be one of: ${ALLOWED_SORT_BY.join(', ')}`),
  query('sortOrder')
    .optional()
    .customSanitizer((v) => String(v).toLowerCase())
    .isIn(['asc', 'desc'])
    .withMessage('sortOrder must be asc or desc'),

  // Category: comma-separated; if provided must contain at least one valid ObjectId
  query('category')
    .optional()
    .isString()
    .trim()
    .custom((value, { req }) => {
      const tokens = String(value)
        .split(',')
        .map((t) => t.trim())
        .filter((t) => t.length > 0 && MONGO_ID_REGEX.test(t));
      if (tokens.length === 0) throw new Error('category must contain valid Mongo IDs');
      // normalize back to comma-separated string for repository
      req.query.category = tokens.join(',');
      return true;
    }),

  // Brand and tags: accept comma-separated lists but keep as trimmed strings
  query('brand').optional().isString().trim(),
  query('tags').optional().isString().trim(),

  // Cross-field price range check
  query('*').custom((_, { req }) => {
    const { minPrice, maxPrice } = req.query || {};
    if (minPrice !== undefined && maxPrice !== undefined && Number(minPrice) > Number(maxPrice)) {
      throw new Error('minPrice must be <= maxPrice');
    }
    return true;
  }),

  // Dynamic option_* validation
  (req, _res, next) => {
    const optionNameRe = /^option_[A-Za-z0-9]+$/;
    for (const key of Object.keys(req.query || {})) {
      if (key.startsWith('option_')) {
        if (!optionNameRe.test(key)) {
          return next(new ApiError('Invalid option name', {
            statusCode: 400,
            code: 'VALIDATION_ERROR',
            details: [{ field: key, message: 'Option name must be alphanumeric (option_Name)' }]
          }));
        }
        const value = String(req.query[key] ?? '').trim();
        if (!value || value.length > 100) {
          return next(new ApiError('Invalid option value', {
            statusCode: 400,
            code: 'VALIDATION_ERROR',
            details: [{ field: key, message: 'Option value must be non-empty and up to 100 chars' }]
          }));
        }
      }
    }
    next();
  },

  handleValidationErrors,
];