const groupDao = require("../dao/groupDao");
const userDao = require("../dao/userDao");
const Expense = require('../model/expense');
const Group = require('../model/group');
const mongoose = require('mongoose');

const groupController = {

    // src/controllers/groupController.js
    create: async (request, response) => {
        try {
            const user = request.user; // From your authMiddleware
            const { name, description, membersEmail, thumbnail } = request.body;
            const userInfo = await userDao.findByEmail(user.email);

            // Credit check logic...
            if (!userInfo.credits) {
                userInfo.credits = 1;
            }

            if (userInfo.credits == 0) {
                return response.status(400).json({
                    message: 'You do not have enough credits to perform this operation'
                });
            }

            // UPDATED: The creator is now explicitly added as 'admin'
            let memberObjects = [{ email: user.email.toLowerCase(), role: 'admin' }];

            if (membersEmail && Array.isArray(membersEmail)) {
                // Remove duplicates and exclude the creator
                const uniqueEmails = [...new Set(membersEmail)]
                    .map(e => e.toLowerCase())
                    .filter(e => e !== user.email.toLowerCase());

                const extraMembers = uniqueEmails.map(email => ({
                    email: email,
                    role: 'viewer' // Default role for newly invited members
                }));
                memberObjects = [...memberObjects, ...extraMembers];
            }

            // Maintain legacy array for search/compatibility
            let allMembersEmail = memberObjects.map(m => m.email);

            const newGroup = await groupDao.createGroup({
                name,
                description,
                adminEmail: user.email.toLowerCase(),
                adminId: user._id,
                members: memberObjects, // Array of objects with 'admin', 'manager', or 'viewer'
                membersEmail: allMembersEmail,
                thumbnail,
                paymentStatus: {
                    amount: 0,
                    currency: 'INR',
                    date: Date.now(),
                    isPaid: false,
                    isPendingApproval: false,
                    requestedBy: null
                }
            });

            userInfo.credits -= 1;
            await userInfo.save();

            response.status(201).json({
                message: 'Group created successfully',
                groupId: newGroup._id
            });
        } catch (error) {
            console.error("Group Create Error:", error);
            response.status(500).json({ message: "Internal server error" });
        }
    },

    update: async (request, response) => {
        try {
            const updatedGroup = await groupDao.updateGroup(request.body);
            if (!updatedGroup) {
                return response.status(404).json({ message: "Group not found" });
            }
            response.status(200).json(updatedGroup);
        } catch (error) {
            response.status(500).json({ message: "Error updating group" });
        }
    },

    deleteGroup: async (request, response) => {
        try {
            const { groupId } = request.params;
            const userId = request.user._id;

            const group = await Group.findById(groupId);

            if (!group) {
                return response.status(404).json({ message: "Group not found" });
            }

            // Authorization Check: Only the primary Admin (Owner) can delete the entire group
            if (group.adminId.toString() !== userId.toString()) {
                return response.status(403).json({ message: "Only the Group Owner can delete this group" });
            }

            // 1. Delete all expenses associated with this group first
            await Expense.deleteMany({ groupId: groupId });

            // 2. Delete the group itself
            await Group.findByIdAndDelete(groupId);

            response.status(200).json({ message: "Group and all associated expenses deleted successfully" });
        } catch (error) {
            console.error("Delete Group Error:", error);
            response.status(500).json({ message: "Error deleting group" });
        }
    },

    addMembers: async (request, response) => {
        try {
            const { groupId } = request.params;
            const { email, role } = request.body; // Aligned with your frontend ManageUsers.jsx

            const group = await Group.findById(groupId);
            if (!group) return response.status(404).json({ message: "Group not found" });

            // Create new member object based on assigned role
            const newMember = {
                email: email.toLowerCase(),
                role: role || 'viewer'
            };

            const updatedGroup = await Group.findByIdAndUpdate(
                groupId,
                {
                    $addToSet: {
                        members: newMember,
                        membersEmail: email.toLowerCase()
                    }
                },
                { new: true }
            );

            response.status(200).json(updatedGroup);
        } catch (error) {
            console.error("Add Member Error:", error);
            response.status(500).json({ message: "Error adding member" });
        }
    },

    // src/controllers/groupController.js

    updateMemberRole: async (request, response) => {
        try {
            const { groupId } = request.params;
            const { email, role } = request.body;
            const userId = request.user._id;

            const group = await Group.findById(groupId);
            if (!group) return response.status(404).json({ message: "Group not found" });

            if (group.adminId.toString() !== userId.toString()) {
                return response.status(403).json({ message: "Unauthorized" });
            }

            // 1. Remove the user if they exist as a string OR an object
            await Group.findByIdAndUpdate(groupId, {
                $pull: { members: { email: email.toLowerCase() } }
            });
            await Group.findByIdAndUpdate(groupId, {
                $pull: { members: email.toLowerCase() }
            });

            // 2. Add them back as a proper object with the new role
            const updatedGroup = await Group.findByIdAndUpdate(
                groupId,
                {
                    $addToSet: {
                        members: { email: email.toLowerCase(), role: role }
                    }
                },
                { new: true }
            );

            response.status(200).json({ message: `Success`, group: updatedGroup });
        } catch (error) {
            console.error(error);
            response.status(500).json({ message: "Error updating role" });
        }
    },

    removeMember: async (request, response) => {
        try {
            const { groupId } = request.params;
            const { email } = request.body;
            const userId = request.user._id;
            const userEmail = request.user.email;

            const group = await Group.findById(groupId);
            if (!group) return response.status(404).json({ message: "Group not found" });

            // Authorization Check: Admins or Managers can remove members
            const currentUser = group.members.find(m => m.email === userEmail);
            const isAuthorized = group.adminId.toString() === userId.toString() || currentUser?.role === 'manager';

            if (!isAuthorized) {
                return response.status(403).json({ message: "Unauthorized: Only admins or managers can remove members." });
            }

            // SAFETY CHECK: Prevent removing the owner
            if (email.toLowerCase() === group.adminEmail.toLowerCase()) {
                return response.status(400).json({ message: "The Group Owner cannot be removed." });
            }

            const updatedGroup = await Group.findByIdAndUpdate(
                groupId,
                {
                    $pull: {
                        members: { email: email.toLowerCase() },
                        membersEmail: email.toLowerCase()
                    }
                },
                { new: true }
            );

            response.status(200).json({ message: "Member removed", group: updatedGroup });
        } catch (error) {
            response.status(500).json({ message: "Error removing member" });
        }
    },

    removeMembers: async (request, response) => {
        try {
            const { groupId, emails } = request.body;
            const updatedGroup = await groupDao.removeMembers(groupId, ...emails);
            response.status(200).json(updatedGroup);
        } catch (error) {
            response.status(500).json({ message: "Error removing members" });
        }
    },

    getGroupsByUser: async (request, response) => {
        try {
            const { email, _id } = request.user;
            const adminId = _id;

            const page = parseInt(request.query.page) || 1;
            const limit = parseInt(request.query.limit) || 10;
            const skip = (page - 1) * limit;
            const sortBy = request.query.sortBy || 'newest';

            let sortOptions = { createdAt: -1 };
            if (sortBy === 'oldest') {
                sortOptions = { createdAt: 1 };
            }

            const { groups, totalCount } = await groupDao.getGroupsPaginated(
                email,
                adminId,
                limit,
                skip,
                sortOptions
            );

            response.status(200).json({
                groups: groups,
                pagination: {
                    totalItems: totalCount,
                    totalPages: Math.ceil(totalCount / limit),
                    currentPage: page,
                    itemsPerPage: limit
                }
            });
        } catch (error) {
            console.error(error);
            response.status(500).json({ message: "Error fetching groups" });
        }
    },

    getGroupsByPaymentStatus: async (request, response) => {
        try {
            const { isPaid } = request.query;
            const status = isPaid === 'true';
            const groups = await groupDao.getGroupByStatus(status);
            response.status(200).json(groups);
        } catch (error) {
            response.status(500).json({ message: "Error filtering groups" });
        }
    },

    getAudit: async (request, response) => {
        try {
            const { groupId } = request.params;
            const lastSettled = await groupDao.getAuditLog(groupId);
            response.status(200).json({ lastSettled });
        } catch (error) {
            response.status(500).json({ message: "Error fetching audit log" });
        }
    },

    updateBudgetGoal: async (request, response) => {
        try {
            const { groupId } = request.params;
            const { budgetGoal } = request.body;
            const userEmail = request.user.email;

            const group = await Group.findById(groupId);
            if (!group) return response.status(404).json({ message: "Group not found" });

            // 2. Real-time Role Check: Admin or Manager allowed
            const member = group.members.find(m => m.email === userEmail);
            const hasPermission =
                member?.role === 'admin' ||
                member?.role === 'manager' ||
                group.adminEmail === userEmail;

            if (!hasPermission) {
                return response.status(403).json({ message: "Unauthorized: Only admins and managers can set budgets" });
            }

            const updatedGroup = await Group.findByIdAndUpdate(
                groupId,
                { budgetGoal: Number(budgetGoal) },
                { new: true }
            );

            response.status(200).json({ message: "Budget updated", budgetGoal: updatedGroup.budgetGoal });
        } catch (error) {
            response.status(500).json({ message: "Server error updating budget" });
        }
    }
};

module.exports = groupController;