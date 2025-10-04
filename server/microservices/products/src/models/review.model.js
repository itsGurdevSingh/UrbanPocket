import mongoose from 'mongoose';

const reviewSchema = new mongoose.Schema(
    {
        product: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Product', // Reference to the Product model   
            required: true,
            index: true
        },
        user: {
            type: mongoose.Schema.Types.ObjectId,
            // this is from saperate auth microservice se we are not referencing here
            required: true,
            index: true
        },
        rating: {
            type: Number,
            required: true,
            min: 1,
            max: 5
        },
        comment: {
            type: String,
            trim: true,
            maxlength: 1000
        }
    },{ timestamps: true });

export const Review = mongoose.model('Review', reviewSchema);
export default Review;