const express = require('express');                     
const router = express.Router();    
const authMiddleware = require('../middlewares/authMiddleware');
const authorizeMiddleware = require('../middlewares/authorizeMiddleware');
const paymentsController = require('../controllers/paymentsController');

// we need raw request data to order to reconstruct the signature
router.post('/webhook', express.raw({ type: 'application/json' }), paymentsController.handleWebhookEvents);


router.use(authMiddleware.protect);  // Apply auth middleware to all routes in this router
router.post('/create-order', authorizeMiddleware('payment:create'), paymentsController.createOrder);
router.post('/verify-order', authorizeMiddleware('payment:create'), paymentsController.verifyOrder);
router.post('/create-subscription', authorizeMiddleware('payment:create'), paymentsController.createSubscription);
router.post('/capture-subscription', authorizeMiddleware('payment:create'), paymentsController.captureSubscription);

module.exports = router;