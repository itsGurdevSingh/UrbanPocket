import { ApiError } from '../utils/errors.js';
import { uploadToImageKit, deleteFromImageKit } from '../utils/imagekit.js';
import logger from '../utils/logger.js';

/**
 * UploadService centralizes all media upload operations.
 * It delegates actual provider interaction to low-level util(s)
 * (e.g., ImageKit) while keeping business services clean.
 */
class UploadService {
    /**
     * Upload product images (multer memory files) to ImageKit.
     * @param {Array<Multer.File>} files
     * @returns {Promise<Array<{url:string, altText?:string, fileId?:string}>>}
     */
    async uploadImagesToCloud(files = []) {
        if (!files || files.length === 0) return [];

        // Build upload promises in parallel
        const tasks = files.map(f => uploadToImageKit(f)
            .then(res => ({ status: 'fulfilled', res, file: f }))
            .catch(err => ({ status: 'rejected', error: err, file: f }))
        );

        const results = await Promise.all(tasks);
        const failures = results.filter(r => r.status === 'rejected');
        const successes = results.filter(r => r.status === 'fulfilled');

        if (failures.length > 0) {
            // Rollback successful uploads
            for (const s of successes) {
                try { await deleteFromImageKit(s.res.fileId); } catch (_) { /* swallow */ }
            }
            const firstErr = failures[0].error;
            logger.error('UploadService: one or more uploads failed, rollback executed', {
                failureCount: failures.length,
                successCount: successes.length,
            });
            if (firstErr instanceof ApiError) throw firstErr;
            throw new ApiError('Failed to upload product images (rolled back)', { statusCode: 500, code: 'PRODUCT_IMAGE_UPLOAD_FAILED', details: firstErr.message });
        }

        // Map successes to expected shape
        return successes.map(({ res, file }) => ({
            url: res.url,
            altText: file.originalname?.split('.')[0]?.substring(0, 150) || undefined,
            fileId: res.fileId
        }));
    }

    /**
     * Execute a critical action (e.g. DB persistence) after images have been uploaded.
     * If the action throws, already uploaded images are rolled back (deleted) best-effort.
     * @param {Array<{url:string,fileId?:string}>} images Already uploaded images
     * @param {Function} action Async function performing the critical operation, receives (images)
     * @param {object} options Optional { rollbackLogCode }
     */
    async executeWithUploadRollback(images, action, options = {}) {
        const fileIds = (images || []).map(i => i.fileId).filter(Boolean);
        try {
            return await action(images);
        } catch (err) {
            if (fileIds.length) {
                // Best-effort deletion
                await Promise.allSettled(fileIds.map(id => deleteFromImageKit(id)));
                logger.error('UploadService: rolled back uploaded images after downstream failure', {
                    count: fileIds.length,
                    code: options.rollbackLogCode || 'UPLOAD_ROLLBACK'
                });
            }
            throw err; // Propagate original error so caller can classify
        }
    }

    /**
     * Delete images by fileIds (best-effort, logs failures)
     * @param {Array<string>} fileIds
     * @returns {Promise<void>}
     * Note: This does not throw if some/all deletions fail, just logs.
     */

    async deleteImages(fileIds = []) {
        if (!fileIds || fileIds.length === 0) return;
        const tasks = fileIds.map(id => deleteFromImageKit(id)
            .then(() => ({ status: 'fulfilled', fileId: id }))
            .catch(error => ({ status: 'rejected', fileId: id, error }))
        );  
        const results = await Promise.all(tasks);
        const failures = results.filter(r => r.status === 'rejected');
        if (failures.length > 0) {
            logger.error('UploadService: some image deletions failed', {
                failureCount: failures.length,
                failures: failures.map(f => ({ fileId: f.fileId, error: f.error.message }))
            });
        }
    }
}

export default new UploadService();
