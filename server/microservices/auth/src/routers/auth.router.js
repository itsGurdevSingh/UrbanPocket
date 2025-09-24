import express from 'express';
import { validateLogin, validateRefreshToken, validateRegistration } from '../validators/authValidator.js'; // <-- Import the single validator
import { loginUser, logoutUser, registerUser, refreshToken } from '../controllers/auth.controller.js';
import { authenticateUser } from '../middlewares/authentication.middleware.js';


const router = express.Router();

router.post('/register', validateRegistration, registerUser);
router.post('/login', validateLogin, loginUser);
router.post('/logout', logoutUser);
router.post('/refresh-token', validateRefreshToken, refreshToken);

// dummy route to test protected routes
router.get('/protected', authenticateUser, (req, res) => {
    res.status(200).json({ message: 'You have accessed a protected route', user: req.user });
});

export default router;