import variantService from "../services/variant.service.js";
import { ApiError } from "../utils/errors.js";
import logger from "../utils/logger.js";

class variantsController {

    async createVariant(req, res, next) {
        try {
            const variantData = req.body;
            const newVariant = await variantService.createVariant(variantData, req.files || [], req.user);
            res.status(201).json({
                status: 'success',
                message: 'Variant created successfully',
                variant: newVariant
            });
        } catch (error) {
            logger.error('Error creating variant:', error);
            if (error instanceof ApiError) {
                return next(error);
            }
            return next(new ApiError('Failed to create variant', { statusCode: 500, code: 'CREATE_VARIANT_ERROR', details: error.message }));
        }
    }

    async updateVariant(req, res, next) {
        try {
            const variantId = req.params.id;
            const updateData = req.body;
            const updatedVariant = await variantService.updateVariant(variantId, updateData, req.files || [], req.user);
            res.status(200).json({
                status: 'success',
                message: 'Variant updated successfully',
                variant: updatedVariant
            });
        } catch (error) {
            logger.error('Error updating variant:', error);
            if (error instanceof ApiError) {
                return next(error);
            }
            return next(new ApiError('Failed to update variant', { statusCode: 500, code: 'UPDATE_VARIANT_ERROR', details: error.message }));
        }
    }

    // PUT /api/variants/:id/:fileId this can return only updated image object with url,alt text,fileId
    async updateVariantImage(req, res, next) {
        try {
            const variantId = req.params.id;
            const fileId = req.params.fileId;
            const updatedImage = await variantService.updateVariantImage(variantId, fileId, req.file, req.user);
            res.status(200).json({
                status: 'success',
                message: 'Variant image updated successfully',
                updatedImage: updatedImage
            });
        } catch (error) {
            logger.error('Error updating variant image:', error);
            if (error instanceof ApiError) {
                return next(error);
            }
            return next(new ApiError('Failed to update variant image', { statusCode: 500, code: 'UPDATE_VARIANT_IMAGE_ERROR', details: error.message }));
        }
    }

    async deleteVariant(req, res, next) {
        try {
            const variantId = req.params.id;
            await variantService.deleteVariant(variantId, req.user);
            res.status(200).json({
                status: 'success',
                message: 'Variant deleted successfully'
            });
        } catch (error) {
            logger.error('Error deleting variant:', error);
            if (error instanceof ApiError) {
                return next(error);
            }
            return next(new ApiError('Failed to delete variant', { statusCode: 500, code: 'DELETE_VARIANT_ERROR', details: error.message }));
        }
    }

    async disableVariant(req, res, next) {
        try {
            const variantId = req.params.id;
            const disabledVariant = await variantService.disableVariant(variantId, req.user);
            res.status(200).json({
                status: 'success',
                message: 'Variant disabled successfully',
                variant: disabledVariant
            });
        }
        catch (error) {
            logger.error('Error disabling variant:', error);
            if (error instanceof ApiError) {
                return next(error);
            }
            return next(new ApiError('Failed to disable variant', { statusCode: 500, code: 'DISABLE_VARIANT_ERROR', details: error.message }));
        }
    }

    async enableVariant(req, res, next) {
        try {
            const variantId = req.params.id;
            const enabledVariant = await variantService.enableVariant(variantId, req.user);
            res.status(200).json({
                status: 'success',
                message: 'Variant enabled successfully',
                variant: enabledVariant
            });
        }
        catch (error) {
            logger.error('Error enabling variant:', error);
            if (error instanceof ApiError) {
                return next(error);
            }
            return next(new ApiError('Failed to enable variant', { statusCode: 500, code: 'ENABLE_VARIANT_ERROR', details: error.message }));
        }
    }

    async getVariantById(req, res, next) {
        try {
            const variantId = req.params.id;
            const variant = await variantService.getVariantById(variantId);
            res.status(200).json({
                status: 'success',
                variant: variant
            });
        } catch (error) {
            logger.error('Error fetching variant by ID:', error);
            if (error instanceof ApiError) {
                return next(error);
            }
            return next(new ApiError('Failed to fetch variant', { statusCode: 500, code: 'FETCH_VARIANT_ERROR', details: error.message }));
        }
    }

    async getVariantsByProductId(req, res, next) {
        try {
            const productId = req.params.productId;
            const variants = await variantService.getVariantsByProductId(productId);
            res.status(200).json({
                status: 'success',
                variants: variants
            });
        } catch (error) {
            logger.error('Error fetching variants by product ID:', error);
            if (error instanceof ApiError) {
                return next(error);
            }
            return next(new ApiError('Failed to fetch variants', { statusCode: 500, code: 'FETCH_VARIANTS_ERROR', details: error.message }));
        }
    }

    async getAllVariants(req, res, next) {
        try {
            const result = await variantService.getAllVariants(req.query || {});
            res.status(200).json({
                status: 'success',
                variants: result.data || [],
                meta: result.meta,
                count: result.count,
            });
        } catch (error) {
            logger.error('Error fetching variants:', error);
            if (error instanceof ApiError) {
                return next(error);
            }
            return next(new ApiError('Failed to fetch variants', { statusCode: 500, code: 'FETCH_VARIANTS_ERROR', details: error.message }));
        }
    }

}

export default new variantsController();