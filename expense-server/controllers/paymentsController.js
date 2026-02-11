const Razorpay= require('razorpay');
const crypto = require('crypto');

const {CREDIT_TO_PAISA_MAPPING } = require('../constants/paymentConstants');
const users = require('../model/users');
const { request } = require('http');

const razorpayClient = new Razorpay({
    key_id: process.env.RAZORPAY_key_id,
    key_secret: process.env.RAZORPAY_key_SECRET
});

const paymentsController = {

    //step2 from diagram
    createOrder: async (request, response) =>{
        try {
            const  {credits} = request.body;  // take credit that user want to buy

            if (!CREDIT_TO_PAISA_MAPPING[credits]) {     // if user tries to trick by adding some random credit 
                return response.status(400).json({       // value that we are not offering then we will return error
                    message: 'Invalid credit value'
                });
            }

            const amountInPaise = CREDIT_TO_PAISA_MAPPING[credits];

            const order = await razorpayClient.orders.createOrder({
                amount: amountInPaise,
                currency: 'INR',
                receipt: `receipt_${Date.now()}`
            });

            return response.json({ order: order})

        } catch (error) {
            return response.status(500).json({message: 'Internal server error'});
        }
    },

    //step 8 from sequence diagram
    verifyOrder: async (request, response) => {
        try{
            const {
                rezorpay_order_id, razorpay_payment_id, 
                razorpay_signature, credits}
                = request.body;

                const body = rezorpay_order_id + "|" + razorpay_payment_id;
                const expectedSignature = crypto
                
                //create unique difgital fingerprint (HMAC) of the secret key
                .createHmac('sha256', process.env.RAZORPAY_key_SECRET)
                //feed both HMAC and body into hashing function
                .update(body.toString())
                // COnvert the hashed string into hexadecimal format
                .digest('hex');

            if (expectedSignature !== razorpay_signature) {
                return response.status(400).json({message: 'Invalid transaction'});
            }

            const user = await users.findById( { _id: request.user._id });
            user.credits += Number(credits);
            await user.save();

            return response.json({ user: user });
            
        } catch (error) {
            return response.status(500).json({message: 'Internal server error'});
        }
    },

    createSubscription: async (request, response) => {
        try {
            const { plan_name } = request.body;

             if (!PLAN_IDS[plan_name]) {
                return response.status(400).json({
                    message: 'Invalid plan selected'
                });
             }

             const plan = PLAN_IDS[plan_name];
             const subscription = await razorpayClient.subscriptions.create({
                plan_id: plan.id,
                customer_notify: 1,
                total_count: plan.totalBillingCycleCount,
                notes: {
                    userId: request.user._id
                }
             });

             return response.json({subscription: subscription});

        } catch (error) {
            console.log(error);
            return response.status(500).json({ message: 'Internal server error'});
        }

    },

    captureSubscription: async (request,response) => {
        try {
            const {subscriptionId} = request.body;

            const subscription = await razorpayClient.subscriptions.fetch(subscriptionId);
            const user = await Users.findById({ _id: request.user._id });

            user.subscription = {
                subscriptionId: subscriptionId,
                planId: subscription.plan_id,
                status: subscription.status
            };
            await user.save();
            response.json({ user: user });
        } catch (error) {
            console.log(error);
            return response.status(500).json({ message: 'Internal server error'});
        }
    },

        

    handleWebhookEvents: async (request,response) => {
        try {
            console.log('Recieved Event');
            const signature = request.headers['x-razorpay-signature'];
            const body = request.body;
            const  expectedSignature = crypto
                .createHmac('sha256', process.env.RAZORPAY_key_SECRET)
                .update(body)
                .digest('hex');

                if(expectedSignature !== signature){
                    return response.status(400).send('Invalid signature');
                 }
                const payload = JSON.parse(body);
                console.log(JSON.stringify(payload, null, 2));

                const event = payload.event;
                const subscriptionData= payload.payload.subscription.entry;
                const razorpaySubscriptionId = subscriptionData.id;
                const userId = subscriptionData.notes?.userId;
                 
                 if (!userId) {
                    console.log('User ID not found in the notes')
                    return response.status(400).send('User ID not found in subscription notes');
                }

                let newStatus; 
                switch (event) {
                    case 'subscription.activated':
                        newStatus = 'active';
                        break;

                    case 'subscription.pending':
                        newStatus = 'pending';
                        break;
                    
                    case 'subscription.cancelled':
                        newStatus = 'cancelled';
                        break;

                    case 'subscription.completed':
                        newStatus = 'completed';
                        break;

                    default:
                        console.log(`Unhandled event type: ${event}`);
                        return response.status(200).send(`Unhandled event received: ${event}`);
                }

                const user = await User.findByIdAndUpdate(
                    {_id: userId},
                    {
                        $set: {
                            'subscription.subscriptionId': razorpaySubscriptionId,
                            'subscription.status': newStatus,
                            'subscription.planId': subscriptionData.plan_id,
                            'subscription.razorpayStatus': subscriptionData.start_at
                                ? new Date(subscriptionData.start_at * 1000)
                                : null,
                                'subscription.end': subscriptionData.end_at
                                    ? new Date(subscriptionData.start_at * 1000)
                                    : null,
                                'subscription.lastBillDate': subscriptionData.current_at
                                    ? new Date(subscriptionData.current_start * 1000)
                                    : null,
                                'subscription.nextBillDate': subscriptionData.current_end
                                    ? new Date(subscriptionData.current_end * 1000)
                                    : null,
                                'subscription.paymentsMade': subscriptionData.paid_count,
                                'subscription.paymentsRemaining':
                                subscriptionData.remaining_count,
                            }
                        },
                        {new: true}
                    );

                    if (!user) {
                        console.log('No user with provided userID exist');
                        return response.status(400).send('No user with provided userID exist');

                    }

                    console.log('Updated Subscription status for the user ${user.email} to ${newStatus}');
                    return response.status(200).send(`Event processed for user: ${user.email} with userID: ${userId}`);

        } catch (error) {
            console.log(error);
            return response.status(500).json({ message: 'Internal server error'});
        }


    },
};

module.exports = paymentsController;