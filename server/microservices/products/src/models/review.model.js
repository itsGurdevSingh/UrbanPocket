import mongoose from 'mongoose';

const reviewSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true,
    index: true,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    index: true,
  },
  rating: {
    type: Number,
    required: true,
    min: 1,
    max: 5,
  },
  comment: {
    type: String,
    trim: true,
    maxlength: 1000,
  },
}, { timestamps: true });

// --- THE ENGINE ---
// This is the reusable machine that calculates the rating for a given product.
reviewSchema.statics.calculateAverageRating = async function(productId) {
  // We get the Product model here to avoid circular dependency errors at boot.
  const Product = mongoose.model('Product');

  const stats = await this.aggregate([
    { $match: { product: productId } },
    {
      $group: {
        _id: '$product',
        reviewCount: { $sum: 1 },
        averageRating: { $avg: '$rating' },
      },
    },
  ]);

  // Update the parent Product document with the new stats, or reset if no reviews are left.
  if (stats.length > 0) {
    await Product.findByIdAndUpdate(productId, {
      rating: {
        average: stats[0].averageRating,
        count: stats[0].reviewCount,
      },
    });
  } else {
    await Product.findByIdAndUpdate(productId, {
      rating: { average: 0, count: 0 },
    });
  }
};


// --- THE DOMINOES: TRIGGERING THE ENGINE ---

// DOMINO 1: After a NEW review is SAVED (`.save()` or `.create()`)
// This is a DOCUMENT middleware. `this` is the document.
reviewSchema.post('save', function() {
  this.constructor.calculateAverageRating(this.product);
});


// get product(id) of deleted review in pre hook
reviewSchema.pre('remove', function(next) {
    this._updateRatingFor = this.product; // Store the id for use in post hook
});

// call the rating calculation in post hook after deletion on deleted product
reviewSchema.post('remove', function() {
  this.constructor.calculateAverageRating(this._updateRatingFor);
});


const Review = mongoose.model('Review', reviewSchema);

export default Review;

