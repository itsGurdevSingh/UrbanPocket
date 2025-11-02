import grpc from '@grpc/grpc-js';
import protoLoader from '@grpc/proto-loader';
import path from 'path';

const PROTO_PATH = path.join(process.cwd(), 'protos', 'product.proto');

// Load proto
const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true
});

const productProto = grpc.loadPackageDefinition(packageDefinition).product;

// Create client
const client = new productProto.ProductService(
    'localhost:50053',
    grpc.credentials.createInsecure()
);

// Get variantId from command line args
const variantId = process.argv[2];

if (!variantId) {
    console.error('Usage: node test-grpc-client.js <variantId>');
    process.exit(1);
}

// Test GetVariantDetails
client.GetVariantDetails({ variantId }, (error, response) => {
    if (error) {
        console.error('❌ gRPC Error:', error);
        process.exit(1);
    }

    console.log('\n✅ GetVariantDetails Response:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Success:', response.success);
    console.log('Message:', response.message);

    if (response.variant) {
        console.log('\nVariant Details:');
        console.log('  ID:', response.variant.id);
        console.log('  Product ID:', response.variant.productId);
        console.log('  SKU:', response.variant.sku);
        console.log('  Options:', response.variant.options);
        console.log('  Price:', {
            amount: response.variant.price.amount,
            currency: response.variant.price.currency
        });
        console.log('  Stock:', response.variant.stock);
        console.log('  Base Unit:', response.variant.baseUnit);
        console.log('  Images:', response.variant.variantImages.length);
        console.log('  Active:', response.variant.isActive);
    }

    if (response.error) {
        console.log('\nError Details:');
        console.log('  Code:', response.error.code);
        console.log('  Message:', response.error.message);
        console.log('  Details:', response.error.details);
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    process.exit(0);
});
