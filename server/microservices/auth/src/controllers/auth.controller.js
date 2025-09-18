import getConfig from '../config/config_keys.js';
import authService from '../services/authService.js';


const registerUser = async (req, res, next) => {
  try {
    const { username, email, password } = req.body;

    const { user, accessToken, refreshToken } = await authService.registerNewUser({ username, email, password });

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
      }
    });
  } catch (error) {
    // Pass error to the global error handler
    next(error);
  }
};

const loginUser = async (req, res, next) => {
  try {
    const { identifier , password } = req.body;

    
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







export {
  registerUser,
  loginUser
};