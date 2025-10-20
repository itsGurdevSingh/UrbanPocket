import mongoose from "mongoose";

const productSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 150,
    index: true,
    // Text index is defined below via schema.index
  },
  description: {
    type: String,
    required: true,
    trim: true,
    maxlength: 2000,
    // Text index is defined below via schema.index
  },
  brand: {
    type: String,
    trim: true,
    maxlength: 50,
    index: true,
  },
  // The ID of the seller (from your User service)
  sellerId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    index: true,
  },
  // Link to the Category model
  categoryId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    required: true,
    index: true,
  },
  // An array defining what makes the variants different, e.g., ["Size", "Color"]
  // This is used by the frontend to generate option selectors.
  attributes: [{
    type: String,
    required: true,
  }],

  // rating updated via reviews
  rating: {
    average: { type: Number, min: 0, max: 5, default: 0 },
    count: { type: Number, min: 0, default: 0 },
  },

  // General images that apply to all variants of the product
  baseImages: [{
    fileId: { type: String, index: true }, // external image provider identifier
    url: { type: String, required: true },
    altText: { type: String },
  }],
  isActive: {
    type: Boolean,
    default: true,
    index: true,
  },
}, { timestamps: true });

// Compound index for common filtering operations
productSchema.index({ categoryId: 1, brand: 1 });

// Text index for full-text search across key fields
// Weights prioritize name > brand > description for relevance sorting
productSchema.index(
  { name: 'text', brand: 'text', description: 'text' },
  { weights: { name: 10, brand: 5, description: 3 } }
);

const Product = mongoose.model('Product', productSchema);

export default Product;
