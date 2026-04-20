const express = require('express');
const router = express.Router();
const clientController = require('../controllers/clientController');
const { protect, authorize } = require('../middleware/auth.middleware');

router.get('/', protect, authorize('ADMIN'), clientController.getAll);

module.exports = router;