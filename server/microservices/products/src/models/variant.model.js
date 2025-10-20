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
    required: false, // will be auto-generated if not supplied
    trim: true,
  },
  // The specific option choices for this variant e.g. { Color: 'Red', Size: 'M' }.
  // Kept flexible as a Map to allow dynamic attribute sets per product.
  options: {
    type: Map,
    of: String,
    required: true,
  },
  // Commercial data
  price: {
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    // ISO 4217 currency code for the price (default INR)
    currency: {
      type: String,
      required: true,
      default: 'INR',
      uppercase: true,
      trim: true,
      minlength: 3,
      maxlength: 3,
      // Basic pattern for alphabetic 3-letter code
      match: /^[A-Z]{3}$/,
    },
  },

  stock: {
    type: Number,
    required: true,
    min: 0,
    default: 0,
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
    fileId: { type: String }, // For tracking uploaded image ID if using an external service
  }],
  isActive: {
    type: Boolean,
    default: true,
  },
}, { timestamps: true });

// Compound index to enforce SKU uniqueness per product rather than globally.
// NOTE: If deploying to an environment with existing data that relied on the previous
// global unique sku constraint, ensure to drop the old unique index manually:
// db.variants.dropIndex('<oldIndexName>') then let this build.
variantSchema.index({ productId: 1, sku: 1 }, { unique: true });

const ProductVariant = mongoose.model('ProductVariant', variantSchema);

// Auto-generate SKU if absent: pattern PRODID-SHORT-<random>
variantSchema.pre('save', function (next) {
  if (!this.sku) {
    const shortId = this._id?.toString().slice(-6) || Math.random().toString(36).slice(2, 8).toUpperCase();
    this.sku = `${this.productId.toString().slice(-6)}-${shortId}`.toUpperCase();
  }
  next();
});

export default ProductVariant;
