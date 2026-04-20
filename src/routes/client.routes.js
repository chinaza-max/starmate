const express = require('express');
const router = express.Router();
const clientController = require('../controllers/clientController');
const { authenticate, authorize } = require('../middleware/auth');
//const bookingController = require('../controllers/booking.controller');

router.get('/', authenticate, authorize('ADMIN'), clientController.getAll);

module.exports = router;