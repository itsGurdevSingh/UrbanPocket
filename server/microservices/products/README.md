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

## Contributing

1. Update the service-specific files
2. Remove unused dependencies from `package.json`
3. Update this README with service-specific information
4. Add your custom middlewares, utilities, and business logic

## License

ISC
