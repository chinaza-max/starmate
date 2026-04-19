const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const authController = require('../controllers/auth.controller');
const { protect } = require('../middleware/auth.middleware');
const { validate } = require('../middleware/validator.middleware');

router.post('/register', [
  body('firstName').notEmpty(),
  body('lastName').notEmpty(),
  body('email').isEmail(),
  body('password').isLength({ min: 6 }),
  body('role').isIn(['ADMIN', 'CLIENT', 'STAFF']),
  validate
], authController.register);

router.post('/login', [
  body('email').isEmail(),
  body('password').exists(),
  validate
], authController.login);

router.get('/me', protect, authController.getMe);
router.post('/send-otp', [
  body('email').isEmail(),
  validate
], authController.sendOTP);
router.post('/verify-otp', [
  body('email').isEmail(),
  body('otp').notEmpty().withMessage('OTP is required'),
  validate
], authController.verifyOTP);

module.exports = router;
