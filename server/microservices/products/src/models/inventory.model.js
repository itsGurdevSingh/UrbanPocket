import mongoose from "mongoose";

const inventorySchema = new mongoose.Schema({
  // Link to the specific product variant
  variantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ProductVariant',
    required: true,
    index: true,
  },
  // A unique identifier for this specific batch or lot
  batchNumber: {
    type: String,
    trim: true,
  },
  // The current stock level, always stored in the variant's
  stock: {
    type: Number,
    required: true,
    min: 0,
    default: 0,
  },
  // The price is also set per base unit.
  price: {
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, required: true, default: 'INR' },
  },

  // Batch-specific details like manufacturing and expiration dates
  manufacturingDetails: {
    mfgDate: { type: Date },
    expDate: { type: Date },
  },
  // Tax and other location-specific details (important for India)
  hsnCode: { type: String, trim: true },
  gstPercentage: { type: Number, min: 0, max: 100, default: 18 },

  isActive: {
    type: Boolean,
    default: true,
  },
}, { timestamps: true });

// A compound index to ensure each batch for a variant is unique.
inventorySchema.index({ variantId: 1, batchNumber: 1 }, { unique: true });

// --- THE ENGINE ---
// This is the reusable machine that calculates the total stock for a given variant.
inventorySchema.statics.updateVariantStock = async function (variantId) {
  // We get the ProductVariant model here to avoid circular dependency errors at boot.
  const ProductVariant = mongoose.model('ProductVariant');

  const totalStock = await this.aggregate([
    { $match: { variantId: variantId, isActive: true } },
    { $group: { _id: null, total: { $sum: '$stock' } } },
  ]);

  // Update the parent ProductVariant document with the new stock
  await ProductVariant.findByIdAndUpdate(variantId, {
    stock: totalStock.length > 0 ? totalStock[0].total : 0,
  });
};

// --- THE DOMINOES: TRIGGERING THE ENGINE ---

// DOMINO 1: After a NEW inventory item is SAVED (`.save()` or `.create()`)
// This is a DOCUMENT middleware. `this` is the document.
inventorySchema.post('save', async function () {
  await this.constructor.updateVariantStock(this.variantId);
});

// DOMINO 2: After an inventory item is UPDATED (`.findByIdAndUpdate()`, `.findOneAndUpdate()`)
// This is a QUERY middleware. We need both the old and new variantId in case it changes.
inventorySchema.post('findOneAndUpdate', async function (doc) {
  if (doc) {
    // Update stock for the variant
    await doc.constructor.updateVariantStock(doc.variantId);
  }
});

// DOMINO 3: Store variantId before deletion
inventorySchema.pre('findOneAndDelete', async function (next) {
  const doc = await this.model.findOne(this.getQuery());
  if (doc) {
    this._variantIdToUpdate = doc.variantId;
  }
  next();
});

// DOMINO 4: After deletion, update the variant stock
inventorySchema.post('findOneAndDelete', async function (doc) {
  if (this._variantIdToUpdate) {
    const InventoryItem = mongoose.model('InventoryItem');
    await InventoryItem.updateVariantStock(this._variantIdToUpdate);
  }
});

const InventoryItem = mongoose.model('InventoryItem', inventorySchema);

export default InventoryItem;
