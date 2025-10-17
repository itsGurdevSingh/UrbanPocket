import express from 'express';
import { authenticateRole } from '../middlewares/authenticateUser';
import { createInventoryItemValidation, updateInventoryItemValidation } from '../validators/invetoryItem.validator';
import inventoryItemController from '../controllers/inventoryItem.controller.js';

const router = express.Router();

// create inventory item
router.post('/create', authenticateRole(['admin', 'seller']), createInventoryItemValidation, inventoryItemController.createInventoryItem);
router.put('/:id', authenticateRole(['admin', 'seller']), updateInventoryItemValidation, inventoryItemController.updateInventoryItem);

export default router;