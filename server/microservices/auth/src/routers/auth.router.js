import express from 'express';
import { validateLogin, validateRegistration } from '../validators/authValidator.js'; // <-- Import the single validator
import { loginUser, logoutUser, registerUser } from '../controllers/auth.controller.js';


const router = express.Router();

router.post('/register', validateRegistration, registerUser);
router.post('/login', validateLogin, loginUser);
router.post('/logout', logoutUser);
// router.post('/refresh-token', );

export default router;