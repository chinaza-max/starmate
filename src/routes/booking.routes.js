const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const bookingController = require('../controllers/booking.controller');
const { protect, authorize } = require('../middleware/auth.middleware');
const { validate } = require('../middleware/validator.middleware');

router.post('/convert', protect, authorize('ADMIN'), bookingController.convertToBooking);

router.post(
  '/create',
  protect,
  authorize('ADMIN'),
  bookingController.createBooking
);

router.put(
  '/:bookingId/schedules',
  protect,
  authorize('ADMIN'),
  bookingController.updateBookingSchedules
);

router.get('/', protect, bookingController.getBookings);
router.get(
  '/with-schedules',
  protect,
  authorize('ADMIN'),
  bookingController.getBookingsWithSchedules
);
router.get('/history', protect, bookingController.getBookingHistory);

router.post('/:bookingId/tasks', [
  protect,
  authorize('ADMIN'),
  body('title').notEmpty().withMessage('Title is required'),
  validate
], bookingController.addTaskToBooking);

router.post('/tasks/:taskId/assign-staff', [
  protect,
  authorize('ADMIN'),
  body('staffId').notEmpty().withMessage('Staff ID is required'),
  validate
], bookingController.assignStaffToTask);

router.delete('/:bookingId/staff/:staffId', protect, authorize('ADMIN'), bookingController.removeStaffFromBooking);

router.get(
  '/calendar',
  protect,
  bookingController.getCalendarData
);
router.get('/stats',  protect, authorize('ADMIN'), bookingController.getDashboardStats);

router.get("/:id", bookingController.getBooking);

router.patch(
  '/:id/status',
  protect,
  authorize('ADMIN'),
  body('status').notEmpty().withMessage('Status is required'),
  validate,
  bookingController.updateBookingStatus
);

module.exports = router;
