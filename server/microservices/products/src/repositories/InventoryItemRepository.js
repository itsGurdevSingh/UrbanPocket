import InventoryItem from "../models/inventory.model";

class InventoryItemRepository {

    async create(data) {
        return InventoryItem.create(data);
    }

    async findById(id) {
        return InventoryItem.findById(id);
    }

    async findByVariantId(variantId) {
        return InventoryItem.find({ variantId });
    }

    async update(id, data) {
        return InventoryItem.findByIdAndUpdate(id, data, { new: true });
    }

    async delete(id) {
        return InventoryItem.findByIdAndDelete(id);
    }

};

export default new InventoryItemRepository();