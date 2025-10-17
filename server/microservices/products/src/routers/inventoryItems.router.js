import express from 'express';
import { authenticateRole } from '../middlewares/authenticateUser';
import { createInventoryItemValidation } from '../validators/invetoryItem.validator';
import inventoryItemController from '../controllers/inventoryItem.controller.js';

const router = express.Router();

// create inventory item
router.post('/create', authenticateRole(['admin', 'seller']), createInventoryItemValidation, inventoryItemController.createInventoryItem);


export default router;