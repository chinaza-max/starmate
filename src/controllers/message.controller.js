const { Message, User, Client } = require('../models');
const { sendPushNotificationToUser } = require('../services/pushNotification.service');
const { DeviceToken } = require('../models');
const { Op } = require('sequelize');

exports.sendMessage = async (req, res) => {
  try {
    const { receiverId, message, messageType } = req.body;
    const senderId = req.user.id;

    // If client, ensure they can only message admin
    if (req.user.role === 'CLIENT') {
      const admin = await User.findOne({ where: { role: 'ADMIN' } });
      if (!admin) {
        return res.status(404).json({ success: false, message: 'Admin not found' });
      }
      // Force receiver to be admin for client messages
      const actualReceiverId = admin.id;
      
      const newMessage = await Message.create({
        senderId,
        receiverId: actualReceiverId,
        message,
        messageType: messageType || 'COMPLAINT',
        isRead: false
      });

      // Send push notification to admin
      await sendPushNotificationToUser(
        actualReceiverId,
        'New Message from Client',
        message.substring(0, 100),
        { type: 'MESSAGE', messageId: newMessage.id },
        DeviceToken
      );

      const fullMessage = await Message.findByPk(newMessage.id, {
        include: [
          { model: User, as: 'sender', attributes: ['id', 'firstName', 'lastName', 'email'] },
          { model: User, as: 'receiver', attributes: ['id', 'firstName', 'lastName', 'email'] }
        ]
      });

      res.status(201).json({
        success: true,
        message: 'Message sent successfully',
        data: fullMessage
      });
    } else if (req.user.role === 'ADMIN') {
      // Admin can reply to any user
      const newMessage = await Message.create({
        senderId,
        receiverId,
        message,
        messageType: messageType || 'REPLY',
        isRead: false
      });

      // Send push notification to receiver
      await sendPushNotificationToUser(
        receiverId,
        'New Message from Admin',
        message.substring(0, 100),
        { type: 'MESSAGE', messageId: newMessage.id },
        DeviceToken
      );

      const fullMessage = await Message.findByPk(newMessage.id, {
        include: [
          { model: User, as: 'sender', attributes: ['id', 'firstName', 'lastName', 'email'] },
          { model: User, as: 'receiver', attributes: ['id', 'firstName', 'lastName', 'email'] }
        ]
      });

      res.status(201).json({
        success: true,
        message: 'Message sent successfully',
        data: fullMessage
      });
    } else {
      return res.status(403).json({ success: false, message: 'Not authorized to send messages' });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getMessages = async (req, res) => {
  try {
    const userId = req.user.id;
    const { conversationWith } = req.query;

    let where = {};

    if (req.user.role === 'CLIENT') {
      // Client sees messages with admin
      const admin = await User.findOne({ where: { role: 'ADMIN' } });
      if (admin) {
        where = {
          [Op.or]: [
            { senderId: userId, receiverId: admin.id },
            { senderId: admin.id, receiverId: userId }
          ]
        };
      }
    } else if (req.user.role === 'ADMIN') {
      if (conversationWith) {
        // Get conversation with specific user
        where = {
          [Op.or]: [
            { senderId: userId, receiverId: conversationWith },
            { senderId: conversationWith, receiverId: userId }
          ]
        };
      } else {
        // Get all messages where admin is sender or receiver
        where = {
          [Op.or]: [
            { senderId: userId },
            { receiverId: userId }
          ]
        };
      }
    } else {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    const messages = await Message.findAll({
      where,
      include: [
        { model: User, as: 'sender', attributes: ['id', 'firstName', 'lastName', 'email', 'role'] },
        { model: User, as: 'receiver', attributes: ['id', 'firstName', 'lastName', 'email', 'role'] }
      ],
      order: [['createdAt', 'ASC']]
    });

    res.json({
      success: true,
      data: messages
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getConversations = async (req, res) => {
  try {
    if (req.user.role !== 'ADMIN') {
      return res.status(403).json({ success: false, message: 'Only admin can view conversations list' });
    }

    // Get unique users that admin has conversations with
    const messages = await Message.findAll({
      where: {
        [Op.or]: [
          { senderId: req.user.id },
          { receiverId: req.user.id }
        ]
      },
      include: [
        { model: User, as: 'sender', attributes: ['id', 'firstName', 'lastName', 'email', 'role'] },
        { model: User, as: 'receiver', attributes: ['id', 'firstName', 'lastName', 'email', 'role'] }
      ],
      order: [['createdAt', 'DESC']]
    });

    // Group by conversation partner
    const conversations = {};
    messages.forEach(msg => {
      const partnerId = msg.senderId === req.user.id ? msg.receiverId : msg.senderId;
      if (!conversations[partnerId]) {
        conversations[partnerId] = {
          user: msg.senderId === req.user.id ? msg.receiver : msg.sender,
          lastMessage: msg,
          unreadCount: 0
        };
      }
      if (!msg.isRead && msg.receiverId === req.user.id) {
        conversations[partnerId].unreadCount++;
      }
    });

    res.json({
      success: true,
      data: Object.values(conversations)
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.markAsRead = async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.user.id;

    const message = await Message.findByPk(messageId);

    if (!message) {
      return res.status(404).json({ success: false, message: 'Message not found' });
    }

    if (message.receiverId !== userId) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    message.isRead = true;
    await message.save();

    res.json({
      success: true,
      message: 'Message marked as read',
      data: message
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

