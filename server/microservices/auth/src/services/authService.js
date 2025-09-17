import authRepository from '../repositories/authRepository.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import getConfig from '../config/config_keys.js';


const registerNewUser = async (userData) => {

    const { username, email, password } = userData;

    // is user already exist 
    const userExists = await authRepository.isUserExistWithCredientials(username, email);

    if (userExists) {
        const error = new Error('User with given username or email already exists');
        error.statusCode = 409; // Conflict
        throw error;
    }
    // hash password
    const hashPassword = await bcrypt.hash(password, 10);

    // save user to database

    const newUser = await authRepository.createUser({
        username,
        email,
        password: hashPassword,
    });

    //create jwt token

    const token = jwt.sign(
        { userId: newUser._id, username: newUser.username, email: newUser.contactInfo.email },
        getConfig('jwtSecret'),
        { expiresIn: '10h' }
    );

    // return user data and token
    return {
        user: {
            id: newUser._id,
            username: newUser.username,
            email: newUser.contactInfo.email,
        },
        token,
    };

};

export default {
    registerNewUser,
};