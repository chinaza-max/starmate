const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const staffController = require('../controllers/staff.controller');
const { protect, authorize } = require('../middleware/auth.middleware');
const { validate } = require('../middleware/validator.middleware');

router.put('/amount', [
  protect,
  authorize('ADMIN'),
  body('staffId').notEmpty().withMessage('Staff ID is required'),
  body('hourlyRate').isFloat({ min: 0 }).withMessage('Hourly rate must be a positive number'),
  validate
], staffController.updateStaffAmount);

router.get('/', protect, authorize('ADMIN'), staffController.getAllStaff);
router.get('/query', protect, authorize('ADMIN'), staffController.queryStaff);
router.get('/:id', protect, authorize('ADMIN'), staffController.getStaff);
router.post('/:id/profile-picture', protect, staffController.uploadProfilePicture);
router.get('/:id/profile-picture', staffController.getProfilePicture);
router.get(
  '/me/bookings',
  protect,
  staffController.getStaffBookings
);

router.get('/me/profile', protect, staffController.getMyProfile);
router.get('/me/stats', protect, staffController.getMyStats);
router.get(
  '/booking/:bookingId',
  protect,
  staffController.getStaffBookingDetails
);


router.get(
  '/me/bookings/status',
  protect,
  staffController.getStaffBookingsByStatus
);
module.exports = router;

