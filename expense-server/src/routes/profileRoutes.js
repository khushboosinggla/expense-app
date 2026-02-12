const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/authMiddleware');
const usersController = require('../controllers/profileController');

router.use(authMiddleware.protect);

// Current User profile routes
router.get('/get-user-info', usersController.getUserInfo);
router.put('/update', usersController.updateProfile);

// Admin Management routes (Used by ManageUsers.jsx)
router.get('/', usersController.getAllUsers); // GET /users/
router.post('/', usersController.createUser); // POST /users/
router.delete('/:id', usersController.deleteUser); // DELETE /users/:id

module.exports = router;