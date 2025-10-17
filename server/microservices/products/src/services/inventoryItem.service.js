import InventoryItemRepository from "../repositories/InventoryItemRepository";
import variantRepository from "../repositories/variant.repository";
import { ApiError } from "../utils/errors";

class inventoryItemService {

  async createInventoryItem(data) {
    // destructure data to get necessary fields
    const { variantId } = data;

    //  check is variant exist for the given variantId
    const variantExists = await variantRepository.findById(variantId);
    if (!variantExists) {
      throw new ApiError('Variant not found', { statusCode: 404, code: 'VARIANT_NOT_FOUND' });
    }

    // create inventory item
    const inventoryItem = await InventoryItemRepository.create(data);
    return inventoryItem;
  }

  async updateInventoryItem(id, data) {
    // Check if inventory item exists
    const inventoryItem = await InventoryItemRepository.findById(id);
    if (!inventoryItem) {
      throw new ApiError('Inventory item not found', { statusCode: 404, code: 'INVENTORY_ITEM_NOT_FOUND' });
    }

    // update inventory item
    const updatedItem = await InventoryItemRepository.update(id, data);
    return updatedItem;
  }


};



export default new inventoryItemService();