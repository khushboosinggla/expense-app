const express = require('express');
const groupController = require('../controllers/groupController');
const authMiddleware = require('../middlewares/authMiddleware');
const authorizeMiddleware = require('../middlewares/authorizeMiddleware');

const router = express.Router();

router.use(authMiddleware.protect);

// REVERTED: General group actions
router.post('/create', authorizeMiddleware('group:create'), groupController.create);
router.put('/update', authorizeMiddleware('group:update'), groupController.update);
router.patch('/members/add', authorizeMiddleware('group:update'), groupController.addMembers);
router.patch('/members/remove', authorizeMiddleware('group:update'), groupController.removeMembers);

// User specific group list
router.get('/my-groups', authorizeMiddleware('group:view'), groupController.getGroupsByUser);
router.get('/status', authorizeMiddleware('group:view'), groupController.getGroupsByPaymentStatus);

// KEPT: Management routes that specifically target a group by ID
router.get('/:groupId/audit', authorizeMiddleware('group:view'), groupController.getAudit);
router.patch('/:groupId/budget', authMiddleware.protect, groupController.updateBudgetGoal);
router.patch('/:groupId/member-role', authMiddleware.protect, groupController.updateMemberRole);
router.post('/:groupId/remove-member', authMiddleware.protect, groupController.removeMember);
router.post('/:groupId/add-member', authMiddleware.protect, groupController.addMembers);

router.delete('/:groupId', authMiddleware.protect, groupController.deleteGroup);

module.exports = router;