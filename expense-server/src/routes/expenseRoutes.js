const express = require('express');
const expenseController = require('../controllers/expenseController');
const authMiddleware = require('../middlewares/authMiddleware');
const authorizeMiddleware = require('../middlewares/authorizeMiddleware');

const router = express.Router();

router.use(authMiddleware.protect);

// Global stats (not group specific)
router.get('/dashboard-stats', authMiddleware.protect, expenseController.getDashboardStats);

// REVERTED: Routes now use simple paths; groupId is expected in the request body
router.post('/add', authorizeMiddleware('group:update'), expenseController.addExpense);
router.post('/reopen', authorizeMiddleware('group:update'), expenseController.reopenGroup);
router.post('/request-settle', authorizeMiddleware('group:view'), expenseController.requestSettlement);
router.post('/confirm-settle', authorizeMiddleware('group:update'), expenseController.confirmSettlement);

// KEPT: GET requests usually still need the ID in the URL for clean fetching
router.get('/:groupId', authorizeMiddleware('group:view'), expenseController.getGroupExpenses);
router.get('/:groupId/summary', authorizeMiddleware('group:view'), expenseController.getGroupSummary);

module.exports = router;