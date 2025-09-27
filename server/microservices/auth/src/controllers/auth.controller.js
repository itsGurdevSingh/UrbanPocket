import getConfig from '../config/config_keys.js';
import authService from '../services/authService.js';



const registerUser = async (req, res, next) => {
  try {
    const userData = req.body;

    const { user, accessToken, refreshToken } = await authService.registerNewUser(userData);

    res.cookie('accessToken', accessToken, {
      httpOnly: true,
      secure: getConfig('nodeEnv') === 'production',
      maxAge: 15 * 60 * 1000, // 15 minutes
    });

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: getConfig('nodeEnv') === 'production',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    res.status(201).json({
      message: 'User registered successfully',
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    // Pass error to the global error handler
    next(error);
  }
};

const loginUser = async (req, res, next) => {
  try {
    const { identifier, password } = req.body;


    const { user, accessToken, refreshToken } = await authService.authenticateUser({ identifier, password });
    res.cookie('accessToken', accessToken, {
      httpOnly: true,
      secure: getConfig('nodeEnv') === 'production',
      maxAge: 15 * 60 * 1000, // 15 minutes
    });
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: getConfig('nodeEnv') === 'production',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });
    res.status(200).json({
      message: 'Logged in successfully',
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {

    // remove cookies if any error occurs
    res.clearCookie('accessToken');
    res.clearCookie('refreshToken');

    // Pass error to the global error handler
    next(error);
  }
};

const logoutUser = async (req, res) => {


  // Get tokens from cookies  
  const accessToken = req.cookies?.accessToken;
  const refreshToken = req.cookies?.refreshToken;

  await authService.logoutUser(accessToken, refreshToken);


  // Clear cookies with correct options to match test expectations
  res.cookie('accessToken', '', { httpOnly: true, sameSite: 'strict', maxAge: 0, path: '/' });
  res.cookie('refreshToken', '', { httpOnly: true, sameSite: 'strict', maxAge: 0, path: '/' });

  // Send response
  res.status(200).json({ message: 'Logged out successfully' });
};

const refreshToken = async (req, res, next) => {
  try {
    const oldRefreshToken = req.cookies?.refreshToken;

    const { accessToken, refreshToken } = await authService.refreshTokens(oldRefreshToken);

    res.cookie('accessToken', accessToken, {
      httpOnly: true,
      secure: getConfig('nodeEnv') === 'production',
      maxAge: 15 * 60 * 1000, // 15 minutes
    });
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: getConfig('nodeEnv') === 'production',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });
    res.status(200).json({ message: 'Tokens refreshed successfully' });
  } catch (error) {
    // Clear cookies if refresh fails
    res.clearCookie('accessToken');
    res.clearCookie('refreshToken');
    next(error);
  }
};

const getUserProfile = async (req, res, next) => {
  try {
    const userId = req.user.id; // Assuming authenticateUser middleware sets req.user
    const user = await authService.getUserById(userId);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.status(200).json({
      user: {
        id: user._id,
        username: user.username,
        fullName: user.fullName,
        email: user.contactInfo.email,
        role: user.role
      }
    });
  } catch (error) {
    next(error);
  }
};

const getUserAddresses = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const addresses = await authService.getAddressesByUserId(userId);
    res.status(200).json({
      address: addresses || []
    });
  } catch (error) {
    next(error);
  }
};

const addAddress = async (req, res, next) => {
  try {
    const address = req.body;
    const userId = req.user.id;
    const newAddress = await authService.addAddress(userId, address)

    res.status(201).json({
      message: 'Address added successfully',
      address: newAddress
    })

  } catch (error) {
    next(error)
  }
}

const deleteAddress = async (req, res, next) => {
  try {
    const { addressId } = req.body;
    const userId = req.user.id;

    await authService.deleteAddress(userId, addressId);

    res.status(200).json({
      message: 'Address deleted successfully'
    });
  } catch (error) {
    next(error);
  } 
};

const updateAddress = async (req, res, next) => {
  try {
    const { addressId, addressData } = req.body;
    const userId = req.user.id;
    const updatedAddress = await authService.updateAddress(userId, addressId, addressData);
    res.status(200).json({
      message: 'Address updated successfully',
      address: updatedAddress
    });
  }
  catch (error) {
    next(error);
  }
};  


export {
  registerUser,
  loginUser,
  logoutUser,
  refreshToken,
  getUserProfile,
  getUserAddresses,
  addAddress,
  deleteAddress,
  updateAddress
};