const Expense = require('../model/expense');
const Group = require('../model/group');

const expenseController = {
    addExpense: async (request, response) => {
        try {
            const { groupId, description, amount, payerEmail, splits } = request.body;

            // Simple validation: check if split total matches expense amount (approx)
            const totalSplit = splits.reduce((acc, curr) => acc + curr.amount, 0);
            
            // Allow small float point difference (e.g., 0.01)
            if (Math.abs(totalSplit - amount) > 0.1) {
                return response.status(400).json({ 
                    message: "Split amounts do not match total expense amount" 
                });
            }

            const newExpense = new Expense({
                groupId, description, amount, payerEmail, splits
            });

            await newExpense.save();
            response.status(201).json({ 
                message: "Expense added successfully", 
                expense: newExpense 
            });

        } catch (error) {
            console.error(error);
            response.status(500).json({ message: "Internal server error" });
        }
    },

    getGroupExpenses: async (request, response) => {
        try {
            const { groupId } = request.params;
            const expenses = await Expense.find({ groupId }).sort({ date: -1 });
            response.status(200).json(expenses);
        } catch (error) {
            response.status(500).json({ message: "Error fetching expenses" });
        }
    },

    getGroupSummary: async (request, response) => {
        try {
            const { groupId } = request.params;
            const expenses = await Expense.find({ groupId, isSettled: false });
            
            // Balances object: { "email": netAmount }
            // Positive = You are owed money. Negative = You owe money.
            let balances = {};

            expenses.forEach(expense => {
                // 1. Credit the Payer (they get money back)
                if (!balances[expense.payerEmail]) balances[expense.payerEmail] = 0;
                balances[expense.payerEmail] += expense.amount;

                // 2. Debit the borrowers (they subtract their share)
                expense.splits.forEach(split => {
                    if (!balances[split.email]) balances[split.email] = 0;
                    balances[split.email] -= split.amount;
                });
            });

            response.status(200).json({ balances });
        } catch (error) {
            console.error(error);
            response.status(500).json({ message: "Error calculating summary" });
        }
    },

    settleGroup: async (request, response) => {
        try {
            const { groupId } = request.body;
            
            // Mark all expenses in this group as settled
            await Expense.updateMany(
                { groupId: groupId, isSettled: false },
                { $set: { isSettled: true } }
            );

            // Update Group status to paid/settled
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
    }
};

module.exports = expenseController;