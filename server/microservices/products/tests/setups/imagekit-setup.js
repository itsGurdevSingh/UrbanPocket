// tests/setups/imagekit-setup.js
// Jest setup file to mock the 'imagekit' module with our custom mock.

jest.mock('imagekit', () => {
    const mockImageKit = require('../mocks/imagekit.mock.js').default; // require inside factory to satisfy Jest scoping rules
    return {
        __esModule: true,
        default: mockImageKit
    };
});

beforeEach(() => {
    const mockImageKit = require('../mocks/imagekit.mock.js').default;
    mockImageKit._reset();
});
