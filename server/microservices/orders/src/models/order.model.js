import mongoose from 'mongoose';

const { Schema } = mongoose;

/**
 * OrderItem Schema (embedded in Order)
 * Represents a single product variant within an order
 */
const orderItemSchema = new Schema({
    variantId: {
        type: Schema.Types.ObjectId,
        required: [true, 'Variant ID is required'],
        // Note: Not referencing product service to maintain loose coupling
    },
    quantity: {
        type: Number,
        required: [true, 'Quantity is required'],
        min: [1, 'Quantity must be at least 1'],
        validate: {
            validator: Number.isInteger,
            message: 'Quantity must be an integer'
        }
    },
    price: {
        type: Number,
        required: [true, 'Price is required'],
        min: [0, 'Price cannot be negative'],
    },
    // TODO: Add product snapshot data
    // productName: String,
    // variantName: String,
    // productImage: String,
    // etc. - to preserve order data even if product is deleted/updated
}, {
    _id: true, // Enable sub-document IDs for easier item manipulation
    timestamps: false // No timestamps needed for sub-documents
});

/**
 * Order Schema
 * Represents a customer order with embedded items
 */
const orderSchema = new Schema({
    userId: {
        type: Schema.Types.ObjectId,
        required: [true, 'User ID is required'],
        index: true,
        // Note: Not referencing auth service to maintain loose coupling
    },
    items: {
        type: [orderItemSchema],
        validate: {
            validator: function(items) {
                return items && items.length > 0;
            },
            message: 'Order must have at least one item'
        }
    },
    // TODO: Add order-specific fields based on requirements
    // Examples:
    // status: {
    //     type: String,
    //     enum: ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'],
    //     default: 'pending'
    // },
    // totalAmount: Number,
    // shippingAddress: {
    //     street: String,
    //     city: String,
    //     state: String,
    //     zipCode: String,
    //     country: String
    // },
    // paymentMethod: String,
    // paymentStatus: String,
    // orderNumber: String, // Unique order number for customer reference
    // notes: String,
}, {
    timestamps: true, // Adds createdAt and updatedAt
    collection: 'orders'
});

// Indexes
// Add custom indexes based on query patterns
// Example: orderSchema.index({ userId: 1, createdAt: -1 });
// Example: orderSchema.index({ orderNumber: 1 }, { unique: true });

// Virtual fields (if needed)
// Example: Calculate total from items
// orderSchema.virtual('calculatedTotal').get(function() {
//     return this.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
// });

// Instance methods
// Add custom methods for order operations
// Example: orderSchema.methods.cancel = function() { ... };

// Static methods
// Add custom static methods for queries
// Example: orderSchema.statics.findByOrderNumber = function(orderNumber) { ... };

export const Order = mongoose.model('Order', orderSchema);
export const OrderItemSchema = orderItemSchema; // Export for testing or reference
