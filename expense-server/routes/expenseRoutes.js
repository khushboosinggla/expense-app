const express = require('express');
const expenseController = require('../controllers/expenseController');
const authMiddleware = require('../middlewares/authMiddleware');
const authorizeMiddleware = require('../middlewares/authorizeMiddleware');  

const router = express.Router();

router.use(authMiddleware.protect);

// Using existing permissions from your RBAC implementation
router.post('/add', authorizeMiddleware('group:update'), expenseController.addExpense);
router.get('/:groupId', authorizeMiddleware('group:view'), expenseController.getGroupExpenses);
router.get('/:groupId/summary', authorizeMiddleware('group:view'), expenseController.getGroupSummary);
router.post('/settle', authorizeMiddleware('group:update'), expenseController.settleGroup);

module.exports = router;