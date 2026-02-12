const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/authMiddleware');
const authorizeMiddleware = require('../middlewares/authorizeMiddleware');
const paymentsController = require('../controllers/paymentsController');

// NEW: Webhook Route (Public access for Razorpay)
// We use express.raw to ensure we get the buffer for signature verification
router.post('/webhook', express.raw({ type: 'application/json' }), paymentsController.handleWebhookEvents);

// Protect all following routes
router.use(authMiddleware.protect);

// Existing Routes
router.post('/create-order', authorizeMiddleware('payment:create'), paymentsController.createOrder);
router.post('/verify-order', authorizeMiddleware('payment:create'), paymentsController.verifyOrder);

// NEW: Subscription Routes
router.post('/create-subscription', authorizeMiddleware('payment:create'), paymentsController.createSubscription);
router.post('/capture-subscription', authorizeMiddleware('payment:create'), paymentsController.captureSubscription);

module.exports = router;