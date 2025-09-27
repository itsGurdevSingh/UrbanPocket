import authRepository from '../repositories/authRepository.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import getConfig from '../config/config_keys.js';
import redisClient from '../db/redis.js';
import { signTokens, blacklistToken, breachDetected } from '../utils/auth.utils.js';
import { addUserSession, deleteUserSessions, replaceUserSession } from '../repositories/sessionRepository.js';


const registerNewUser = async (userData) => {

    const { username, email, password, ...optionalFields } = userData;

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
        ...optionalFields
    });

    const { accessToken, refreshToken } = signTokens(user);

    // store session in db
    await addUserSession(user._id, { refreshToken: refreshToken, accessToken: accessToken });

    // return user data and token
    return {
        user: {
            id: user._id,
            username: user.username,
            email: user.contactInfo.email,
            role: user.role
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

    // generate tokens
    const { accessToken, refreshToken } = signTokens(user);

    // store session in db
    await addUserSession(user._id, { refreshToken: refreshToken, accessToken: accessToken });

    return {
        user: {
            id: user._id,
            username: user.username,
            email: user.contactInfo.email,
            role: user.role
        },
        accessToken,
        refreshToken,
    };
};

const logoutUser = async (accessToken, refreshToken) => {

    try {
        // check access token is provided and blacklist it
        if (accessToken) {
            await blacklistToken(accessToken);
        }

        // check refresh token is provided and blacklist it
        if (refreshToken) {
            await blacklistToken(refreshToken);
        };

        //delete user sessions from db
        if (refreshToken) {
            const decoded = jwt.decode(refreshToken);
            const userId = decoded.userId;
            await deleteUserSessions(userId, refreshToken);
        }
        return;

    } catch (error) {
        console.error('Error during logout:', error);
        throw new Error('Logout failed');
    }
};

const refreshTokens = async (oldRefreshToken) => {
    try {
        // check if token is blacklisted
        const isBlacklisted = await redisClient.get(`bl_${oldRefreshToken}`);
        if (isBlacklisted) {

            //handle refresh token breach
            breachDetected(oldRefreshToken);

            // res client whit unauthorized error
            const error = new Error('Refresh token is blacklisted. Please log in again.');
            error.statusCode = 401; // Unauthorized
            throw error;
        }
        // verify old refresh token
        const { userId } = jwt.verify(oldRefreshToken, getConfig('jwtRefreshSecret'));

        // find user in db
        const user = await authRepository.findUserById(userId);

        //check if user still exists
        if (!user) {
            const error = new Error('User not found. Please log in again.');
            error.statusCode = 401; // Unauthorized
            throw error;
        };

        // sign new tokens
        const { accessToken, refreshToken } = signTokens(user);

        // replace old session in db with new tokens ---- this function return the old session----
        const oldSession = await replaceUserSession(user._id, oldRefreshToken, { refreshToken: refreshToken, accessToken: accessToken });

        // blacklist old refresh token and access token (access token for imidiate action)
        await blacklistToken(oldSession.refreshToken);
        await blacklistToken(oldSession.accessToken);

        // return new tokens
        return { accessToken, refreshToken };

    } catch (error) {
        const err = new Error('Could not refresh tokens. Please log in again.');
        err.statusCode = 401; // Unauthorized
        throw err;
    }
};

const getUserById = async (userId) => {
    const user = await authRepository.findUserById(userId);
    return user;
};

const addAddress = async(userId , address) =>{

   const newAddress = await authRepository.addAddress(userId , address);
   return newAddress;

}

const getAddressesByUserId = async(userId) => {
    const addresses = await authRepository.findAddressesByUserId(userId);
    return addresses || [];
}

const deleteAddress = async(userId , addressId) =>{

    const user = await authRepository.deleteAddress(userId,addressId);
    return user;

 }
    
const updateAddress = async(userId , addressId, updatedAddress) =>{
    const address = await authRepository.updateAddress(userId, addressId, updatedAddress);
    return address;
};

export default {
    registerNewUser,
    authenticateUser,
    logoutUser,
    refreshTokens,
    getUserById,
    addAddress,
    getAddressesByUserId,
    deleteAddress,
    updateAddress
};