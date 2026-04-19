const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const customRequestController = require('../controllers/customRequest.controller');
const { protect, authorize } = require('../middleware/auth.middleware');
const { validate } = require('../middleware/validator.middleware');

router.post('/', [
  protect,
  authorize('CLIENT'),
  body('subject').notEmpty().withMessage('Subject is required'),
  body('message').notEmpty().withMessage('Message is required'),
  validate
], customRequestController.createRequest);

router.get('/', protect, customRequestController.getRequests);
router.get('/:id', protect, customRequestController.getRequest);
router.put('/:id', [
  protect,
  authorize('ADMIN'),
  body('status').optional().isIn(['PENDING', 'IN_PROGRESS', 'RESOLVED', 'CLOSED']),
  validate
], customRequestController.updateRequest);

module.exports = router;

