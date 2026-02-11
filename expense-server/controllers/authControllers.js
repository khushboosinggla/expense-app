const userDao = require('../dao/userDao');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const { validationResult } = require('express-validator');
const { ADMIN_ROLE } = require('../utility/userRoles');

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const authController = {

    // ================= LOGIN =================
    login: async (request, response) => {
        try {
            const errors = validationResult(request);
            if (!errors.isEmpty()) {
                return response.status(400).json({ errors: errors.array() });
            }

            const { email, password } = request.body;

            const user = await userDao.findByEmail(email);
            if (!user) {
                return response.status(400).json({
                    message: 'Invalid email or password'
                });
            }

            const isPasswordMatched = await bcrypt.compare(
                password,
                user.password
            );

            if (!isPasswordMatched) {
                return response.status(400).json({
                    message: 'Invalid email or password'
                });
            }

            const token = jwt.sign(
                {
                    id: user._id,
                    name: user.name,
                    email: user.email,
                    role: user.role || ADMIN_ROLE,
                    adminId: user.adminId || user._id
                },
                process.env.JWT_SECRET,
                { expiresIn: '1h' }
            );

            response.cookie('jwtToken', token, {
                httpOnly: true,
                secure: false, // true in production (HTTPS)
                sameSite: 'lax'
            });

            return response.status(200).json({
                message: 'User Authenticated',
                user: {
                    id: user._id,
                    name: user.name,
                    email: user.email,
                    role: user.role || ADMIN_ROLE
                }
            });

        } catch (error) {
            console.error('Login Error:', error);
            return response.status(500).json({
                message: 'Internal Server Error'
            });
        }
    },

    // ================= REGISTER =================
    register: async (request, response) => {
        try {
            const { name, email, password } = request.body;

            if (!name || !email || !password) {
                return response.status(400).json({
                    message: 'Name, Email and Password are required'
                });
            }

            const existingUser = await userDao.findByEmail(email);
            if (existingUser) {
                return response.status(400).json({
                    message: 'User with this email already exists'
                });
            }

            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(password, salt);

            const user = await userDao.create({
                name,
                email,
                password: hashedPassword
            });

            return response.status(201).json({
                message: 'User registered successfully',
                user: {
                    id: user._id,
                    name: user.name,
                    email: user.email
                }
            });

        } catch (error) {
            console.error('Register Error:', error);
            return response.status(500).json({
                message: 'Internal Server Error'
            });
        }
    },

    // ================= CHECK USER LOGIN =================
    isUserLoggedIn: async (request, response) => {
        try {
            const token = request.cookies.jwtToken;

            if (!token) {
                return response.status(401).json({
                    message: 'User not logged in'
                });
            }

            const decoded = jwt.verify(token, process.env.JWT_SECRET);

            return response.status(200).json({
                message: 'User is logged in',
                user: decoded
            });

        } catch (error) {
            return response.status(401).json({
                message: 'Invalid or expired token'
            });
        }
    },

    // ================= LOGOUT =================
    logout: async (request, response) => {
        response.clearCookie('jwtToken');
        return response.status(200).json({
            message: 'Logout successful'
        });
    },

    // ================= GOOGLE SSO =================
    googleSso: async (request, response) => {
        try {
            const { token } = request.body;

            const ticket = await client.verifyIdToken({
                idToken: token,
                audience: process.env.GOOGLE_CLIENT_ID
            });

            const payload = ticket.getPayload();
            const { email, name } = payload;

            let user = await userDao.findByEmail(email);

            if (!user) {
                user = await userDao.create({
                    name,
                    email,
                    password: null
                });
            }

            const jwtToken = jwt.sign(
                {
                    id: user._id,
                    email: user.email,
                    role: user.role || ADMIN_ROLE
                },
                process.env.JWT_SECRET,
                { expiresIn: '1h' }
            );

            response.cookie('jwtToken', jwtToken, {
                httpOnly: true,
                secure: false,
                sameSite: 'lax'
            });

            return response.status(200).json({
                message: 'Google login successful',
                user
            });

        } catch (error) {
            console.error('Google SSO Error:', error);
            return response.status(500).json({
                message: 'Google authentication failed'
            });
        }
    }
};

module.exports = authController;