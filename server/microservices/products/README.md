# Microservice Boilerplate

A complete boilerplate for building microservices with Node.js, Express, MongoDB, and Redis.

## Features

✅ **Express.js** - Fast, unopinionated web framework  
✅ **MongoDB** with Mongoose - Database integration  
✅ **Redis** - Caching and session management  
✅ **JWT Authentication** - Ready-to-use auth utilities  
✅ **Error Handling** - Comprehensive error management  
✅ **Logging** - Winston-based logging system  
✅ **Validation** - Express-validator integration  
✅ **Testing** - Jest with MongoDB Memory Server  
✅ **OpenAPI Documentation** - API documentation structure  
✅ **ES6 Modules** - Modern JavaScript syntax

## Quick Start

### 1. Copy the boilerplate

```bash
cp -r boilerplate your-new-service
cd your-new-service
```

### 2. Install dependencies

```bash
npm install
```

### 3. Environment Setup

Create a `.env` file:

```env
# Database
MONGO_URL=mongodb://localhost:27017/your-service-name

# JWT Secrets
JWT_SECRET=your-jwt-secret-key
JWT_REFRESH_SECRET=your-refresh-secret-key

# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# Server Configuration
PORT=3000
NODE_ENV=development
LOG_LEVEL=info

# Client URL for CORS
CLIENT_URL=http://localhost:3000
```

### 4. Update package.json

```json
{
  "name": "your-service-name",
  "description": "Your service description",
  "author": "Your Name"
}
```

### 5. Start development

```bash
npm run dev
```

## Project Structure

```
├── src/
│   ├── app.js                 # Express app setup
│   ├── config/
│   │   └── config_keys.js     # Configuration management
│   ├── controllers/           # Request handlers
│   ├── db/
│   │   ├── db.js             # MongoDB connection
│   │   └── redis.js          # Redis connection
│   ├── middlewares/
│   │   └── errorHandler.js   # Global error handler
│   ├── models/               # Mongoose models
│   ├── repositories/         # Data access layer
│   ├── routers/              # Route definitions
│   ├── services/             # Business logic
│   ├── utils/
│   │   ├── errors.js         # Custom error classes
│   │   └── logger.js         # Winston logger
│   └── validators/           # Request validation
├── tests/
│   ├── setups/
│   │   ├── setup.js          # Test database setup
│   │   └── redis-setup.js    # Redis mock setup
│   ├── mocks/
│   │   └── redis.mock.js     # Redis mock implementation
│   └── *.test.js             # Test files
├── openapi/                  # API documentation
│   ├── openapi.yaml          # Main OpenAPI spec
│   ├── paths/                # API paths
│   └── schemas/              # Data schemas
├── server.js                 # Entry point
├── package.json              # Dependencies and scripts
├── babel.config.cjs          # Babel configuration
└── jest.config.cjs           # Jest configuration
```

## Available Scripts

- `npm start` - Start production server
- `npm run dev` - Start development server with nodemon
- `npm test` - Run tests
- `npm run test:watch` - Run tests in watch mode
- `npm run test:coverage` - Run tests with coverage report

## Development Workflow

### 1. Define Your Data Model

Update `src/models/sample.model.js` with your schema:

```javascript
const yourSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    // Add your fields here
  },
  { timestamps: true }
);
```

### 2. Create Repository Layer

Update `src/repositories/sample.repository.js` for data access.

### 3. Implement Business Logic

Update `src/services/sample.service.js` for your business rules.

### 4. Create Controllers

Update `src/controllers/sample.controller.js` for request handling.

### 5. Define Routes

Update `src/routers/sample.router.js` and register in `src/app.js`.

### 6. Add Validation

Update `src/validators/sample.validator.js` for request validation.

### 7. Write Tests

Create test files in the `tests/` directory.

### 8. Update API Documentation

Update OpenAPI specs in the `openapi/` directory.

## Testing

The boilerplate includes:

- **MongoDB Memory Server** for isolated database testing
- **Redis Mock** for Redis operations testing
- **Supertest** for HTTP endpoint testing
- **Jest** as the test runner

Run tests:

```bash
npm test
```

## Error Handling

The boilerplate includes comprehensive error handling:

- Custom `ApiError` class for structured errors
- Global error handler middleware
- Automatic conversion of common errors (MongoDB, Redis, JWT)
- Error logging with unique error IDs for tracing

## API Documentation

OpenAPI 3.0 specification is included:

