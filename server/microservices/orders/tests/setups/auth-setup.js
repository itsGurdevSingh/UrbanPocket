// tests/setups/auth-setup.js
// Global mock for authenticateUser. Provides role switching and auth failure testing.
// Usage: 
//   - global.setTestAuthUserId('someUserId') - Set authenticated user
//   - global.setTestAuthFailure(true) - Simulate authentication failure
//   - global.setTestAuthFailure(false) - Restore normal authentication

jest.mock('../../src/middlewares/authenticateUser.js', () => {
    let mockUserId = 'test-user-id';
    let shouldFailAuth = false;

    // Expose setters globally for tests
    global.setTestAuthUserId = (id) => { mockUserId = id; };
    global.setTestAuthFailure = (shouldFail) => { shouldFailAuth = shouldFail; };

    const buildUser = () => ({
        id: mockUserId,
        userId: mockUserId, // For backward compatibility
    });

    const authenticate = (req, res, next) => {
        if (shouldFailAuth) {
            return res.status(401).json({
                success: false,
                error: {
                    code: 'UNAUTHORIZED',
                    message: 'Authentication token is missing or invalid.',
                    errorId: 'test-error-id'
                }
            });
        }
        req.user = buildUser();
        next();
    };

    return {
        __esModule: true,
        authenticate,
        default: authenticate,
    };
});

beforeEach(() => {
    if (global.setTestAuthUserId) global.setTestAuthUserId('test-user-id');
    if (global.setTestAuthFailure) global.setTestAuthFailure(false);
});
