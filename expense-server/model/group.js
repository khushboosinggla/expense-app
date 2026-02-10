const mongoose = require('mongoose');

const groupSchema = new mongoose.Schema({
    name: {type: String, required: true},
    description: {type: String, required: false},
    adminEmail:{type: String, required: true},
    createdAt: {type: Data, default: Data.now()},
    membersEmail: [String],
    thumbnail: {type: String, required: false},
    paymentStatus:{
        amount: Number,
        currency: String,
        data: Date,
        isPaid: Boolean,
    }
});

module.exports = mongoose.model('Group', groupSchema);