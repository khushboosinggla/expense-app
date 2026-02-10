const express = require('express');                     
const router = express.Router();    
const authMiddleware = require('../middlewares/authMiddleware');
const authorizedMiddleware = require('../middlewares/authorizedMiddleware');
const paymentsController = require('../controllers/paymentsController');


router.use(authMiddleware.protect);  // Apply auth middleware to all routes in this router

router.post('/create-order', authorizedMiddleware('payment:create'), paymentsController.createOrder);
router.post('/verify-order', authorizedMiddleware('payment:create'), paymentsController.verifyOrder);

module.exports = router;