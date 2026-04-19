const express = require('express');
const router = express.Router();
const staffAvailabilityController = require('../controllers/staffAvailability.controller');
const { protect, authorize } = require('../middleware/auth.middleware');

router.get('/availability', protect, authorize('ADMIN'), staffAvailabilityController.getStaffAvailability);
router.get('/timeline/:staffId', protect, authorize('ADMIN'), staffAvailabilityController.getStaffTimeline);

module.exports = router;