- Main spec: `openapi/openapi.yaml`
- Organized paths and schemas
- Example endpoints and responses

## Environment Variables

| Variable             | Description               | Default                                  |
| -------------------- | ------------------------- | ---------------------------------------- |
| `MONGO_URL`          | MongoDB connection string | `mongodb://localhost:27017/microservice` |
| `JWT_SECRET`         | JWT signing secret        | Required                                 |
| `JWT_REFRESH_SECRET` | JWT refresh token secret  | Required                                 |
| `REDIS_HOST`         | Redis server host         | Required                                 |
| `REDIS_PORT`         | Redis server port         | Required                                 |
| `REDIS_PASSWORD`     | Redis password            | Optional                                 |
| `PORT`               | Server port               | `3000`                                   |
| `NODE_ENV`           | Environment               | `development`                            |
| `LOG_LEVEL`          | Logging level             | `info`                                   |
| `CLIENT_URL`         | Client URL for CORS       | `http://localhost:3000`                  |

## Product API – Filtering & Pagination (GET /api/product/getAll)

Enhanced endpoint supporting rich querying, pagination, sorting, selective fields and text search.

### Query Parameters

| Param                       | Type                 | Default      | Description                                                                                         |
| --------------------------- | -------------------- | ------------ | --------------------------------------------------------------------------------------------------- |
| `page`                      | number               | 1            | 1-based page index                                                                                  |
| `limit`                     | number               | 20           | Page size (1–100)                                                                                   |
| `categoryId`                | ObjectId             | –            | Filter by category                                                                                  |
| `sellerId`                  | ObjectId             | –            | Filter by seller                                                                                    |
| `brand`                     | string               | –            | Exact brand match (indexed)                                                                         |
| `isActive`                  | boolean              | true/false   | Filter by active state                                                                              |
| `ids`                       | comma list(ObjectId) | –            | Return only these product IDs                                                                       |
| `q`                         | string               | –            | Full-text search (name, description, brand)                                                         |
| `sort`                      | string               | `-createdAt` | Comma list of fields (prefix `-` for desc). Allowed: createdAt, updatedAt, name, brand              |
| `fields`                    | string               | –            | Comma list of fields to include (name, brand, sellerId, categoryId, isActive, createdAt, updatedAt) |
| `createdFrom` / `createdTo` | ISO date             | –            | Created date range                                                                                  |
| `updatedFrom` / `updatedTo` | ISO date             | –            | Updated date range                                                                                  |

### Text Search Notes

Providing `q` triggers a Mongo `$text` query. If no explicit `sort` is provided, results are sorted by text score then newest (`createdAt` desc). If `sort` is specified, it overrides the score ordering.

### Sample Requests

```http
GET /api/product/getAll?limit=10&page=2&brand=EvenBrand
GET /api/product/getAll?ids=64fa0e...,64fa1a...&fields=name,brand
GET /api/product/getAll?q=organic fertilizer&sort=-updatedAt
GET /api/product/getAll?isActive=false&createdFrom=2025-01-01&createdTo=2025-02-01
```

### Response Shape

```json
{
  "status": "success",
  "products": [{ "_id": "...", "name": "...", "brand": "..." }],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 137,
    "totalPages": 7,
    "hasNextPage": true,
    "hasPrevPage": false
  },
  "count": 20 // deprecated alias (will be removed later)
}
```

### Validation Rules

- Invalid ObjectIds -> 400 `VALIDATION_ERROR`
- `sort` only allows approved fields (with optional `-` prefix)
- `fields` must be from the whitelist (others rejected)
- Date range validation enforces `from <= to`
- `ids` must be a non-empty comma list of valid ObjectIds

### Performance Considerations

- Indexes used: `name`/`description`/`brand` (text), `brand`, `sellerId`, `categoryId`, `isActive`, compound `{ categoryId, brand }`.
- For large datasets consider adding: `{ isActive: 1, createdAt: -1 }` for frequent active/newest queries.
- Future enhancement: cursor-based pagination when deep offset pages become expensive.

### Roadmap Enhancements (Optional)

- Add `cursor` parameter for stable pagination.
- Add caching layer (Redis) for common filter combos.
- Expose `includeVariants=true` to aggregate variant summaries.
- Offer fuzzy search fallback when `$text` returns no hits.

## Contributing

1. Update the service-specific files
2. Remove unused dependencies from `package.json`
3. Update this README with service-specific information
4. Add your custom middlewares, utilities, and business logic

## License

ISC
