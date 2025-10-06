import multer from 'multer';
import { ApiError } from '../utils/errors.js';
import getConfig from '../config/config_keys.js';


// Decide storage strategy: if ImageKit is fully configured we prefer memory storage
const hasImageKit = !!(getConfig('IMAGEKIT_PUBLIC_KEY') && getConfig('IMAGEKIT_PRIVATE_KEY') && getConfig('IMAGEKIT_URL_ENDPOINT'));

// Memory storage (for direct ImageKit upload)
const memoryStorage = multer.memoryStorage();

// Allowed mime types for images
const ALLOWED_MIMES = ['image/jpeg', 'image/png', 'image/webp'];

const fileFilter = (req, file, cb) => {
    if (ALLOWED_MIMES.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new ApiError('Invalid file type. Only JPEG, PNG, WEBP allowed', { statusCode: 400, code: 'INVALID_FILE_TYPE' }));
    }
};

// 5MB per image limit
const upload = multer({
    storage: memoryStorage,
    fileFilter,
    limits: { fileSize: 5 * 1024 * 1024, files: 10 },
});

// Expect field name 'images' (frontend should send images[])
export const uploadProductImages = upload.array('images', 10);


// Upload to ImageKit moved to dedicated upload.service.js invoked from product.service
