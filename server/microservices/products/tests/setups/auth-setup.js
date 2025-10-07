// tests/setups/auth-setup.js
// Global mock for authenticateUser. Provides role switching without repeating mocks.
// Usage: global.setTestAuthRole('admin') inside a test or beforeEach.

jest.mock('../../src/middlewares/authenticateUser.js', () => {
    let mockRole = 'user';
    // expose setter after module load
    global.setTestAuthRole = (role) => { mockRole = role; };
    return {
        __esModule: true,
        authenticate: (req, res, next) => { req.user = { id: 'test-user', role: mockRole }; next(); },
        default: (roles = []) => (req, res, next) => {
            if (roles.length && !roles.includes(mockRole)) {
                return res.status(403).json({ status: 'error', code: 'FORBIDDEN_ROLE', message: 'Forbidden in test mock' });
            }
            req.user = { id: 'test-user', role: mockRole }; next();
        }
    };
});

beforeEach(() => {
    if (global.setTestAuthRole) global.setTestAuthRole('user');
});
