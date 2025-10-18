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

const InventoryItem = mongoose.model('InventoryItem', inventorySchema);

export default InventoryItem;
