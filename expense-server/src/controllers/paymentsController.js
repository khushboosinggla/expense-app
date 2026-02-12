const Razorpay = require('razorpay');
const crypto = require('crypto');
const { CREDIT_TO_PAISA_MAPPING, PLAN_IDS } = require('../constants/paymentConstants'); // Added PLAN_IDS
const Users = require('../model/users');

const razorpayClient = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
});

const paymentsController = {
    // Step-2 from sequence diagram
    createOrder: async (request, response) => {
        try {
            const { credits } = request.body;
            if (!CREDIT_TO_PAISA_MAPPING[credits]) {
                return response.status(400).json({
                    message: 'Invalid credit value'
                });
            }

            const amountInPaise = CREDIT_TO_PAISA_MAPPING[credits];

            const order = await razorpayClient.orders.create({
                amount: amountInPaise,
                currency: 'INR',
                receipt: `receipt_${Date.now()}`
            });

            return response.json({ order: order });

        } catch (error) {
            return response.status(500).json({ message: 'Internal server error' });
        }
    },

    // Step-8 from sequence diagram
    verifyOrder: async (request, response) => {
        try {
            const {
                razorpay_order_id, 
                razorpay_payment_id,
                razorpay_signature, 
                credits
            } = request.body;

            const body = razorpay_order_id + '|' + razorpay_payment_id;

            const expectedSignature = crypto
                // Create unique digital fingerprint (HMAC) of the secret key.
                .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
                // Feed both HMAC and body into hashing function.
                .update(body.toString())
                // Convert the hashed string into hexadecimal.
                .digest('hex');

            if (expectedSignature !== razorpay_signature) {
                return response.status(400).json({ message: 'Invalid transaction' });
            }

            const user = await Users.findById({ _id: request.user._id });
            user.credits += Number(credits);
            await user.save();

            return response.json({ user: user });

        } catch (error) {
            return response.status(500).json({ message: 'Internal server error' });
        }
    },

    // NEW: 1. Create Subscription Link
    createSubscription: async (request, response) => {
        try {
            const { plan_name } = request.body;

            if (!PLAN_IDS[plan_name]) {
                return response.status(400).json({ message: "Invalid plan selected" });
            }

            const plan = PLAN_IDS[plan_name];

            const subscription = await razorpayClient.subscriptions.create({
                plan_id: plan.id,
                customer_notify: 1,
                total_count: plan.totalBillingCycleCount,
                notes: {
                    userId: request.user._id // Critical for webhooks
                }
            });

            return response.json({ subscription });
        } catch (error) {
            console.log(error);
            return response.status(500).json({ message: 'Internal server error' });
        }
    },

    // NEW: 2. Capture Subscription (Initial Save)
    captureSubscription: async (request, response) => {
        try {
            const { subscriptionId } = request.body;
            const subscription = await razorpayClient.subscriptions.fetch(subscriptionId);
            const user = await Users.findById(request.user._id);

            // Save basic details immediately after frontend success
            user.subscription = {
                subscriptionId: subscriptionId,
                planId: subscription.plan_id,
                status: subscription.status
            };

            await user.save();
            response.json({ user });
        } catch (error) {
            console.log(error);
            return response.status(500).json({ message: 'Internal server error' });
        }
    },

    // NEW: 3. Webhook Handler
    handleWebhookEvents: async (request, response) => {
        try {
            const signature = request.headers['x-razorpay-signature'];
            const body = request.body; // Raw body due to server.js change

            const expectedSignature = crypto
                .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET)
                .update(body)
                .digest('hex');

            if (expectedSignature !== signature) {
                return response.status(400).send('Invalid signature');
            }

            const payload = JSON.parse(body);
            const event = payload.event;

            // Only process if it contains subscription data
            if (payload.payload && payload.payload.subscription) {
                 const subscriptionData = payload.payload.subscription.entity;
                 const userId = subscriptionData.notes?.userId;
                 
                 if(userId) {
                    let newStatus;
                    switch (event) {
                        case 'subscription.activated': 
                        case 'subscription.charged': 
                            newStatus = 'active'; 
                            break;
                        case 'subscription.completed': 
                            newStatus = 'completed'; 
                            break;
                        case 'subscription.cancelled': 
                            newStatus = 'cancelled'; 
                            break;
                        case 'subscription.halted': 
                            newStatus = 'halted'; 
                            break;
                        case 'subscription.pending': 
                            newStatus = 'pending'; 
                            break;
                        default: 
                            newStatus = subscriptionData.status; 
                    }

                    await Users.findByIdAndUpdate(userId, {
                        $set: {
                            'subscription.subscriptionId': subscriptionData.id,
                            'subscription.status': newStatus,
                            'subscription.planId': subscriptionData.plan_id,
                            'subscription.start': new Date(subscriptionData.start_at * 1000),
                            'subscription.end': new Date(subscriptionData.end_at * 1000),
                            'subscription.nextBillDate': subscriptionData.charge_at ? new Date(subscriptionData.charge_at * 1000) : null,
                            'subscription.lastBillDate': subscriptionData.current_start ? new Date(subscriptionData.current_start * 1000) : null,
                            'subscription.paymentsMade': subscriptionData.paid_count,
                            'subscription.paymentsRemaining': subscriptionData.remaining_count
                        }
                    });
                 }
            }

            response.status(200).send('OK');
        } catch (error) {
            console.log("Webhook Error", error);
            // Always return 200 to prevent Razorpay from retrying indefinitely
            return response.status(200).send('Webhook Processed'); 
        }
    }
};

module.exports = paymentsController;