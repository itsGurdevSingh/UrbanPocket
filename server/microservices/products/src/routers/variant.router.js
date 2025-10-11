import express from 'express';
import { uploadVariantImages, uploadSingleVariantImages } from '../middlewares/upload.js';
import { parseJsonFields } from '../middlewares/reqLog.js';
import {authenticateRole} from '../middlewares/authenticateUser.js';
import variantController from '../controllers/variant.controller.js';
import { createVariantValidation, updateVariantValidation, updateVariantImageValidation, getVariantByIdValidation, getAllVariantsValidation } from '../validators/variant.validator.js';
import { mongoIdValidation, mongoProductIdValidation } from '../validators/utils.js';

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

// disable variant - only seller or admin can disable (soft delete)
router.patch(
    '/:id/disable',
    authenticateRole(['seller', 'admin']),
    mongoIdValidation,
    variantController.disableVariant
);

// enable variant - only seller or admin can enable (soft undelete)
router.patch(
    '/:id/enable',
    authenticateRole(['seller', 'admin']),
    mongoIdValidation,
    variantController.enableVariant
);

// general routes for all roles

// get variant by id - all roles including unauthenticated can access
router.get(
    '/:id',
    getVariantByIdValidation,
    variantController.getVariantById
);

// get all variants for a product - all roles including unauthenticated can access
router.get(
    '/product/:productId',
    // reuse product id validation from utils since variant.validator doesn't export one
    // If needed, we can add getVariantsByProductIdValidation in variant.validator later
    mongoProductIdValidation,
    variantController.getVariantsByProductId
);

// get all variants (with pagination and filters) - all roles including unauthenticated can access

router.get(
    '/getAll',
    getAllVariantsValidation,
    variantController.getAllVariants
);



export default router;