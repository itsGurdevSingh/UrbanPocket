import express from 'express';
import { validateLogin, validateRegistration } from '../validators/authValidator.js'; // <-- Import the single validator
import { loginUser, registerUser } from '../controllers/auth.controller.js';


const router = express.Router();

router.post('/register', validateRegistration, registerUser);
router.post('/login', validateLogin, loginUser);

export default router;