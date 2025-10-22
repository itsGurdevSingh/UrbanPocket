import inventoryItemService from "../services/inventoryItem.service.js";
import { ApiError } from "../utils/errors.js";
import { ApiResponse } from "../utils/success.js";

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
      next(error);
    }
  }

  async getInventoryItemById(req, res, next) {
    try {
      const { id } = req.params;
      const inventoryItem = await inventoryItemService.getInventoryItemById(id);
      res.status(200).json(
        new ApiResponse(inventoryItem, 'Inventory item fetched successfully')
      );
    } catch (error) {
      next(error);
    }
  }

  async deleteInventoryItem(req, res, next) {
    try {
      const { id } = req.params;
      const deleted = await inventoryItemService.deleteInventoryItem(id);
      res.status(200).json(
        new ApiResponse(null, 'Inventory item deleted successfully')
      );
    } catch (error) {
      next(error);
    }
  }

  async getAllInventoryItems(req, res, next) {
    try {
      const queryParams = req.query;
      const result = await inventoryItemService.getAllInventoryItems(queryParams);
      res.status(200).json(
        new ApiResponse(result, 'Inventory items fetched successfully')
      );
    } catch (error) {
      next(error);
    }
  }

  async disableInventoryItem(req, res, next) {
    try {
      const { id } = req.params;
      const disabledItem = await inventoryItemService.disableInventoryItem(id, req.user);
      res.status(200).json(
        new ApiResponse(disabledItem, 'Inventory item disabled successfully')
      );
    } catch (error) {
      next(error);
    }
  }

  async enableInventoryItem(req, res, next) {
    try {
      const { id } = req.params;
      const enabledItem = await inventoryItemService.enableInventoryItem(id, req.user);
      res.status(200).json(
        new ApiResponse(enabledItem, 'Inventory item enabled successfully')
      );
    } catch (error) {
      next(error);
    }
  }

  // Additional methods for inventory item management can be added here
}
export default new inventoryItemController();