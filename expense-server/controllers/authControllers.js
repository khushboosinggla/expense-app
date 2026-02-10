//doubt
const userDao = require('../dao/userDao');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const { validationResult } = require('express-validator');
const { ADMIN_ROLE } = require('../utility/userRoles');


const authController = {

    // ================= LOGIN =================
    login: async (request, response) => {
        try {
            const { email, password } = request.body;

            if (!email || !password) {
                return response.status(400).json({
                    message: 'Email and Password are required'
                });
            }

            const user = await userDao.findByEmail(email);
            user.role = user.role ? user.role : ADMIN_ROLE;
            user.adminId = user.adminId ? user.adminId : user._id;

            // user exist check (MOST IMPORTANT)
            if (!user) {
                return response.status(400).json({
                    message: 'Invalid email or password'
                });
            }

            const isPasswordMatched = await bcrypt.compare(
                password,
                user.password
            );
            if(user && isPasswordMatched){
                const token = jwt.sign({
                    name: user.name,
                    email: user.email,
                    id: user._id,
                    // The logic below ensure backward compatibility.
                    role: user.role ? user.role : ADMIN_ROLE,
                    adminId: user.adminId ? user.adminId : user._id,
                }, process.env.JWT_SECRET, {
                    expiresIn: '1h'
                });
                response.cookie('jwtToken',token,{
                    httpOnly: true, 
                    secure: true,   //data is encrypted work only if connection is https
                    domain: 'localhost',
                    path: '/'      //on which path cookie is valid
                });
                return response.status(200).json({
                    message: 'User Authenticated',
                    user: user
                });
            }

            if (!isPasswordMatched) {
                return response.status(400).json({
                    message: 'Invalid email or password'
                });
            }

            return response.status(200).json({
                message: 'User Authenticated',
                user: {
                    id: user._id,
                    name: user.name,
                    email: user.email
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

            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(password, salt);

            

            const user = await userDao.create({
                name: name,
                email: email,
                password: hashedPassword
            });

            return response.status(201).json({
                message: 'User registered successfully',
                user: {
                    id: user._id
                }
            });

        } catch (error) {
            if (error.code === 'USER_EXIST') {
                return response.status(400).json({
                    message: 'User with this email already exists'
                });
            }

            console.error('Register Error:', error);
            return response.status(500).json({
                message: 'Internal Server Error'
            });
        }
    }
};

module.exports = authController;