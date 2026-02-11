
//node is like hardware of phone and npm is like ios andriod os of phone
//express is like an app installed on phone which helps to do specific task
//npm init -y  => to create package.json file

    /**
     * createa POST API with path /login which takes in emailand password from 
     * body and checks if user with same email and password exit in the users array
     * if yes return 200 response with message login successful
     * if no return 401 response with message invalid credentials
     */
require('dotenv').config();
const express = require('express');
const cookieParser = require('cookie-parser');
const cors = require('cors');

const mongoose = require('mongoose');
const authRoutes = require('./routes/authRoutes');
const groupRoutes = require('./routes/groupRoutes');
const rbacRoutes = require('./routes/rbacRoutes');
const paymentsRoutes = require('./routes/paymentRoutes');
const profileRoutes = require('./routes/profileRoutes');

mongoose.connect(process.env.MONGO_DB_CONNECTION_URI)
    .then(() => console.log('MongoDB Connected'))
    .catch((error) => console.log('Error Connecting to Database: ', error));

const corsOption = {
    origin: process.env.CLIENT_URL,
    credentials: true
};

const app = express();

app.use(cors(corsOption));

//slip applying express.json() middleware to
//requests that starts with /payments/webhook
app.use((request,response, next) => {
    if(request.originalUrl.startsWith('/payments/webhook')){
        return next();
    }

    express.json()(request, response, next);
}

); // Middleware
app.use(cookieParser()); // Middleware

app.use('/auth', authRoutes);
app.use('/groups', groupRoutes);
app.use('/users', rbacRoutes);
app.use('/payments', paymentsRoutes);
app.use('/profile', profileRoutes);

app.listen(5001, () => {
    console.log('Server is running on port 5001');
});
    
