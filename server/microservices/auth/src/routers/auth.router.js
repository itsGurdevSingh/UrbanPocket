import express from 'express';
import { validateRegistration } from '../validators/authValidator.js'; // <-- Import the single validator
import { registerUser } from '../controllers/auth.js';


const router = express.Router();

router.post('/register', validateRegistration, registerUser);

export default router;