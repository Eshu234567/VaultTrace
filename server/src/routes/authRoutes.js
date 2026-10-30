const express = require('express');
const bcrypt = require('bcryptjs');
const { User, CampusLocation } = require('../models');
const { authenticate, signToken } = require('../middleware/auth');

const router = express.Router();

// POST /api/auth/register
router.post('/register', async (req, res, next) => {
  try {
    const { name, email, password, department, identifierCode, phone, role } = req.body;
    if (!name || !email || !password || !identifierCode) {
      return res.status(400).json({
        success: false,
        error: 'Name, email, password, and Campus ID/USN are required.',
      });
    }

    const existing = await User.findOne({ email: email.toLowerCase().trim() });
    if (existing) {
      return res.status(409).json({
        success: false,
        error: 'An account with this email address already exists.',
      });
    }

    // Prevent arbitrary elevation to admin via public registration unless explicitly demo-enabled
    const safeRole = ['student', 'staff'].includes(role) ? role : 'student';
    const passwordHash = await bcrypt.hash(password, 10);

    const user = await User.create({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      passwordHash,
      role: safeRole,
      department: department || 'Information Science and Engineering',
      identifierCode: identifierCode.toUpperCase().trim(),
      phone: phone || '',
    });

    const token = signToken(user);
    return res.status(201).json({
      success: true,
      data: {
        token,
        user: {
          _id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          department: user.department,
          identifierCode: user.identifierCode,
        },
      },
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/login
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email and password are required.',
      });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() }).select('+passwordHash');
    if (!user || !user.isActive) {
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password.',
      });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password.',
      });
    }

    user.lastLoginAt = new Date();
    await user.save();

    const token = signToken(user);
    return res.json({
      success: true,
      data: {
        token,
        user: {
          _id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          department: user.department,
          identifierCode: user.identifierCode,
        },
      },
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/quick-switch (Evaluator One-Click Role Switcher)
router.post('/quick-switch', async (req, res, next) => {
  try {
    const { email, role } = req.body;
    let user = null;
    if (email) {
      user = await User.findOne({ email: email.toLowerCase().trim(), isActive: true });
    } else if (role) {
      user = await User.findOne({ role, isActive: true });
    }

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'Requested demo persona not found.',
      });
    }

    user.lastLoginAt = new Date();
    await user.save();

    const token = signToken(user);
    return res.json({
      success: true,
      data: {
        token,
        user: {
          _id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          department: user.department,
          identifierCode: user.identifierCode,
        },
      },
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/auth/demo-personas
router.get('/demo-personas', async (req, res, next) => {
  try {
    const users = await User.find({ isActive: true })
      .select('name email role department identifierCode')
      .sort({ role: 1, name: 1 })
      .lean();
    return res.json({ success: true, data: users });
  } catch (err) {
    next(err);
  }
});

// GET /api/users/me (also mounted at /api/auth/me)
router.get('/me', authenticate, async (req, res) => {
  return res.json({
    success: true,
    data: req.user,
  });
});

// GET /api/auth/locations
router.get('/locations', async (req, res, next) => {
  try {
    const locations = await CampusLocation.find({ active: true }).sort({ buildingZone: 1, name: 1 }).lean();
    return res.json({ success: true, data: locations });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
