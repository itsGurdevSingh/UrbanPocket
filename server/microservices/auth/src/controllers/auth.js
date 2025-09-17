import getConfig from '../config/config_keys.js';
import authService from '../services/authService.js';


const registerUser = async (req, res, next) => {
  try {
    const { username, email, password } = req.body;

    const {user, token} = await authService.registerNewUser({ username, email, password });

    res.cookie('token', token, {
      httpOnly: true,
      secure: getConfig('nodeEnv') === 'production',
    }
    )
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
export {
     registerUser
    };