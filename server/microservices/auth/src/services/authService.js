import authRepository from '../repositories/authRepository.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import getConfig from '../config/config_keys.js';
import redisClient from '../db/redis.js';


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

    const user = await authRepository.createUser({
        username,
        email,
        password: hashPassword,
    });

    // generate access token
    const accessToken = jwt.sign(
        { userId: user._id, username: user.username, email: user.contactInfo.email },
        getConfig('jwtSecret'),
        { expiresIn: '15m' } // Access token valid for 15 minutes
    );

    // generate refresh token
    const refreshToken = jwt.sign(
        { userId: user._id },
        getConfig('jwtRefreshSecret'),
        { expiresIn: '7d' } // Refresh token valid for 7 days
    );

    // return user data and token
    return {
        user: {
            id: user._id,
            username: user.username,
            email: user.contactInfo.email,
        },
        accessToken,
        refreshToken
    };

};

const authenticateUser = async (credentials) => {

    const { identifier, password } = credentials;

    // get user by email or username
    const user = await authRepository.findUserForLogin(identifier);

    if (!user) {
        const error = new Error('Invalid credentials');
        error.statusCode = 401; // Unauthorized
        throw error;
    }

    // compare password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
        const error = new Error('Invalid credentials');
        error.statusCode = 401; // Unauthorized
        throw error;
    }

    // generate access token
    const accessToken = jwt.sign(
        { userId: user._id, username: user.username, email: user.contactInfo.email },
        getConfig('jwtSecret'),
        { expiresIn: '15m' } // Access token valid for 15 minutes
    );

    // generate refresh token
    const refreshToken = jwt.sign(
        { userId: user._id },
        getConfig('jwtRefreshSecret'),
        { expiresIn: '7d' } // Refresh token valid for 7 days
    );

    return {
        user: {
            id: user._id,
            username: user.username,
            email: user.contactInfo.email,
        },
        accessToken,
        refreshToken,
    };
};

const logoutUser = async (accessToken, refreshToken) => {

    try {
        // check access token is provided
        if (accessToken) {
            // 1. Get the expiration time from the token payloads
            const accessTokenExp = jwt.decode(accessToken).exp;

            // 2. Calculate the remaining time in seconds
            const expiresInSeconds = accessTokenExp - Math.floor(Date.now() / 1000);

            // 3. Only set the key if it hasn't already expired
            if (expiresInSeconds > 0) {
                // Use 'EX' followed by the number of seconds
                await redisClient.set(`bl_${accessToken}`, 'true', 'EX', expiresInSeconds);
            }
        }

        // check refresh token is provided
        if (refreshToken) {
            // 1. Get the expiration time from the token payloads
            const refreshTokenExp = jwt.decode(refreshToken).exp;

            // 2. Calculate the remaining time in seconds
            const expiresInSeconds = refreshTokenExp - Math.floor(Date.now() / 1000);

            // 3. Only set the key if it hasn't already expired
            if (expiresInSeconds > 0) {
                // Use 'EX' followed by the number of seconds
                await redisClient.set(`bl_${refreshToken}`, 'true', 'EX', expiresInSeconds);
            }
        };

    } catch (error) {
        console.error('Error during logout:', error);
        throw new Error('Logout failed');
    }
};


export default {
    registerNewUser,
    authenticateUser,
    logoutUser
};