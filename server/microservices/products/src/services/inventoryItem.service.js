import InventoryItemRepository from "../repositories/InventoryItemRepository";
import variantRepository from "../repositories/variant.repository";
import productRepository from "../repositories/product.repository";
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

  async getInventoryItemById(id) {
    // Get inventory item by id
    const inventoryItem = await InventoryItemRepository.findById(id);
    if (!inventoryItem) {
      throw new ApiError('Inventory item not found', { statusCode: 404, code: 'INVENTORY_ITEM_NOT_FOUND' });
    }
    return inventoryItem;
  }

  async deleteInventoryItem(id) {
    // Check if inventory item exists
    const inventoryItem = await InventoryItemRepository.findById(id);
    if (!inventoryItem) {
      throw new ApiError('Inventory item not found', { statusCode: 404, code: 'INVENTORY_ITEM_NOT_FOUND' });
    }

    // Delete inventory item
    const deleted = await InventoryItemRepository.delete(id);
    return deleted;
  }

  /**
   * Get all inventory items with filters, sorting, and pagination
   * @param {object} queryParams - Query parameters from request
   * @returns {Promise<object>} - Items with pagination metadata
   */
  async getAllInventoryItems(queryParams) {
    // 1. Sanitize and structure the filters for the repository
    const filters = {
      variantId: queryParams.variantId,
      batchNumber: queryParams.batchNumber,
      status: queryParams.status,
      isActive: queryParams.isActive,
      inStock: queryParams.inStock,
      minPrice: queryParams.minPrice,
      maxPrice: queryParams.maxPrice,
      minStock: queryParams.minStock,
      maxStock: queryParams.maxStock,
      mfgDateFrom: queryParams.mfgDateFrom,
      mfgDateTo: queryParams.mfgDateTo,
      expDateFrom: queryParams.expDateFrom,
      expDateTo: queryParams.expDateTo,
      excludeExpired: queryParams.excludeExpired,
      productName: queryParams.productName,
      sku: queryParams.sku,
      sellerId: queryParams.sellerId,
    };

    // 2. Structure sort parameters
    const sort = {
      sortBy: queryParams.sortBy || 'createdAt',
      sortOrder: (queryParams.sortOrder || 'desc').toLowerCase() === 'asc' ? 'asc' : 'desc',
    };

    // 3. Structure pagination parameters
    const pagination = {
      page: Number(queryParams.page) || 1,
      limit: Number(queryParams.limit) || 10,
    };

    // 4. Call repository to execute the aggregation pipeline
    const { items, total } = await InventoryItemRepository.findAll(filters, sort, pagination);

    // 5. Calculate pagination metadata
    const totalPages = Math.ceil(total / pagination.limit) || 0;
    const meta = {
      total,
      page: pagination.page,
      limit: pagination.limit,
      totalPages,
      hasNextPage: pagination.page < totalPages,
      hasPrevPage: pagination.page > 1,
    };

    // 6. Return structured response
    return { items, meta };
  }

  /**
   * Disable (deactivate) an inventory item by ID
   * @param {string} id - Inventory item ID
   * @param {object} currentUser - Current authenticated user
   * @returns {Promise<object>} - Updated inventory item
   */
  async disableInventoryItem(id, currentUser) {
    try {
      if (!currentUser) {
        throw new ApiError('Authentication required', { statusCode: 401, code: 'UNAUTHORIZED' });
      }

      // Fetch inventory item
      const inventoryItem = await InventoryItemRepository.findById(id);
      if (!inventoryItem) {
        throw new ApiError('Inventory item not found', { statusCode: 404, code: 'INVENTORY_ITEM_NOT_FOUND' });
      }

      // Fetch variant to get product info
      const variant = await variantRepository.findById(inventoryItem.variantId);
      if (!variant) {
        throw new ApiError('Associated variant not found', { statusCode: 404, code: 'VARIANT_NOT_FOUND' });
      }

      // Fetch product for ownership check
      const product = await productRepository.findById(variant.productId);
      if (!product) {
        throw new ApiError('Associated product not found', { statusCode: 404, code: 'PRODUCT_NOT_FOUND' });
      }

      // Ownership / role check: seller must own product; admin allowed
      if (currentUser.role === 'seller') {
        if (product.sellerId?.toString() !== currentUser.userId) {
          throw new ApiError('You do not own this product', { statusCode: 403, code: 'FORBIDDEN_NOT_OWNER' });
        }
      } else if (!['admin'].includes(currentUser.role)) {
        throw new ApiError('Insufficient permissions to disable inventory item', { statusCode: 403, code: 'FORBIDDEN' });
      }

      // If already disabled, return as is (idempotent)
      if (inventoryItem.isActive === false) {
        return inventoryItem;
      }

      // Disable the inventory item
      const disabled = await InventoryItemRepository.update(id, { isActive: false });
      return disabled;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError('Failed to disable inventory item', { statusCode: 500, code: 'DISABLE_INVENTORY_ERROR', details: error.message });
    }
  }

  /**
   * Enable (reactivate) an inventory item by ID
   * @param {string} id - Inventory item ID
   * @param {object} currentUser - Current authenticated user
   * @returns {Promise<object>} - Updated inventory item
   */
  async enableInventoryItem(id, currentUser) {
    try {
      if (!currentUser) {
        throw new ApiError('Authentication required', { statusCode: 401, code: 'UNAUTHORIZED' });
      }

      // Fetch inventory item
      const inventoryItem = await InventoryItemRepository.findById(id);
      if (!inventoryItem) {
        throw new ApiError('Inventory item not found', { statusCode: 404, code: 'INVENTORY_ITEM_NOT_FOUND' });
      }

      // Fetch variant to get product info
      const variant = await variantRepository.findById(inventoryItem.variantId);
      if (!variant) {
        throw new ApiError('Associated variant not found', { statusCode: 404, code: 'VARIANT_NOT_FOUND' });
      }

      // Fetch product for ownership check
      const product = await productRepository.findById(variant.productId);
      if (!product) {
        throw new ApiError('Associated product not found', { statusCode: 404, code: 'PRODUCT_NOT_FOUND' });
      }

      // Ownership / role check: seller must own product; admin allowed
      if (currentUser.role === 'seller') {
        if (product.sellerId?.toString() !== currentUser.userId) {
          throw new ApiError('You do not own this product', { statusCode: 403, code: 'FORBIDDEN_NOT_OWNER' });
        }
      } else if (!['admin'].includes(currentUser.role)) {
        throw new ApiError('Insufficient permissions to enable inventory item', { statusCode: 403, code: 'FORBIDDEN' });
      }

      // If already enabled, return as is (idempotent)
      if (inventoryItem.isActive === true) {
        return inventoryItem;
      }

      // Enable the inventory item
      const enabled = await InventoryItemRepository.update(id, { isActive: true });
      return enabled;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError('Failed to enable inventory item', { statusCode: 500, code: 'ENABLE_INVENTORY_ERROR', details: error.message });
    }
  }

};



export default new inventoryItemService();