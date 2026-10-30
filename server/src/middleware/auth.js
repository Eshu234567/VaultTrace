const jwt = require('jsonwebtoken');
const { User } = require('../models');

const JWT_SECRET = process.env.JWT_SECRET || 'vaulttrace-super-secret-jwt-key-change-in-production';

async function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required. Please sign in or select a role from the Demo Switcher.',
      });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);

    let user = await User.findById(decoded.id);
    // If the in-memory database restarted and generated new _ids, seamlessly resolve by email or fallback to default campus user
    if ((!user || !user.isActive) && decoded.email) {
      user = await User.findOne({ email: decoded.email.toLowerCase(), isActive: true });
    }
    if (!user || !user.isActive) {
      user = await User.findOne({ email: 'student@vaulttrace.edu', isActive: true });
    }
    if (!user || !user.isActive) {
      return res.status(401).json({
        success: false,
        error: 'User session is invalid or account is deactivated.',
      });
    }

    req.user = {
      _id: user._id,
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      role: user.role,
      department: user.department,
      identifierCode: user.identifierCode,
    };

    next();
  } catch (err) {
    return res.status(401).json({
      success: false,
      error: 'Invalid or expired authentication token.',
    });
  }
}

function authorizeRoles(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required.',
      });
    }
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: `Access denied. Role '${req.user.role}' is not authorized. Required: [${allowedRoles.join(', ')}]`,
      });
    }
    next();
  };
}

function signToken(user) {
  return jwt.sign(
    {
      id: user._id.toString(),
      role: user.role,
      email: user.email,
    },
    JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}

module.exports = {
  authenticate,
  authorizeRoles,
  signToken,
};
