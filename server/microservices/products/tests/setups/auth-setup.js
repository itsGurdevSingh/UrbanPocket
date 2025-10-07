// tests/setups/auth-setup.js
// Global mock for authenticateUser. Provides role switching without repeating mocks.
// Usage: global.setTestAuthRole('admin') inside a test or beforeEach.

jest.mock('../../src/middlewares/authenticateUser.js', () => {
    let mockRole = 'user';
    let mockUserId = 'test-user';
    // expose setters globally for tests
    global.setTestAuthRole = (role) => { mockRole = role; };
    global.setTestAuthUserId = (id) => { mockUserId = id; };
    const buildUser = () => ({ id: mockUserId, role: mockRole });
    return {
        __esModule: true,
        authenticate: (req, _res, next) => { req.user = buildUser(); next(); },
        default: (roles = []) => (req, res, next) => {
            if (roles.length && !roles.includes(mockRole)) {
                return res.status(403).json({ status: 'error', code: 'FORBIDDEN_ROLE', message: 'Forbidden in test mock' });
            }
            req.user = buildUser();
            next();
        }
    };
});

beforeEach(() => {
    if (global.setTestAuthRole) global.setTestAuthRole('user');
    if (global.setTestAuthUserId) global.setTestAuthUserId('test-user');
});
