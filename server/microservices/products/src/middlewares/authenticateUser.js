import getConfig from '../config/config_keys.js';
import { ApiError } from '../utils/errors.js';
import axios from 'axios';

// --- Internal shared logic -------------------------------------------------
async function verifyAndAttachUser(req) {
  const cookie = req.headers.cookie;
  if (!cookie) {
    throw new ApiError('Authentication failed: Missing credentials', { statusCode: 401, code: 'MISSING_CREDENTIALS' });
  }
  const authServiceUrl = getConfig('authServiceUrl');
  const response = await axios.get(`${authServiceUrl}/api/auth/verify`, {
    headers: { Cookie: cookie },
  });
  // Attach user object for downstream handlers
  req.user = response.data.user;
  return req.user;
}

// --- Public middlewares ----------------------------------------------------

// Generic authentication (no role enforcement). Ensures request is from any authenticated user.
export const authenticate = async (req, res, next) => {
    try {
      await verifyAndAttachUser(req);
      next();
    } catch (error) {
      if (axios.isAxiosError(error) && error.response) {
        return next(new ApiError('Authentication failed', {
          statusCode: 401,
          code: 'AUTHENTICATION_FAILED',
          details: error.response.data,
        }));
      }
      if (error instanceof ApiError) return next(error);
      return next(new ApiError('An unexpected authentication error occurred', {
        statusCode: 500,
        code: 'INTERNAL_AUTH_ERROR',
        details: error.message,
      }));
    }
  };


// Role-based authentication builds on generic authenticate
const authenticateRole = (allowedRoles = ['user']) => {
  return async (req, res, next) => {
    try {
      const user = req.user || await verifyAndAttachUser(req);
      if (allowedRoles.includes(user.role)) {
        return next();
      }
      const allowedRolesString = allowedRoles.join(', ');
      return next(new ApiError(`Forbidden: Only roles [${allowedRolesString}] are allowed`, { statusCode: 403, code: 'FORBIDDEN_ROLE' }));
    } catch (error) {
      if (axios.isAxiosError(error) && error.response) {
        return next(new ApiError('Authentication failed', {
          statusCode: 401,
          code: 'AUTHENTICATION_FAILED',
          details: error.response.data,
        }));
      }
      if (error instanceof ApiError) return next(error);
      return next(new ApiError('An unexpected authentication error occurred', {
        statusCode: 500,
        code: 'INTERNAL_AUTH_ERROR',
        details: error.message,
      }));
    }
  };
};

export { authenticateRole };
export default authenticateRole;
