const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const { User, Message, DeviceToken } = require('../models');
const { sendPushNotificationToUser } = require('./pushNotification.service');

let io;

const initializeSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });

  // Authentication middleware for Socket.IO
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.split(' ')[1];
      
      if (!token) {
        return next(new Error('Authentication error: No token provided'));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findByPk(decoded.id, {
        attributes: { exclude: ['password'] }
      });

      if (!user) {
        return next(new Error('Authentication error: User not found'));
      }

      socket.userId = user.id;
      socket.userRole = user.role;
      socket.user = user;
      next();
    } catch (error) {
      next(new Error('Authentication error: Invalid token'));
    }
  });

  io.on('connection', async (socket) => {
    console.log(`User connected: ${socket.userId} (${socket.userRole})`);

    // Join user's personal room
    socket.join(`user_${socket.userId}`);

    // If admin, join admin room
    if (socket.userRole === 'ADMIN') {
      socket.join('admin_room');
    }

    // If client, join client room
    if (socket.userRole === 'CLIENT') {
      socket.join('client_room');
    }

    // Handle sending messages
    socket.on('send_message', async (data) => {
      try {
        const { receiverId, message, messageType } = data;

        let actualReceiverId = receiverId;

        // If client, ensure they can only message admin
        if (socket.userRole === 'CLIENT') {
          const admin = await User.findOne({ where: { role: 'ADMIN' } });
          if (!admin) {
            socket.emit('error', { message: 'Admin not found' });
            return;
          }
          actualReceiverId = admin.id;
        }

        // Create message in database
        const newMessage = await Message.create({
          senderId: socket.userId,
          receiverId: actualReceiverId,
          message,
          messageType: messageType || (socket.userRole === 'CLIENT' ? 'COMPLAINT' : 'REPLY'),
          isRead: false
        });

        // Fetch full message with user details
        const fullMessage = await Message.findByPk(newMessage.id, {
          include: [
            { model: User, as: 'sender', attributes: ['id', 'firstName', 'lastName', 'email', 'role'] },
            { model: User, as: 'receiver', attributes: ['id', 'firstName', 'lastName', 'email', 'role'] }
          ]
        });

        // Emit to receiver
        io.to(`user_${actualReceiverId}`).emit('new_message', fullMessage);

        // Emit confirmation to sender
        socket.emit('message_sent', fullMessage);

        // Send push notification to receiver if not online
        const receiverSockets = await io.in(`user_${actualReceiverId}`).fetchSockets();
        if (receiverSockets.length === 0) {
          await sendPushNotificationToUser(
            actualReceiverId,
            socket.userRole === 'CLIENT' ? 'New Message from Client' : 'New Message from Admin',
            message.substring(0, 100),
            { type: 'MESSAGE', messageId: newMessage.id },
            DeviceToken
          );
        }
      } catch (error) {
        console.error('Error sending message:', error);
        socket.emit('error', { message: error.message });
      }
    });

    // Handle typing indicator
    socket.on('typing', (data) => {
      const { receiverId } = data;
      let actualReceiverId = receiverId;

      if (socket.userRole === 'CLIENT') {
        // Client always types to admin
        User.findOne({ where: { role: 'ADMIN' } }).then(admin => {
          if (admin) {
            socket.to(`user_${admin.id}`).emit('user_typing', {
              userId: socket.userId,
              userName: `${socket.user.firstName} ${socket.user.lastName}`
            });
          }
        });
      } else {
        socket.to(`user_${actualReceiverId}`).emit('user_typing', {
          userId: socket.userId,
          userName: `${socket.user.firstName} ${socket.user.lastName}`
        });
      }
    });

    // Handle stop typing
    socket.on('stop_typing', (data) => {
      const { receiverId } = data;
      let actualReceiverId = receiverId;

      if (socket.userRole === 'CLIENT') {
        User.findOne({ where: { role: 'ADMIN' } }).then(admin => {
          if (admin) {
            socket.to(`user_${admin.id}`).emit('user_stop_typing', {
              userId: socket.userId
            });
          }
        });
      } else {
        socket.to(`user_${actualReceiverId}`).emit('user_stop_typing', {
          userId: socket.userId
        });
      }
    });

    // Handle mark message as read
    socket.on('mark_read', async (data) => {
      try {
        const { messageId } = data;
        const message = await Message.findByPk(messageId);

        if (!message || message.receiverId !== socket.userId) {
          socket.emit('error', { message: 'Message not found or unauthorized' });
          return;
        }

        message.isRead = true;
        await message.save();

        // Notify sender that message was read
        io.to(`user_${message.senderId}`).emit('message_read', {
          messageId: message.id,
          readAt: message.updatedAt
        });
      } catch (error) {
        console.error('Error marking message as read:', error);
        socket.emit('error', { message: error.message });
      }
    });

    // Handle disconnect
    socket.on('disconnect', () => {
      console.log(`User disconnected: ${socket.userId}`);
    });
  });

  return io;
};

const getIO = () => {
  if (!io) {
    throw new Error('Socket.IO not initialized');
  }
  return io;
};

module.exports = {
  initializeSocket,
  getIO
};



