const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const invoiceController = require('../controllers/invoice.controller');
const { protect } = require('../middleware/auth.middleware');
const { validate } = require('../middleware/validator.middleware');

router.post('/', [
  protect,
  body('bookingId').notEmpty().withMessage('Booking ID is required'),
  body('amountDue').optional().isFloat({ min: 0 }),
  validate
], invoiceController.createInvoice);

router.get('/', protect, invoiceController.getInvoices);
router.get('/:id', protect, invoiceController.getInvoice);
router.get('/:id/download', protect, invoiceController.downloadInvoicePDF);
router.post('/:id/send-email', protect, invoiceController.sendInvoiceEmail);

module.exports = router;

