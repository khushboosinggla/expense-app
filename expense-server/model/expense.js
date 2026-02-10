const mongoose = require('mongoose');

const expenseSchema = new mongoose.Schema({
    groupId: { type: mongoose.Schema.Types.ObjectId, ref: 'Group', required: true },
    description: { type: String, required: true },
    amount: { type: Number, required: true },
    payerEmail: { type: String, required: true },
    date: { type: Date, default: Date.now },
    
    // Detailed split info to handle unequal splits and exclusions
    splits: [{
        email: { type: String, required: true },
        amount: { type: Number, required: true } // Amount this person OWES
    }],
    
    isSettled: { type: Boolean, default: false }
});

module.exports = mongoose.model('Expense', expenseSchema);