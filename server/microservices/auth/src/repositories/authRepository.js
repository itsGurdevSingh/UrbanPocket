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

export default {
    isUserExistWithCredientials,
    createUser,
};