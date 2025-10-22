// src/middlewares/authenticateUser.js
import jwt from 'jsonwebtoken';
import { ApiError } from '../utils/errors.js';
import getConfig from '../config/config_keys.js';

// Generic authentication.
export const authenticate = (req, res, next) => {
    try {
        const token = req.cookies.accessToken;
        if (!token) {
            throw new ApiError('Unauthorized: Missing credentials', { statusCode: 401 });
        }

        // Verify the token locally. It's fast and synchronous.
        const decoded = jwt.verify(token, getConfig('jwtSecret'));
        req.user = decoded; // Attach the payload
        next();
    } catch (error) {
        // This will catch missing tokens, expired tokens, and invalid signatures.
        next(new ApiError('Unauthorized: Invalid or expired token', { statusCode: 401, code: 'UNAUTHORIZED' }));
    }
};

// Role-based authentication.
export const authenticateRole = (allowedRoles = []) => {
    // Return a middleware function
    return (req, res, next) => {
        // First, run the basic authentication logic
        authenticate(req, res, (err) => {
            if (err) {
                return next(err); // If basic authentication fails, stop here.
            }

            // If authentication succeeds, check the role.
            if (allowedRoles.length > 0 && !allowedRoles.includes(req.user.role)) {
                return next(new ApiError('Forbidden: Insufficient permissions', { statusCode: 403, code: 'FORBIDDEN' }));
            }

            next(); // Success
        });
    };
};
