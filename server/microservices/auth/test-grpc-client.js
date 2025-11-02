/**
 * Test Client for Auth gRPC Service
 * This script demonstrates how other services can call the GetAddress RPC
 * 
 * Usage: node test-grpc-client.js <userId> <addressId>
 */

import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load proto file
const PROTO_PATH = join(__dirname, './protos/auth.proto');
const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true,
});

const authProto = grpc.loadPackageDefinition(packageDefinition).auth;

// Create client
const client = new authProto.AuthService(
    'localhost:5052',
    grpc.credentials.createInsecure()
);

// Get command line arguments
const userId = process.argv[2];
const addressId = process.argv[3];

if (!userId || !addressId) {
    console.error('Usage: node test-grpc-client.js <userId> <addressId>');
    process.exit(1);
}

// Make gRPC call
console.log(`\n🔄 Calling GetAddress RPC...`);
console.log(`   userId: ${userId}`);
console.log(`   addressId: ${addressId}\n`);

client.GetAddress({ userId, addressId }, (error, response) => {
    if (error) {
        console.error('❌ gRPC Error:', error.message);
        console.error('   Code:', error.code);
        return;
    }

    console.log('✅ Response received:\n');
    console.log(JSON.stringify(response, null, 2));

    if (response.success) {
        console.log('\n✨ Address Details:');
        console.log(`   Street: ${response.address.street}`);
        console.log(`   City: ${response.address.city}`);
        console.log(`   State: ${response.address.state}`);
        console.log(`   Country: ${response.address.country}`);
        console.log(`   ZIP: ${response.address.zipCode}`);
    } else {
        console.log(`\n⚠️  ${response.message}`);
        if (response.error) {
            console.log(`   Error Code: ${response.error.code}`);
            console.log(`   Error Message: ${response.error.message}`);
        }
    }

    process.exit(0);
});
