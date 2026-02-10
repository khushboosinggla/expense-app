const Razorpay= require('razorpay');
const crypto = require('crypto');

const {CREDIT_TO_PAISA_MAPPING } = require('../constants/paymentConstants');
const users = require('../model/users');

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
};

module.exports = paymentsController;