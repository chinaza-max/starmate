const express = require('express');
const router = express.Router();
const statisticsController = require('../controllers/statistics.controller');
const { protect, authorize } = require('../middleware/auth.middleware');

router.get('/admin', protect, authorize('ADMIN'), statisticsController.getAdminStatistics);
router.get('/staff', protect, authorize('STAFF'), statisticsController.getStaffStatistics);
router.get(
  '/all-staff',
  protect,
  authorize('ADMIN'),
  statisticsController.getAllStaff
);
module.exports = router;

