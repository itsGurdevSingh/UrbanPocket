import Category from '../models/category.model.js';
import { ApiError } from '../utils/errors.js';

class CategoryRepository {
    constructor() {
        this.model = Category;
    }

    async findAll() {
        return await Category.find({});
    }

    async findOne(filter) {
        return await Category.findOne(filter).lean();
    }

    async findById(id) {
        const item = await Category.findById(id);
        if (!item) {
            throw new ApiError('Category not found', { statusCode: 404, code: 'CATEGORY_NOT_FOUND' });
        }
        return item;
    }

    async create(data) {
        return await Category.create(data);
    }

    async updateById(id, data) {
        const item = await Category.findByIdAndUpdate(id, data, { new: true, runValidators: true });
        if (!item) {
            throw new ApiError('Category not found', { statusCode: 404, code: 'CATEGORY_NOT_FOUND' });
        }
        return item;
    }

    async deleteById(id) {
        const item = await Category.findByIdAndDelete(id);
        if (!item) {
            throw new ApiError('Category not found', { statusCode: 404, code: 'CATEGORY_NOT_FOUND' });
        }
        return item;
    }

    /**
     * Search and filter categories using aggregation pipeline
     * @param {object} filters - Filter criteria (isActive, parentCategory, q)
     * @param {object} pagination - Page and limit for results
     * @returns {Promise<{categories: Array, total: number}>} Categories and total count
     */
    async search(filters = {}, pagination = {}) {
        const pipeline = [];

        // ----------------------------------------------------------------------------------
        // STAGE 1: INITIAL MATCH (FILTER)
        // ----------------------------------------------------------------------------------
        const matchStage = {};

        // Filter by isActive status
        if (filters.isActive !== undefined) {
            matchStage.isActive = filters.isActive === 'true' || filters.isActive === true;
        }

        // Filter by parentCategory
        if (filters.parentCategory) {
            if (filters.parentCategory === 'null' || filters.parentCategory === null) {
                matchStage.parentCategory = null; // Top-level categories
            } else {
                matchStage.parentCategory = new Category.base.Types.ObjectId(filters.parentCategory);
            }
        }

        // Text search on name and description
        if (filters.q) {
            matchStage.$or = [
                { name: { $regex: filters.q, $options: 'i' } },
                { description: { $regex: filters.q, $options: 'i' } }
            ];
        }

        if (Object.keys(matchStage).length > 0) {
            pipeline.push({ $match: matchStage });
        }

        // ----------------------------------------------------------------------------------
        // STAGE 2: SORTING
        // Sort by name ascending by default
        // ----------------------------------------------------------------------------------
        pipeline.push({ $sort: { name: 1 } });

        // ----------------------------------------------------------------------------------
        // STAGE 3: PAGINATION & COUNT ($facet)
        // ----------------------------------------------------------------------------------
        const page = parseInt(pagination.page, 10) || 1;
        const limit = parseInt(pagination.limit, 10) || 20;
        const skip = (page - 1) * limit;

        pipeline.push({
            $facet: {
                paginatedResults: [{ $skip: skip }, { $limit: limit }],
                totalCount: [{ $count: 'count' }],
            },
        });

        // ----------------------------------------------------------------------------------
        // STAGE 4: CLEANUP & RESHAPE OUTPUT
        // ----------------------------------------------------------------------------------
        pipeline.push(
            {
                $project: {
                    categories: '$paginatedResults',
                    total: { $arrayElemAt: ['$totalCount.count', 0] },
                },
            },
            {
                $addFields: {
                    total: { $ifNull: ['$total', 0] },
                },
            }
        );

        // ----------------------------------------------------------------------------------
        // EXECUTION
        // ----------------------------------------------------------------------------------
        const results = await Category.aggregate(pipeline);

        return results[0] || { categories: [], total: 0 };
    }

    /**
     * Get category tree (category with all its descendants)
     * Uses $graphLookup to recursively fetch all child categories
     * @param {string} id - Category ID
     * @returns {Promise<object>} Category with nested children
     */
    async getTree(id) {
        const pipeline = [
            // Match the root category
            {
                $match: {
                    _id: new Category.base.Types.ObjectId(id)
                }
            },
            // Use $graphLookup to recursively find all descendants
            {
                $graphLookup: {
                    from: 'categories', // collection name
                    startWith: '$_id',
                    connectFromField: '_id',
                    connectToField: 'parentCategory',
                    as: 'descendants',
                    depthField: 'depth'
                }
            },
            // Project the fields we need
            {
                $project: {
                    _id: 1,
                    name: 1,
                    description: 1,
                    parentCategory: 1,
                    ancestors: 1,
                    isActive: 1,
                    createdAt: 1,
                    updatedAt: 1,
                    descendants: 1
                }
            }
        ];

        const results = await Category.aggregate(pipeline);

        if (!results || results.length === 0) {
            throw new ApiError('Category not found', { statusCode: 404, code: 'CATEGORY_NOT_FOUND' });
        }

        const rootCategory = results[0];

        // Build hierarchical tree structure
        const buildTree = (parentId, allCategories) => {
            const children = allCategories
                .filter(cat => cat.parentCategory && cat.parentCategory.toString() === parentId.toString())
                .map(cat => ({
                    _id: cat._id,
                    name: cat.name,
                    description: cat.description,
                    parentCategory: cat.parentCategory,
                    ancestors: cat.ancestors,
                    isActive: cat.isActive,
                    createdAt: cat.createdAt,
                    updatedAt: cat.updatedAt,
                    children: buildTree(cat._id, allCategories)
                }));

            return children.length > 0 ? children : undefined;
        };

        // Build the tree structure
        const tree = {
            _id: rootCategory._id,
            name: rootCategory.name,
            description: rootCategory.description,
            parentCategory: rootCategory.parentCategory,
            ancestors: rootCategory.ancestors,
            isActive: rootCategory.isActive,
            createdAt: rootCategory.createdAt,
            updatedAt: rootCategory.updatedAt,
            children: buildTree(rootCategory._id, rootCategory.descendants)
        };

        return tree;
    }
}

export default new CategoryRepository();
