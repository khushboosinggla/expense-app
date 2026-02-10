const express = require('express');                     
const router = express.Router();    
const usersController = require('../controllers/profileController');
const authMIddleware = require('../middleware/authMiddleware');


router.use(authMiddleware.protect);  // Apply auth middleware to all routes in this router

router.get('/get-user-info', usersController.getUserInfo);

module.exports = router;