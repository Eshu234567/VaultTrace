const express = require('express');
const { Notification } = require('../models');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// GET /api/notifications — Current user's notifications + unread count
router.get('/', authenticate, async (req, res, next) => {
  try {
    const [notifications, unreadCount] = await Promise.all([
      Notification.find({ recipientId: req.user._id })
        .sort({ readAt: 1, createdAt: -1 })
        .limit(50)
        .lean(),
      Notification.countDocuments({ recipientId: req.user._id, readAt: null }),
    ]);

    return res.json({
      success: true,
      data: {
        unreadCount,
        notifications,
      },
    });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/notifications/:id/read — Mark a single notification as read
router.patch('/:id/read', authenticate, async (req, res, next) => {
  try {
    const notif = await Notification.findOneAndUpdate(
      { _id: req.params.id, recipientId: req.user._id },
      { $set: { readAt: new Date() } },
      { new: true }
    );
    if (!notif) {
      return res.status(404).json({ success: false, error: 'Notification not found.' });
    }
    return res.json({ success: true, data: notif });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/notifications/read-all — Mark all notifications as read
router.patch('/read-all', authenticate, async (req, res, next) => {
  try {
    await Notification.updateMany(
      { recipientId: req.user._id, readAt: null },
      { $set: { readAt: new Date() } }
    );
    return res.json({ success: true, message: 'All notifications marked as read.' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
