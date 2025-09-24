import sessionModel from '../models/sessionModel.js'

const getUserSessions = async (userId) => {
    const sessions = await sessionModel.find({ userId });
    return sessions || [];
};

// Function to delete specific sessions for a user 
const deleteUserSessions = async (userId, refreshToken) => {
  return await sessionModel.deleteOne({ userId, refreshToken });
};

// Function to delete all sessions for a user
const deleteUserAllSessions = async (userId) => {
    // Delete all sessions for the user
    await sessionModel.deleteMany({ userId });
    return;
};


// Function to replace an old session with a new one

const replaceUserSession = async (userId, oldRefreshToken, newSession) => {
    return await sessionModel.findOneAndUpdate(
    { userId, refreshToken: oldRefreshToken }, // Find the document to update
    { $set: newSession }, // Set the new data
  );

};

// add new session to user
const addUserSession = async (userId, session) => {
    await sessionModel.create({ userId, ...session});
    return;
};

export {
    getUserSessions,
    deleteUserSessions,
    deleteUserAllSessions,
    replaceUserSession,
    addUserSession
};

