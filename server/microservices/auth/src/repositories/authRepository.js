import userModel from '../models/userModel.js';

// Function to check if a user already exists by username or email
const isUserExistWithCredientials = async (username, email) => {
  const user = await userModel.findOne({ $or: [{ username }, { 'contactInfo.email': email }] });
  return !!user;
};

// Function to create and save a new user to the database
const createUser = async (userData) => {

  const { username, email, password, ...optionalFields } = userData;
  const newUser = userModel.create({
    username,
    contactInfo: { email },
    password,
    ...optionalFields,
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

const addAddress = async (userId, address) => {

  const updatedUser = await userModel.findByIdAndUpdate(
    userId,
    { $push: { addresses: address } },
    { new: true }
  );

  if (!updatedUser) {
    const error = new Error("User not found");
    error.statusCode = 404;
    throw error;
  }

  // return only the last added address
  return updatedUser.addresses[updatedUser.addresses.length - 1];
};

const findAddressesByUserId = async (userId) => {
  const user = await userModel.findById(userId);
  if (!user) {

    const error = new Error("User not found");
    error.statusCode = 404;
    throw error;

  }

  return user ? user.addresses : [];
}

const deleteAddress = async (userId, addressId) => {
  const user = await userModel.findById(userId);

  if (!user) {
    const error = new Error('User not found');
    error.statusCode = 404;
    throw error;
  }

  const address = user.addresses.id(addressId);
  if (!address) {
    const error = new Error('Address not found');
    error.statusCode = 404;
    throw error;
  }

  // Remove the address by filtering and save
  const removedAddress = user.addresses.find(a => a._id.toString() === addressId);
  user.addresses = user.addresses.filter(a => a._id.toString() !== addressId);
  await user.save();

  return removedAddress; // return removed address
};

const updateAddress = async (userId, addressId, newAddressData) => {
  const user = await userModel.findById(userId);
  if (!user) {
    throw new Error("User not found");
  }

  const address = user.addresses.id(addressId);
  if (!address) {
    const error = new Error("Address not found");
    error.statusCode = 404;
    throw error;
  }

  // Replace fields (without touching _id)
  address.set(newAddressData);

  await user.save();
  return address;
};

export default {
  isUserExistWithCredientials,
  createUser,
  findUserById,
  getUserByEmail,
  getUserByUsername,
  findUserForLogin,
  addAddress,
  findAddressesByUserId,
  deleteAddress,
  updateAddress
};