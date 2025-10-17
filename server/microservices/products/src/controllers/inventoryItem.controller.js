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

  // Additional methods for inventory item management can be added here
}
export default new inventoryItemController();