import mongoose from 'mongoose';
import Product from '../models/product.model.js';

/**
 * Executes a dynamic aggregation pipeline to search and filter products for the storefront.
 * This is the core search engine of the application.
 * @param {object} filters - Desired filter criteria.
 * @param {object} sort - Sort field and order.
 * @param {object} pagination - Page and limit for results.
 * @returns {Promise<{products: Array, total: number}>} Search results and total count.
 */
const search = async (filters = {}, sort = {}, pagination = {}) => {
  const pipeline = [];

  // ----------------------------------------------------------------------------------
  // STAGE 1: INITIAL MATCH (PRE-FILTER)
  // Critically narrows the initial document set on the indexed `Product` collection.
  // This is the primary optimization, ensuring joins are performed on a smaller dataset.
  // ----------------------------------------------------------------------------------
  const initialMatch = { isActive: true };

  if (filters.search) {
    initialMatch.$text = { $search: filters.search };
  }
  if (filters.category) {
    // Convert comma-separated category IDs into ObjectIds; ignore invalid ones
    const categoryIds = filters.category
      .split(',')
      .map((id) => id.trim())
      .filter((id) => mongoose.isValidObjectId(id))
      .map((id) => new mongoose.Types.ObjectId(id));
    if (categoryIds.length > 0) {
      initialMatch.categoryId = { $in: categoryIds };
    } else {
      // If no valid category ids, short-circuit to ensure no results
      return { products: [], total: 0 };
    }
  }
  if (filters.brand) {
    const brands = filters.brand.split(',').map(b => new RegExp(b, 'i')); // Case-insensitive regex match
    initialMatch.brand = { $in: brands };
  }
  if (filters.sellerId) {
    initialMatch.sellerId = new mongoose.Types.ObjectId(filters.sellerId);
  }

  pipeline.push({ $match: initialMatch });

  // Add the text score field if a search query is present, for relevance sorting.
  if (filters.search) {
    pipeline.push({ $addFields: { score: { $meta: 'textScore' } } });
  }

  // ----------------------------------------------------------------------------------
  // STAGE 2: LOOKUPS (JOINS)
  // Join the filtered products downwards to variants and then to inventory items.
  // ----------------------------------------------------------------------------------
  pipeline.push(
    { $lookup: { from: 'productvariants', localField: '_id', foreignField: 'productId', as: 'variant' } },
    { $unwind: '$variant' },
    { $lookup: { from: 'inventoryitems', localField: 'variant._id', foreignField: 'variantId', as: 'inventory' } },
    { $unwind: '$inventory' }
  );

  // ----------------------------------------------------------------------------------
  // STAGE 3: POST-JOIN MATCH (POST-FILTER)
  // Refines the results by filtering on fields from the joined variant and inventory collections.
  // ----------------------------------------------------------------------------------
  const postMatch = {
    'variant.isActive': true,
    'inventory.stockInBaseUnits': { $gt: 0 },
  };

  if (filters.minPrice || filters.maxPrice) {
    postMatch['inventory.pricePerBaseUnit.amount'] = {};
    if (filters.minPrice) postMatch['inventory.pricePerBaseUnit.amount'].$gte = Number(filters.minPrice);
    if (filters.maxPrice) postMatch['inventory.pricePerBaseUnit.amount'].$lte = Number(filters.maxPrice);
  }
  // Dynamically build match conditions for variant options (e.g., ?option_Size=M)
  for (const key in filters) {
    if (key.startsWith('option_')) {
      const optionKey = key.split('_')[1];
      postMatch[`variant.options.${optionKey}`] = filters[key];
    }
  }

  pipeline.push({ $match: postMatch });

  // ----------------------------------------------------------------------------------
  // STAGE 4: SORTING
  // Applies sorting based on a whitelisted set of fields.
  // ----------------------------------------------------------------------------------
  let sortStage = {};
  // Sort by relevance score if a text search was performed.
  if (sort.sortBy === 'relevance' && filters.search) {
    sortStage = { score: -1 };
  } else if (sort.sortBy === 'price') {
    sortStage = { 'inventory.pricePerBaseUnit.amount': sort.sortOrder === 'desc' ? -1 : 1 };
  } else {
    // Default sort is by creation date of the product.
    sortStage = { createdAt: -1 };
  }
  pipeline.push({ $sort: sortStage });

  // ----------------------------------------------------------------------------------
  // STAGE 5: PAGINATION & FINAL PROJECTION ($facet)
  // Uses $facet to run two sub-pipelines: one for paginating the data, and one for getting the total count.
  // This is the most efficient method for paginated queries.
  // ----------------------------------------------------------------------------------
  const page = parseInt(pagination.page, 10) || 1;
  const limit = parseInt(pagination.limit, 10) || 10;
  const skip = (page - 1) * limit;

  const finalProjection ={
    // --- Key Identifiers ---
    _id: '$inventory._id', // The sellable item's ID is the root ID
    sku: '$variant.sku',
    
    // --- Core Product Info (from the parent) ---
    name: '$name',
    brand: '$brand',
    description: '$description',
    
    // --- Variant & Inventory Details (Flattened) ---
    options: '$variant.options',
    price: '$inventory.pricePerBaseUnit', // One clear price object
    stock: '$inventory.stockInBaseUnits', // One clear stock number
    
    // --- Other Important Fields ---
    images: { $concatArrays: ['$baseImages', '$variant.variantImages'] }, // Combine product and variant images
    rating: '$rating',
    sellerId: '$sellerId',
    categoryId: '$categoryId',
  };

  pipeline.push({
    $facet: {
      paginatedResults: [{ $skip: skip }, { $limit: limit }, { $project: finalProjection}],
      totalCount: [{ $count: 'count' }],
    },
  });

  // ----------------------------------------------------------------------------------
  // STAGE 6: CLEANUP & RESHAPE OUTPUT
  // Deconstructs the $facet output to provide a clean, predictable return object.
  // This simplifies the logic in the service layer.
  // ----------------------------------------------------------------------------------
  pipeline.push(
    {
      $project: {
        products: '$paginatedResults',
        // Safely extract the count from the totalCount array, defaulting to 0.
        total: { $arrayElemAt: ['$totalCount.count', 0] },
      },
    },
    // Ensure 'total' is always a number.
    {
      $addFields: {
        total: { $ifNull: ['$total', 0] },
      },
    }
  );

  // ----------------------------------------------------------------------------------
  // EXECUTION
  // ----------------------------------------------------------------------------------
  const results = await Product.aggregate(pipeline);

  // The aggregation will return an array with a single, perfectly shaped object,
  // or an empty array if no documents matched the initial filters.
  return results[0] || { products: [], total: 0 };
};

export default { search };

