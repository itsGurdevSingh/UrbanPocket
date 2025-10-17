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

export default router;