import express from 'express';
import { uploadVariantImages, uploadSingleVariantImages } from '../middlewares/upload.js';
import { parseJsonFields } from '../middlewares/reqLog.js';
import authenticateRole from '../middlewares/authenticateUser.js';
import variantController from '../controllers/variant.controller.js';
import { createVariantValidation, updateVariantValidation, updateVariantImageValidation } from '../validators/variant.validator.js';
import { mongoIdValidation } from '../validators/utils.js';

const router = express.Router();

// CRUD Routes for variants

// protected routes for sellers/admins
router.post(
    '/create',
    authenticateRole(['seller', 'admin']), // auth early to reject unauthenticated before file handling
    uploadVariantImages, // multer memory storage (if variants have images)
    parseJsonFields, // parse JSON fields (e.g. options) from multipart/form-data
    createVariantValidation,
    variantController.createVariant
);

// update full variant - only seller or admin can update
router.put(
    '/:id',
    authenticateRole(['seller', 'admin']), // auth early to reject unauthenticated before file handling
    uploadVariantImages, // multer memory storage (if variants have images)
    parseJsonFields, // parse JSON fields (e.g. options) from multipart/form-data
    updateVariantValidation,
    variantController.updateVariant
);

// update single image for variant - only seller or admin can update
// /variantid/fileID
router.put(
    '/:id/:fileId',
    authenticateRole(['seller', 'admin']),
    updateVariantImageValidation,
    uploadSingleVariantImages, // use single file upload middleware, field name 'image'
    variantController.updateVariantImage
);

// delete variant - only seller or admin can delete
router.delete(
    '/:id',
    authenticateRole(['seller', 'admin']),
    mongoIdValidation,
    variantController.deleteVariant
);



export default router;