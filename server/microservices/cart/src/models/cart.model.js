// Corrected Cart Model: cart.model.js
import mongoose from 'mongoose';

// This is a SUB-SCHEMA, not a separate model.
const cartItemSchema = new mongoose.Schema({
    variantId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true
        // We will NOT use a ref here. The Product service owns product data.
    },
    quantity: {
        type: Number,
        required: true,
        min: [1, 'Quantity can not be less than 1.'],
        default: 1
    },
}, {
    // Having an _id on sub-documents is essential for updating/deleting them.
    _id: true
});

const cartSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        unique: true, // Guarantees one cart per user
        index: true
    },
    items: [cartItemSchema], // Embed the schema directly
}, {
    timestamps: true
});

// Note: Cart is always active. Order service clears cart on successful order.
// No TTL index needed - cart persists forever for the user.

export const Cart = mongoose.model('Cart', cartSchema);