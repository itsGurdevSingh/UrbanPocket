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
    // Only add stock if the item is active
    const stockToAdd = doc.isActive ? doc.stock : 0;
    await ProductVariant.findByIdAndUpdate(doc.variantId, {
      $inc: { stock: stockToAdd },
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
// 'result' is the DOCUMENT *after* the update (if { new: true }), or the old doc otherwise.
// Since we can't rely on 'result' being the new doc, we fetch it manually.
inventorySchema.post('findOneAndUpdate', async function (result, next) {
  try {
    // --------------------------------------------------------------------
    // The pre-hook failed or the doc was not found. Do nothing.
    // --------------------------------------------------------------------
    if (!this._originalDoc) {
      return next();
    }

    // --- Fetch the updated document manually since result might be old doc ---
    const updatedDoc = await this.model.findOne(this.getQuery());

    if (!updatedDoc) {
      // Document was deleted or doesn't exist after update
      return next();
    }

    // --- We have the original doc and the new (updatedDoc) doc. Compare. ---
    const newStock = updatedDoc.stock;
    const newVariant = updatedDoc.variantId;
    const newIsActive = updatedDoc.isActive;

    const originalStock = this._originalDoc.stock;
    const originalVariant = this._originalDoc.variantId;
    const originalIsActive = this._originalDoc.isActive;

    const ProductVariant = mongoose.model('ProductVariant');

    if (originalVariant.toString() === newVariant.toString()) {
      // --- Case A: The variantId DID NOT change ---
      const oldEffectiveStock = originalIsActive ? originalStock : 0;
      const newEffectiveStock = newIsActive ? newStock : 0;
      const stockDifference = newEffectiveStock - oldEffectiveStock;

      if (stockDifference !== 0) {
        await ProductVariant.findByIdAndUpdate(newVariant, {
          $inc: { stock: stockDifference },
        });
      }
    } else {
      // --- Case B: The variantId CHANGED ---
      const oldEffectiveStock = originalIsActive ? originalStock : 0;
      const newEffectiveStock = newIsActive ? newStock : 0;

      // This is a critical transaction, run them in parallel
      await Promise.all([
        ProductVariant.findByIdAndUpdate(originalVariant, {
          $inc: { stock: -oldEffectiveStock }, // Remove from old
        }),
        ProductVariant.findByIdAndUpdate(newVariant, {
          $inc: { stock: newEffectiveStock }, // Add to new
        }),
      ]);
    }

    // --- Success ---
    next();

  } catch (error) {
    // --- CRITICAL FAILURE ---
    // If the hook fails, we MUST pass the error.
    // This will bubble up to the user. This is a GOOD thing.
    // It tells them the operation failed and data is safe.
    console.error('CRITICAL: inventorySchema.post(findOneAndUpdate) hook failed:', error);
    next(error);
  }
});

// DOMINO 3: After an inventory item is DELETED (`.findOneAndDelete()` or `.findByIdAndDelete()`)
// This is a QUERY middleware.
inventorySchema.post('findOneAndDelete', async function (doc, next) {
  try {
    // 'doc' is the document that was deleted.
    if (doc) {
      const ProductVariant = mongoose.model('ProductVariant');
      // Only subtract stock if the item was active
      const stockToSubtract = doc.isActive ? doc.stock : 0;
      await ProductVariant.findByIdAndUpdate(doc.variantId, {
        $inc: { stock: -stockToSubtract },
      });
    }
    next();
  } catch (error) {
    next(error);
  }
});


const InventoryItem = mongoose.model('InventoryItem', inventorySchema);
export default InventoryItem;