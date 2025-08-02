import Notification from "../models/notificationModel.js";

// 🆕 Get All Notifications with unread count and pagination
export const getAllNotificationsForUser = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const userId = req.user.id;
    const userRole = req.user.role;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const notifications = await Notification.find({
      userId,
      userRole,
    })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const totalUnread = await Notification.countDocuments({
      userId,
      userRole,
      status: "Unread",
    });

    const totalCount = await Notification.countDocuments({
      userId,
      userRole,
    });

    res.status(200).json({
      success: true,
      data: notifications,
      meta: {
        totalCount,
        unreadCount: totalUnread,
        currentPage: parseInt(page),
        perPage: parseInt(limit),
      },
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch notifications",
      error: err.message,
    });
  }
};

// 🟩 Get Notifications for Customer
export const getCustomerNotifications = async (req, res) => {
  const customerId = req.params.customerId;

  try {
    const notifications = await Notification.find({
      userId: customerId,
      userRole: "customer",
    }).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: notifications,
    });
  } catch (error) {
    console.error("Error fetching customer notifications:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch customer notifications",
      error: error.message,
    });
  }
};

// 🟩 Get Notifications for Agent
export const getAgentNotifications = async (req, res) => {
  const agentId = req.params.agentId;

  try {
    const notifications = await Notification.find({
      userId: agentId,
      userRole: "agent",
    }).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: notifications,
    });
  } catch (error) {
    console.error("Error fetching agent notifications:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch agent notifications",
      error: error.message,
    });
  }
};

// 🟩 Get Notifications for Admin
export const getAdminNotifications = async (req, res) => {
  const adminId = req.params.adminId;

  try {
    const notifications = await Notification.find({
      userId: adminId,
      userRole: "admin",
    }).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: notifications,
    });
  } catch (error) {
    console.error("Error fetching admin notifications:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch admin notifications",
      error: error.message,
    });
  }
};

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
    res.status(500).json({
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
    res.status(500).json({
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
    res.status(500).json({
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
