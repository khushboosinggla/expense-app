const userDao = require("../dao/userDao");
const Users = require('../model/users'); 

const usersController = {
    getUserInfo: async (request, response) => {
        try {
            const email = request.user.email;
            const user = await userDao.findByEmail(email);
            return response.json({ user: user });
        } catch (error) {
            return response.status(500).json({ message: 'Internal server error' });
        }
    },

    updateProfile: async (request, response) => {
        try {
            const { name } = request.body;
            const userId = request.user._id; 

            const updatedUser = await Users.findByIdAndUpdate(
                userId,
                { name: name },
                { new: true } 
            );

            if (!updatedUser) {
                return response.status(404).json({ message: "User not found" });
            }

            return response.status(200).json({ 
                message: "Profile updated successfully", 
                user: updatedUser 
            });
        } catch (error) {
            console.error(error);
            return response.status(500).json({ message: 'Internal server error' });
        }
    },

    // NEW: Function to Add a new User (with duplicate check)
    createUser: async (request, response) => {
        try {
            const { name, email, role } = request.body;

            // 1. Duplicate check to prevent the E11000 error
            const existingUser = await Users.findOne({ email: email.toLowerCase() });
            if (existingUser) {
                return response.status(400).json({ message: "A user with this email already exists." });
            }

            // 2. Create the user
            const newUser = await Users.create({
                name,
                email: email.toLowerCase(),
                role
            });

            return response.status(201).json({ 
                message: "User added successfully", 
                user: newUser 
            });
        } catch (error) {
            console.error("Create User Error:", error);
            return response.status(500).json({ message: "Internal server error" });
        }
    },

    // NEW: Function to list all users for the Manage Users table
    getAllUsers: async (request, response) => {
        try {
            const users = await Users.find({});
            return response.status(200).json({ users });
        } catch (error) {
            return response.status(500).json({ message: "Internal server error" });
        }
    },

    // NEW: Function to delete a user
    deleteUser: async (request, response) => {
        try {
            const { id } = request.params;
            await Users.findByIdAndDelete(id);
            return response.status(200).json({ message: "User deleted" });
        } catch (error) {
            return response.status(500).json({ message: "Internal server error" });
        }
    }
};

module.exports = usersController;