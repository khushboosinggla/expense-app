const mongoose = require('mongoose');

const groupSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true }, // Added trim to clean up whitespace
    description: { type: String, required: false, trim: true },
    adminEmail: { type: String, required: true, lowercase: true }, // Ensure emails are always lowercase
    adminId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User', 
        required: true, 
        index: true 
    },
    createdAt: { type: Date, default: Date.now }, 
    members: [
        {
            email: { type: String, required: true, lowercase: true }, // Enforce lowercase for matching
            role: { 
                type: String, 
                enum: [ 'admin', 'manager', 'viewer' ], 
                default: 'viewer' 
            },
            joinedAt: { type: Date, default: Date.now } // NEW: Track when a member joined
        }
    ],
    // Keeping for backward compatibility and simpler indexing
    membersEmail: { type: [String], lowercase: true }, 
    thumbnail: { type: String, required: false },
    paymentStatus: {
        amount: { type: Number, default: 0 },
        currency: { type: String, default: 'INR' },
        date: { type: Date },
        isPaid: { type: Boolean, default: false },
        isPendingApproval: { type: Boolean, default: false },
        requestedBy: { type: String, default: null }
    },
    budgetGoal: { type: Number, default: 0 }
}, {
    timestamps: true // NEW: Automatically manages createdAt and updatedAt
});

// NEW: Add an index on membersEmail for faster dashboard loading
groupSchema.index({ membersEmail: 1 });
// NEW: Add an index for nested email searches
groupSchema.index({ "members.email": 1 });

module.exports = mongoose.model('Group', groupSchema);