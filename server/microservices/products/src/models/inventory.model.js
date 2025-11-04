import mongoose from "mongoose";

// We must import the ProductVariant model here to update it.
// To prevent circular dependency errors, we will import it using
// mongoose.model('ProductVariant') inside the hooks where it's needed.

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
  // The current stock level for this batch
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
// We make it a sparse index to allow multiple null/undefined batchNumbers.
inventorySchema.index(
  { variantId: 1, batchNumber: 1 }, 
  { unique: true, sparse: true }
);


// --- ATOMIC HOOKS (The "Dominoes") ---
// This new design uses atomic $inc operations to prevent race conditions.
// The "engine" (updateVariantStock) is no longer needed.


// DOMINO 1: After a NEW inventory item is SAVED (`.save()` or `.create()`)
// This is a DOCUMENT middleware. `this` is the document.
inventorySchema.post('save', async function (doc, next) {
  try {
    const ProductVariant = mongoose.model('ProductVariant');
    // Atomically add the new stock to the parent variant.
    await ProductVariant.findByIdAndUpdate(doc.variantId, {
      $inc: { stock: doc.stock },
    });
    next();
  } catch (error) {
    next(error);
  }
});


// DOMINO 2: After an inventory item is UPDATED (`.findByIdAndUpdate()`, `.findOneAndUpdate()`)
// This is a QUERY middleware. We must handle stock *and* variantId changes.

// 2a. 'pre' hook: Get the *original* document *before* the update.
inventorySchema.pre('findOneAndUpdate', async function (next) {
  try {
    // this.getQuery() gets the selector. We execute it to find the doc.
    this._originalDoc = await this.model.findOne(this.getQuery());
    next();
  } catch (error) {
    next(error);
  }
});

// 2b. 'post' hook: Compare the original doc to the new doc.
inventorySchema.post('findOneAndUpdate', async function (doc, next) {
  try {
    if (!this._originalDoc) {
      // No original doc found (e.g., upsert=true).
      // Or it's a new doc, which 'save' hook will handle.
      return next();
    }
    
    // Get the doc as it is *after* the update.
    // 'doc' is passed by Mongoose, but it's the *updated* doc.
    const newStock = doc.stock;
    const newVariant = doc.variantId;

    const originalStock = this._originalDoc.stock;
    const originalVariant = this._originalDoc.variantId;
    
    const ProductVariant = mongoose.model('ProductVariant');

    if (originalVariant.toString() === newVariant.toString()) {
      // --- Case A: The variantId DID NOT change ---
      // We only need to update one variant with the *difference* in stock.
      const stockDifference = newStock - originalStock;
      if (stockDifference !== 0) {
        await ProductVariant.findByIdAndUpdate(newVariant, {
          $inc: { stock: stockDifference },
        });
      }
    } else {
      // --- Case B: The variantId CHANGED (e.g., batch re-assigned) ---
      // We must update *both* variants atomically.
      const updateOriginalVariant = ProductVariant.findByIdAndUpdate(originalVariant, {
        $inc: { stock: -originalStock }, // Remove old stock from old variant
      });
      const updateNewVariant = ProductVariant.findByIdAndUpdate(newVariant, {
        $inc: { stock: newStock }, // Add new stock to new variant
      });
      await Promise.all([updateOriginalVariant, updateNewVariant]);
    }
    next();
  } catch (error) {
    next(error);
  }
});


// DOMINO 3: After an inventory item is DELETED (`.findOneAndDelete()`)
// This is a QUERY middleware.
inventorySchema.post('findOneAndDelete', async function (doc, next) {
  try {
    // 'doc' is the document that was deleted.
    if (doc) {
      const ProductVariant = mongoose.model('ProductVariant');
      // Atomically subtract the deleted stock from the parent.
      await ProductVariant.findByIdAndUpdate(doc.variantId, {
        $inc: { stock: -doc.stock },
      });
    }
    next();
  } catch (error) {
    next(error);
  }
});

// --- FEFO Static Method ---

/**
 * Finds and returns the specific inventory batches needed to fulfill a
 * required quantity, using FEFO (First-Expiring, First-Out) logic.
 *
 * @param {string} variantId - The ID of the variant to reserve.
 * @param {number} requiredQuantity - The total quantity needed.
 * @returns {Promise<Array<{inventoryId: string, quantity: number, price: object, location: object}>>} An array of batches to reserve.
 * @throws {Error} If the total available stock is insufficient.
 */
inventorySchema.statics.findFefoBatchesForReservation = async function (
  variantId,
  requiredQuantity
) {
  let quantityToFulfill = requiredQuantity;
  const batchesToReserve = [];

  const inventoryCursor = this.aggregate([
    {
      $match: {
        variantId: new mongoose.Types.ObjectId(variantId),
        isActive: true,
        stock: { $gt: 0 },
      },
    },
    {
      $addFields: {
        // Use the actual expiration date for sorting
        expiresAt: "$manufacturingDetails.expDate",
        // Create a sort field to put items *with* an expiry date first
        hasExpiry: { $ne: ["$manufacturingDetails.expDate", null] },
      },
    },
    {
      $sort: {
        hasExpiry: -1,  // true (has expiry) comes before false (no expiry)
        expiresAt: 1, // Earliest expiration date first
        createdAt: 1, // Oldest stock first as a fallback
      },
    },
  ]);

  for await (const batch of inventoryCursor) {
    if (quantityToFulfill <= 0) {
      break; 
    }
    const quantityFromThisBatch = Math.min(batch.stock, quantityToFulfill);
    batchesToReserve.push({
      inventoryId: batch._id,
      quantity: quantityFromThisBatch,
      price: batch.price, // Also return price for the snapshot
      // location: batch.location, // Also return location for the pick list
    });

    // Reduce the remaining quantity to fulfill from inventory batch
    this.findByIdAndUpdate(batch._id, {
      $inc: { stock: -quantityFromThisBatch },
    }).exec();

    quantityToFulfill -= quantityFromThisBatch;
  }

  if (quantityToFulfill > 0) {
    throw new Error(
      `Insufficient stock for variant ${variantId}. Required: ${requiredQuantity}, Found: ${
        requiredQuantity - quantityToFulfill
      }`
    );
  }
  return batchesToReserve;
};


const InventoryItem = mongoose.model('InventoryItem', inventorySchema);
export default InventoryItem;