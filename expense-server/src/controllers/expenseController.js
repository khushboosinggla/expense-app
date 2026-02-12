const mongoose = require('mongoose');
const Expense = require('../model/expense');
const Group = require('../model/group');
const User = require('../model/users'); // Ensure this matches your filename in /model/

const expenseController = {
    // src/controllers/expenseController.js

    addExpense: async (request, response) => {
        try {
            const { groupId, description, amount, payerEmail, splits } = request.body;
            const userEmail = request.user.email;

            const group = await Group.findById(groupId);
            if (!group) return response.status(404).json({ message: "Group not found" });

            // HYBRID CHECK: Handle both old string arrays and new object arrays
            const member = group.members.find(m =>
                (typeof m === 'string' ? m : m.email) === userEmail
            );

            // Resolve the role safely
            const userRole = typeof member === 'object' ? member.role : 'viewer';

            const canAddExpense =
                userRole === 'admin' ||
                userRole === 'manager' ||
                group.adminEmail === userEmail;

            if (!canAddExpense) {
                return response.status(403).json({ message: "Access Denied: You do not have permission to add expenses." });
            }

            const newExpense = new Expense({
                groupId,
                description,
                amount,
                payerEmail,
                splits,
                date: new Date()
            });

            await newExpense.save();
            response.status(201).json(newExpense);
        } catch (error) {
            console.error("Add Expense Error:", error);
            response.status(500).json({ message: "Internal Server Error: Check member data format" });
        }
    },

    getGroupExpenses: async (request, response) => {
        try {
            const { groupId } = request.params;
            const expenses = await Expense.find({ groupId }).sort({ date: -1 });

            // ENRICHMENT: Fetch names for Recent Activity
            const payerEmails = [...new Set(expenses.map(exp => exp.payerEmail))];
            const users = await User.find({ email: { $in: payerEmails } }, 'name email');

            const enrichedExpenses = expenses.map(expense => {
                const user = users.find(u => u.email === expense.payerEmail);
                return {
                    ...expense.toObject(),
                    payerName: user ? user.name : expense.payerEmail.split('@')[0]
                };
            });

            response.status(200).json(enrichedExpenses);
        } catch (error) {
            console.error("Fetch Expenses Error:", error);
            response.status(500).json({ message: "Error fetching expenses" });
        }
    },

    getGroupSummary: async (request, response) => {
        try {
            const { groupId } = request.params;
            const expenses = await Expense.find({ groupId, isSettled: false });

            let emailBalances = {};
            expenses.forEach(expense => {
                if (!emailBalances[expense.payerEmail]) emailBalances[expense.payerEmail] = 0;
                emailBalances[expense.payerEmail] += expense.amount;

                expense.splits.forEach(split => {
                    if (!emailBalances[split.email]) emailBalances[split.email] = 0;
                    emailBalances[split.email] -= split.amount;
                });
            });

            // ENRICHMENT: Fetch names for Net Balances
            const emails = Object.keys(emailBalances);
            const users = await User.find({ email: { $in: emails } }, 'name email');

            const balances = {};
            emails.forEach(email => {
                const userData = users.find(u => u.email === email);
                balances[email] = {
                    amount: emailBalances[email],
                    name: userData ? userData.name : email.split('@')[0]
                };
            });

            response.status(200).json({ balances });
        } catch (error) {
            console.error("Summary Error:", error);
            response.status(500).json({ message: "Error calculating summary" });
        }
    },

    settleGroup: async (request, response) => {
        try {
            const { groupId } = request.body;

            await Expense.updateMany(
                { groupId: groupId, isSettled: false },
                { $set: { isSettled: true } }
            );

            await Group.findByIdAndUpdate(groupId, {
                paymentStatus: {
                    amount: 0,
                    currency: 'INR',
                    date: Date.now(),
                    isPaid: true
                }
            });

            response.status(200).json({ message: "Group settled successfully" });
        } catch (error) {
            response.status(500).json({ message: "Error settling group" });
        }
    },

    requestSettlement: async (request, response) => {
        try {
            const { groupId } = request.body;
            const requesterEmail = request.user.email;

            // Mark the group as awaiting admin confirmation
            await Group.findByIdAndUpdate(groupId, {
                'paymentStatus.isPendingApproval': true,
                'paymentStatus.requestedBy': requesterEmail
            });

            response.status(200).json({ message: "Settlement request sent to Admin" });
        } catch (error) {
            response.status(500).json({ message: "Error requesting settlement" });
        }
    },

    // 2. Admin calls this after verifying the money was received
    // src/controllers/expenseController.js

    // Inside expenseController.js
    confirmSettlement: async (request, response) => {
        try {
            const { groupId } = request.body;
            const userEmail = request.user.email;

            // 1. Fetch the group to check real-time permissions from the database
            const group = await Group.findById(groupId);
            if (!group) return response.status(404).json({ message: "Group not found" });

            // 2. Permission Check: Verify if the user has an 'admin' or 'manager' role in the members array
            const member = group.members.find(m => m.email === userEmail);

            // UPDATED: Now checks for 'admin' OR 'manager' OR if they are the primary adminEmail
            const hasManagerRights =
                member?.role === 'admin' ||
                member?.role === 'manager' ||
                group.adminEmail === userEmail;

            if (!hasManagerRights) {
                return response.status(403).json({
                    message: "Access Denied: You do not have the required permissions to confirm settlements."
                });
            }

            // --- START YOUR ORIGINAL LOGIC ---
            const settlementBatchId = new mongoose.Types.ObjectId();
            const payerEmail = group.paymentStatus.requestedBy;

            const expensesToSettle = await Expense.find({ groupId: groupId, isSettled: false });

            let amountPaidByRequester = 0;
            expensesToSettle.forEach(exp => {
                const userSplit = exp.splits.find(s => s.email === payerEmail);
                if (userSplit) {
                    amountPaidByRequester += userSplit.amount;
                }
            });

            await Expense.updateMany(
                { groupId: groupId, isSettled: false },
                {
                    $set: {
                        isSettled: true,
                        settledBy: payerEmail,
                        paidAmount: amountPaidByRequester,
                        settlementBatchId: settlementBatchId,
                        settledAt: Date.now()
                    }
                }
            );

            await Group.findByIdAndUpdate(groupId, {
                paymentStatus: {
                    amount: 0,
                    isPaid: true,
                    isPendingApproval: false,
                    date: Date.now(),
                    requestedBy: payerEmail
                }
            });
            // --- END YOUR ORIGINAL LOGIC ---

            response.status(200).json({
                message: "Settlement confirmed",
                amountPaid: amountPaidByRequester
            });
        } catch (error) {
            console.error("Confirm Settlement Error:", error);
            response.status(500).json({ message: "Error confirming settlement" });
        }
    },

    reopenGroup: async (request, response) => {
        try {
            const { groupId } = request.body;

            // 1. Reset all expenses in this group to unsettled
            await Expense.updateMany(
                { groupId: groupId },
                { $set: { isSettled: false, settledBy: null, settledAt: null } }
            );

            // 2. Reset Group status to Active
            await Group.findByIdAndUpdate(groupId, {
                paymentStatus: {
                    isPaid: false,
                    isPendingApproval: false,
                    requestedBy: null,
                    amount: 0,
                    date: null
                }
            });

            response.status(200).json({ message: "Group re-opened successfully" });
        } catch (error) {
            response.status(500).json({ message: "Error re-opening group" });
        }
    },


    getDashboardStats: async (request, response) => {
        try {
            const userEmail = request.user.email;

            // Fetch latest user data for credits
            const user = await User.findOne({ email: userEmail });

            // Fetch expenses and POPULATE the groupId to get the name
            const expenses = await Expense.find({
                $or: [{ payerEmail: userEmail }, { "splits.email": userEmail }]
            })
                .sort({ date: -1 })
                .limit(5)
                .populate('groupId', 'name'); // CRITICAL: This links the group name to the activity

            // ... (Your existing totalPaid/totalOwed calculation logic) ...
            let totalPaid = 0;
            let totalOwed = 0;
            expenses.forEach(exp => {
                if (exp.payerEmail === userEmail && !exp.isSettled) {
                    const othersSplit = exp.splits.filter(s => s.email !== userEmail).reduce((sum, s) => sum + s.amount, 0);
                    totalPaid += othersSplit;
                } else if (exp.payerEmail !== userEmail && !exp.isSettled) {
                    const mySplit = exp.splits.find(s => s.email === userEmail);
                    if (mySplit) totalOwed += mySplit.amount;
                }
            });

            response.status(200).json({
                totalPaid,
                totalOwed,
                credits: user.credits,
                recentActivity: expenses // Send the populated expenses
            });
        } catch (error) {
            console.error("Dashboard Stats Error:", error);
            response.status(500).json({ message: "Error calculating stats" });
        }
    }
};

module.exports = expenseController;