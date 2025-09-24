import userModel from '../models/userModel.js';

// Function to check if a user already exists by username or email
const isUserExistWithCredientials = async (username, email) => {
    const user = await userModel.findOne({ $or: [{ username }, { 'contactInfo.email': email }]});    
    return !!user;
};

// Function to create and save a new user to the database
const createUser = async (userData) => {

    const { username, email, password } = userData;
    const newUser = userModel.create({
        username,
        contactInfo: { email },
        password,
    });
    return newUser;
};

//findUserById
const findUserById = async (userId) => {
    return await userModel.findById(userId);
};

// get user by email
const getUserByEmail = async (email) => {
    return await userModel.findOne({ 'contactInfo.email': email });
};

// get user by username
const getUserByUsername = async (username) => {
    return await userModel.findOne({ username });
};

// find user for login (by email or username) and include password field
export const findUserForLogin = async (identifier) => {

  const isEmail = identifier.includes('@');

  const query = isEmail 
    ? { 'contactInfo.email': identifier }
    : { username: identifier };

  // Chain .select('+password') to the query to retrieve the hidden password field
  const user = await userModel.findOne(query).select('+password');
  
  return user;
};

export default {
    isUserExistWithCredientials,
    createUser,
    findUserById,
    getUserByEmail,
    getUserByUsername,
    findUserForLogin,
};