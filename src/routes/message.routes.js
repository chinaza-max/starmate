const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const messageController = require('../controllers/message.controller');
const { protect, authorize } = require('../middleware/auth.middleware');
const { validate } = require('../middleware/validator.middleware');

router.post('/', [
  protect,
  authorize('CLIENT', 'ADMIN'),
  body('receiverId').optional().isUUID().withMessage('Receiver ID must be a valid UUID'),
  body('message').notEmpty().withMessage('Message is required'),
  body('messageType').optional().isIn(['COMPLAINT', 'INQUIRY', 'GENERAL', 'REPLY']),
  validate
], messageController.sendMessage);

router.get('/', protect, messageController.getMessages);
router.get('/conversations', protect, authorize('ADMIN'), messageController.getConversations);
router.put('/:messageId/read', protect, messageController.markAsRead);

module.exports = router;

