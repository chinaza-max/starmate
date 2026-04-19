const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const deviceTokenController = require('../controllers/deviceToken.controller');
const { protect } = require('../middleware/auth.middleware');
const { validate } = require('../middleware/validator.middleware');

router.post('/', [
  protect,
  body('token').notEmpty().withMessage('Token is required'),
  body('platform').isIn(['IOS', 'ANDROID', 'WEB']).withMessage('Platform must be IOS, ANDROID, or WEB'),
  validate
], deviceTokenController.saveToken);

router.put('/', [
  protect,
  body('token').notEmpty().withMessage('Token is required'),
  validate
], deviceTokenController.updateToken);

router.delete('/:token', protect, deviceTokenController.deleteToken);
router.get('/', protect, deviceTokenController.getUserTokens);

module.exports = router;

