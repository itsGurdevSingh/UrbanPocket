import inventoryItemService from "../services/inventoryItem.service";
import { ApiError } from "../utils/errors";
import { ApiResponse } from "../utils/success";

class inventoryItemController {
  // create inventory item
  async createInventoryItem(req, res, next) {
    try {
      const inventoryItem = req.body;
      const createdItem = await inventoryItemService.createInventoryItem(inventoryItem);
      res.status(201)
        .json(
          new ApiResponse(createdItem, 'Inventory item created successfully')
        );
    } catch (error) {
      next(error);
    }
  }

  async updateInventoryItem(req, res, next) {
    try {
      const { id } = req.params;
      const inventoryItem = req.body;
      const updatedItem = await inventoryItemService.updateInventoryItem(id, inventoryItem);
      res.status(200)
        .json(
          new ApiResponse(updatedItem, 'Inventory item updated successfully')
        );
    } catch (error) {
      if (error instanceof ApiError) next(error);
      next(new ApiError('Failed to update inventory item', { statusCode: 500, code: 'INVENTORY_ITEM_UPDATE_FAILED' }));
    }
  }

  // Additional methods for inventory item management can be added here
}
export default new inventoryItemController();