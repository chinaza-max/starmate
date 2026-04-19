const express = require('express');
const router = express.Router();
const quoteController = require('../controllers/quote.controller');
const { protect, authorize } = require('../middleware/auth.middleware');

//router.post('/', protect, authorize('ADMIN'), quoteController.createQuote);
router.post('/', protect, authorize('ADMIN'), quoteController.createQuote);
router.get('/', protect, quoteController.getQuotes);
router.get('/:id/pdf', protect, authorize('ADMIN'), quoteController.generateQuotePdf);
router.get('/my-quotes', protect, authorize('CLIENT'), quoteController.getClientQuotes);
router.post('/:id/send', protect, authorize('ADMIN'), quoteController.sendQuote);
router.patch('/:id/accept', protect, authorize('CLIENT'), quoteController.acceptQuote);
router.put('/:id', protect, authorize('ADMIN'), quoteController.updateQuote);
router.patch('/:id/status', protect, authorize('ADMIN'), quoteController.updateQuoteStatus);
module.exports = router;
