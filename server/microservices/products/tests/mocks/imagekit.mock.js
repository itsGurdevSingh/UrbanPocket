// tests/mocks/imagekit.mock.js
// A lightweight in-memory mock for ImageKit SDK used in tests.
// Supports upload + delete + failure injection.

const store = new Map();
let counter = 0;

class ImageKitMock {
    constructor(config) {
        this.publicKey = config.publicKey;
        this.privateKey = config.privateKey;
        this.urlEndpoint = config.urlEndpoint;
    }

    async upload(options) {
        // options: { file, fileName, folder, useUniqueFileName }
        const { file, fileName } = options;

        // Failure injection rules: if fileName or buffer contains FAIL keyword we reject
        const failSignal = typeof fileName === 'string' && fileName.toUpperCase().includes('FAIL');
        if (failSignal) {
            const err = new Error('Simulated ImageKit upload failure');
            err.name = 'ImageKitUploadError';
            throw err;
        }

        const id = `mock_file_${++counter}`;
        const url = `${this.urlEndpoint || 'https://mock.imagekit.io'}/${fileName || ('file_' + counter)}`;
        const record = {
            fileId: id,
            url,
            name: fileName,
            size: (file && file.length) || 123,
            width: 100,
            height: 100,
            thumbnailUrl: url + '?tr=thumb'
        };
        store.set(id, record);
        return record;
    }

    async deleteFile(fileId) {
        if (!store.has(fileId)) {
            const err = new Error('File not found');
            err.name = 'ImageKitDeleteError';
            throw err;
        }
        store.delete(fileId);
        return { success: true, fileId };
    }

    // helper for tests
    static _reset() {
        store.clear();
        counter = 0;
    }

    static _list() {
        return Array.from(store.values());
    }
}

export default ImageKitMock;
