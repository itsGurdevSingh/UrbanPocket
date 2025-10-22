// tests/mocks/redis.mock.js
class RedisMock {
    // A static store ensures all instances of the mock in a test run share the same data
    static _store = new Map();

    constructor() {
        this.store = RedisMock._store;
        // console.log('Using In-Memory Redis Mock for tests.'); // Optional: can be noisy
    }

    async get(key) {
        return this.store.get(key) ?? null;
    }

    // --- UPDATED SET METHOD ---
    // This now handles the ioredis syntax: .set('key', 'value', 'EX', 3600)
    async set(key, value, ...args) {
        this.store.set(key, value);

        // Check for expiration arguments like ['EX', 3600]
        if (args.length > 0 && args[0].toUpperCase() === 'EX') {
            const seconds = Number(args[1]);
            if (seconds > 0) {
                setTimeout(() => {
                    this.store.delete(key);
                }, seconds * 1000);
            } else {
                // If expiration is 0 or negative, delete immediately
                this.store.delete(key);
            }
        }
        return 'OK';
    }

    async del(key) {
        return this.store.delete(key) ? 1 : 0;
    }

    async exists(key) {
        return this.store.has(key) ? 1 : 0;
    }

    async expire(key, seconds) {
        if (this.store.has(key)) {
            setTimeout(() => {
                this.store.delete(key);
            }, seconds * 1000);
            return 1;
        }
        return 0;
    }

    async flushall() {
        RedisMock._store.clear();
        return 'OK';
    }

    disconnect() {
        // No-op for mock
    }

    on() {
        // No-op to prevent errors on .on('error', ...)
    }
}

export default RedisMock;