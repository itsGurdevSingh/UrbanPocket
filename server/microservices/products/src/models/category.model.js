import mongoose from "mongoose";

const categorySchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true,
        unique: true,
        maxlength: 50,
    },
    description: {
        type: String,
        trim: true,
        maxlength: 500,
    },
    // This allows for subcategories, e.g., "Fertilizers" -> "Organic Fertilizers"
    parentCategory: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Category',
        default: null, // A null parent means it's a top-level category
    },
    // For easier querying of all child categories
    ancestors: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Category',
    }],
    isActive: {
        type: Boolean,
        default: true,
    },
}, { timestamps: true });

const Category = mongoose.model('Category', categorySchema);

export default Category;