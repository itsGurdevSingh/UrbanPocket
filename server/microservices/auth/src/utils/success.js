/**
 * A standardized success response class for the API.
 * This ensures that all successful responses from the API follow a consistent,
 * predictable structure.
 */
class ApiResponse {
    /**
     * @param {any} data - The payload to be returned. This will be wrapped in a 'data' field.
     * @param {string} [message="Success"] - A descriptive message for the response.
     */
    constructor(data = null, message = "Success") {
        this.success = true;
        this.message = message;
        this.data = data;
    }
}

export { ApiResponse };
