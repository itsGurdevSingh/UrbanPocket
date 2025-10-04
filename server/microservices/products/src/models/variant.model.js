import mongoose from "mongoose";

const variantSchema = new mongoose.Schema({
  // Link back to the parent Product
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true,
    index: true,
  },
  // A unique identifier for this specific variant, e.g., "TSHIRT-RED-M"
  sku: {
    type: String,
    unique: true,
    required: true,
    trim: true,
    index: true,
  },
  // The specific values for the attributes defined in the parent Product.
  // Example: { "Color": "Red", "Size": "Medium" }
  options: {
    type: Map,
    of: String,
    required: true,
  },
  // --- Unit of Measure (UoM) System ---
  // The smallest unit for inventory tracking (e.g., 'kg', 'g', 'ml', 'unit').
  baseUnit: {
    type: String,
    required: true,
  },
  // Images that are specific to this variant (e.g., a picture of the red t-shirt).
  variantImages: [{
    url: { type: String, required: true },
    altText: { type: String },
  }],
  isActive: {
    type: Boolean,
    default: true,
  },
}, { timestamps: true });

const variant = mongoose.model('variant', variantSchema);

export default variant;
