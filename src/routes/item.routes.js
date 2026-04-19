const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const itemController = require('../controllers/item.controller');
const { protect, authorize } = require('../middleware/auth.middleware');
const { validate } = require('../middleware/validator.middleware');

router.post('/', [
  protect,
  authorize('ADMIN'),
  body('name').notEmpty().withMessage('Item name is required'),
  body('basePrice').isFloat({ min: 0 }).withMessage('Base price must be a positive number'),
  validate
], itemController.addItem);

router.get('/', protect, itemController.getItems);

// Update an item
router.put('/:id', [
  protect,
  authorize('ADMIN'),
  body('name').optional().notEmpty().withMessage('Item name cannot be empty'),
  body('basePrice').optional().isFloat({ min: 0 }).withMessage('Base price must be a positive number'),
  validate
], itemController.updateItem);

module.exports = router;