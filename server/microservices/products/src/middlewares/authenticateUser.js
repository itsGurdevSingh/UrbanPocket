import getConfig from '../config/config_keys.js';
import { ApiError } from '../utils/errors.js';
import axios from 'axios';

const authenticateRole = (allowedRoles = ['user']) => {
    // 1. The returned middleware is now an async function
    return async (req, res, next) => {
        try {
            const cookie = req.headers.cookie;

            // 2. Handle missing cookies early for a clearer error
            if (!cookie) {
                throw new ApiError('Authentication failed: Missing credentials', { statusCode: 401, code: 'MISSING_CREDENTIALS' });
            }

            const authServiceUrl = getConfig('authServiceUrl');

            // 3. Use await to get the response directly. No more .then()
            const response = await axios.get(`${authServiceUrl}/api/auth/verify`, {
                headers: {
                    Cookie: cookie,
                },
            });

            const userRole = response.data.user.role;

            // 4. Check if the user's role is in the allowed list
            if (allowedRoles.includes(userRole)) {
                // User has the required role, proceed
                req.user = response.data.user; // Set user data for downstream middleware
                next();
            } else {
                // User is authenticated but not authorized for this route
                const allowedRolesString = allowedRoles.join(', ');
                const error = new ApiError(`Forbidden: Only roles [${allowedRolesString}] are allowed`, { statusCode: 403, code: 'FORBIDDEN_ROLE' });
                next(error);
            }
        } catch (error) {
            // 5. A single catch block handles all errors (network, auth failure, etc.)
            // Check if the error is from axios and has a response from the auth service
            if (axios.isAxiosError(error) && error.response) {
                const newError = new ApiError('Authentication failed', {
                    statusCode: 401,
                    code: 'AUTHENTICATION_FAILED',
                    details: error.response.data,
                });
                next(newError);
            } else {
                // Handle other errors (e.g., network error, our own thrown error)
                // If it's already an ApiError, just pass it along. Otherwise, wrap it.
                if (error instanceof ApiError) {
                    next(error);
                } else {
                    const newError = new ApiError('An unexpected authentication error occurred', {
                        statusCode: 500,
                        code: 'INTERNAL_AUTH_ERROR',
                        details: error.message,
                    });
                    next(newError);
                }
            }
        }
    };
};

export default authenticateRole;