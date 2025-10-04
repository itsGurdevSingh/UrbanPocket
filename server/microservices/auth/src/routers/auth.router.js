import express from 'express';
import { validateUpdateAddress, validateAddAddress, validateLogin, validateRefreshToken, validateRegistration, validateDeleteAddress } from '../validators/authValidator.js'; // <-- Import the validators
import { loginUser, logoutUser, registerUser, refreshToken, getUserProfile, getUserAddresses, addAddress, deleteAddress, updateAddress } from '../controllers/auth.controller.js';
import { authenticateUser } from '../middlewares/authentication.middleware.js';


const router = express.Router();

// Auth routes
router.post('/register', validateRegistration, registerUser);
router.post('/login', validateLogin, loginUser);
router.post('/logout', logoutUser);
router.post('/refresh-token', validateRefreshToken, refreshToken);

// user profile route
router.get('/me', authenticateUser, getUserProfile);

// verify api for otherr microservices to verify token and get user info 
// its same as /me route but kept for clarity
router.get('/verify', authenticateUser, getUserProfile);


// address routes
router.get('/getAddresses', authenticateUser, getUserAddresses);
router.post('/addAddress',  authenticateUser, validateAddAddress,addAddress);
// Ensure authentication runs before validation so unauthenticated requests are rejected first
router.delete('/deleteAddress', authenticateUser, validateDeleteAddress, deleteAddress);
router.patch('/updateAddress', authenticateUser, validateUpdateAddress, updateAddress);

// Health check route
router.get('/health', (req, res) => {
    res.status(200).json({ status: 'OK', message: 'Auth service is running' });
});

// dummy route to test protected routes
router.get('/protected', authenticateUser, (req, res) => {
    res.status(200).json({ message: 'You have accessed a protected route', user: req.user });
});

export default router;