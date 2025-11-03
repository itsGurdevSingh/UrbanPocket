import mongoose from 'mongoose'

const reserveStockSchema = new mongoose.Schema({
    variantId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ProductVariant',
        required: true,
        index: true,
    },
    totalQuantity: {
        type: Number,
        required: true,
        min: 1,
    },

    // get details of each inventory entry being reserved
    inventoryEntries: [
        {
            inventoryId: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'Inventory',
                required: true,
            },
            quantity: {
                type: Number,
                required: true,
                min: 1,
            },
        },
    ],

    status: {
        type: String,
        enum: ['PENDING', 'COMPLETED'],
        default: 'PENDING',
        index: true,
    },

    reservedAt: {
        type: Date,
        default: Date.now,
    },

    expiresAt: {
        type: Date,
        default: function () {
            return new Date(Date.now() + 300 * 1000); // 5 minutes from now
        },
        index: true,
    },

}, { timestamps: true });

export default mongoose.model('ReserveStock', reserveStockSchema);
