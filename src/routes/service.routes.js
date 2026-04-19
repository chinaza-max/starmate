const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const serviceController = require('../controllers/service.controller');
const { protect, authorize } = require('../middleware/auth.middleware');
const { validate } = require('../middleware/validator.middleware');

router.post('/', [
  protect,
  authorize('ADMIN'),
  body('name').notEmpty().withMessage('Service name is required'),
  body('basePrice').isFloat({ min: 0 }).withMessage('Base price must be a positive number'),
  validate
], serviceController.createService);

router.get('/', protect, serviceController.getServices);
router.get('/:id', protect, serviceController.getService);
router.put('/:id', [
  protect,
  authorize('ADMIN'),
  body('basePrice').optional().isFloat({ min: 0 }).withMessage('Base price must be a positive number'),
  validate
], serviceController.updateService);
router.delete('/:id', protect, authorize('ADMIN'), serviceController.deleteService);

module.exports = router;

