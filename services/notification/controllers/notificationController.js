import Notification from "../models/notificationModel.js";

// 1. Get all unread notifications for a user
export const getUnreadNotifications = async (req, res) => {
  try {
    const userId = req.user.id;

    const notifications = await Notification.find({
      userId,
      status: "Unread",
    }).sort({ createdAt: -1 });

    res.status(200).json({ success: true, data: notifications });
  } catch (err) {
    res
      .status(500)
      .json({
        success: false,
        message: "Error fetching notifications",
        error: err.message,
      });
  }
};

// 2. Mark a notification as read
export const markAsRead = async (req, res) => {
  try {
    const { id } = req.params;

    const notification = await Notification.findByIdAndUpdate(
      id,
      { status: "Read", readAt: new Date() },
      { new: true }
    );

    if (!notification) {
      return res
        .status(404)
        .json({ success: false, message: "Notification not found" });
    }

    res.status(200).json({ success: true, data: notification });
  } catch (err) {
    res
      .status(500)
      .json({
        success: false,
        message: "Error updating notification",
        error: err.message,
      });
  }
};

// 3. Clear all notifications (mark all as Read)
export const clearAllNotifications = async (req, res) => {
  try {
    const userId = req.user.id;

    await Notification.updateMany(
      { userId, status: "Unread" },
      { $set: { status: "Read", readAt: new Date() } }
    );

    res
      .status(200)
      .json({ success: true, message: "All notifications marked as read" });
  } catch (err) {
    res
      .status(500)
      .json({
        success: false,
        message: "Error clearing notifications",
        error: err.message,
      });
  }
};

// 4. Utility: Create a notification
export const createNotification = async ({
  userId,
  userRole,
  title,
  message,
  type,
  referenceId,
  referenceType,
}) => {
  try {
    const notification = await Notification.create({
      userId,
      userRole,
      title,
      message,
      type,
      referenceId,
      referenceType,
    });

    return notification;
  } catch (err) {
    console.error("Notification creation error:", err);
  }
};
