import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import redisClient from '../db/redis.js';
import getConfig from '../config/config_keys.js';
import { getUserSessions, deleteUserAllSessions } from '../repositories/sessionRepository.js';



//sign access and refresh tokens
const signTokens = (user) => {
    // generate access token
    const accessToken = jwt.sign(
        { userId: user._id, username: user.username, email: user.contactInfo.email, role: user.role },
        getConfig('jwtSecret'),
        { expiresIn: '15m' } // Access token valid for 15 minutes
    );

    // generate refresh token
    const refreshToken = jwt.sign(
        { userId: user._id },
        getConfig('jwtRefreshSecret'),
        { expiresIn: '7d' } // Refresh token valid for 7 days
    );
    return { accessToken, refreshToken };
};

// helper to create a stable hash for a token (avoids storing raw tokens in Redis keys)
const tokenHash = (token) => {
    if (!token) return null;
    return crypto.createHash('sha256').update(token).digest('hex');
};

// util function to blacklist tokens
const blacklistToken = async (token) => {
    if (!token) return;

    // decode token safely
    const decoded = jwt.decode(token);
    if (!decoded || !decoded.exp) return; // can't determine expiration

    const tokenExp = decoded.exp;
    const expiresInSeconds = Math.floor(tokenExp - (Date.now() / 1000));

    // store a hash of the token in redis with expiration time
    if (expiresInSeconds > 0) {
        const key = tokenHash(token);
        if (key) {
            await redisClient.set(`bl_${key}`, 'true', 'EX', Math.floor(expiresInSeconds));
        }
    }

    return;
};

// if refresh token is compromised
const breachDetected = async (CompromisedrefreshToken) => {
    // decode compromised token to get user id
    const decoded = jwt.decode(CompromisedrefreshToken);
    const userId = decoded.userId;

    // fetch all active sessions for the user
    const sessions = await getUserSessions(userId);

    // blacklist all active tokens

    for (const session of sessions) {
        await blacklistToken(session.refreshToken);
        await blacklistToken(session.accessToken);
    }

    // delete all sessions from database
    await deleteUserAllSessions(userId);

    // Optionally, notify the user about the breach via email or other means
    // sendBreachNotification(userId);

};

export {
    signTokens,
    blacklistToken,
    breachDetected,
    tokenHash
};