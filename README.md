# UrbanPocket

UrbanPocket is a microservices-based backend system designed to explore how production-grade distributed applications are structured and operated.

The project decomposes core functionality into independent services with clear ownership and service boundaries. Services communicate through gRPC, while persistence and infrastructure components are isolated behind their respective services.

The project focuses on:

* Microservice architecture and service boundaries
* gRPC-based inter-service communication
* Independent service development and deployment
* Authentication and authorization
* Database-per-service patterns
* Redis-based caching and infrastructure
* API design and service contracts
* Error handling and fault isolation
* Scalable backend architecture
* Dockerized development and deployment

Rather than being a simple CRUD application, UrbanPocket is primarily a learning and engineering project for understanding the problems that appear when a backend moves from a monolith toward a distributed architecture.
