const mongoose = require('mongoose');


const subscriptionSchema = new mongoose.Schema({
    subscriptionId: {type: String}, //id given by razorpay subscription 
    planId: {type: String}, // our internal plan id to identify which plan user has subscribed to
    status: {type: String}, //active, cancelled, etc
    start: {type: Date},
    end: {type: Date},
    lastBillDate: {type: Date},
    nextBillDate: {type: Date},
    paymentsMade: {type: Number},
    paymentsRemaining: {type: Number}

});

const userSchema = new mongoose.Schema({
    name: {type: String,required:true},
    email: {type: String, required: true, unique: true},
    password: {type: String, required: false},
    googleId: { type: String, required: false },
    role: { type: String, required: true, default: 'admin' },
    adminId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    //default to 1 to give free trail of creating 1 group
    credits: {type: Number, default: 1},
    subscription: {type: subscriptionSchema, required: false}
});

module.exports = mongoose.model('User',userSchema);