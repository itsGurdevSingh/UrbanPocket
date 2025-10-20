import express from 'express';
import { authenticateRole } from '../middlewares/authenticateUser';
import {
    createInventoryItemValidation,
    updateInventoryItemValidation,
    inventoryItemIdValidation,
    getAllInventoryItemsValidation
} from '../validators/invetoryItem.validator';
import inventoryItemController from '../controllers/inventoryItem.controller.js';

const router = express.Router();

// in our contract we use /getAll for fetching multiple items with filters
router.get('/getAll', authenticateRole(['admin', 'seller', 'user']), getAllInventoryItemsValidation, inventoryItemController.getAllInventoryItems);

// create inventory item
router.post('/create', authenticateRole(['admin', 'seller']), createInventoryItemValidation, inventoryItemController.createInventoryItem);

// get inventory item by id
router.get('/:id', authenticateRole(['admin', 'seller', 'user']), inventoryItemIdValidation, inventoryItemController.getInventoryItemById);

// update inventory item
router.put('/:id', authenticateRole(['admin', 'seller']), updateInventoryItemValidation, inventoryItemController.updateInventoryItem);

// delete inventory item
router.delete('/:id', authenticateRole(['admin', 'seller']), inventoryItemIdValidation, inventoryItemController.deleteInventoryItem);

// disable inventory item - only seller or admin can disable (soft delete)
router.patch('/:id/disable', authenticateRole(['admin', 'seller']), inventoryItemIdValidation, inventoryItemController.disableInventoryItem);

// enable inventory item - only seller or admin can enable (soft undelete)
router.patch('/:id/enable', authenticateRole(['admin', 'seller']), inventoryItemIdValidation, inventoryItemController.enableInventoryItem);

export default router;