const Group = require("../model/group");

const groupDao = {
    createGroup: async (data) => {
        const newGroup = new Group(data);
        return await newGroup.save();
    },

    updateGroup: async (data) => {
        const { groupId, ...updateData } = data; 

        return await Group.findByIdAndUpdate(
            groupId,
            { $set: updateData },
            { new: true }
        );
    },

    // UPDATED: Now adds members as objects with default 'viewer' role
    addMembers: async (groupId, ...membersEmails) => {
        const newMemberObjects = membersEmails.map(email => ({
            email: email,
            role: 'viewer' // Default role assigned when adding via group DAO
        }));

        return await Group.findByIdAndUpdate(groupId, {
            $addToSet: { 
                members: { $each: newMemberObjects }, // New object structure
                membersEmail: { $each: membersEmails } // Maintaining legacy array
            }
        }, { new: true });
    },

    // UPDATED: Removes members from both the object array and legacy string array
    removeMembers: async (groupId, ...membersEmails) => {
        return await Group.findByIdAndUpdate(groupId, {
            $pull: { 
                members: { email: { $in: membersEmails } }, // Pull from object array
                membersEmail: { $in: membersEmails }        // Pull from string array
            }
        }, { new: true });
    },

    // UPDATED: Search by email within the new object structure
    getGroupByEmail: async (email) => {
        return await Group.find({ 
            $or: [
                { "members.email": email },
                { membersEmail: email }
            ]
        });
    },

    // UPDATED: Support for hierarchical queries including member objects
    getGroupsForUser: async (userEmail, adminEmail) => {
        return await Group.find({
            $or: [
                { "members.email": userEmail },
                { membersEmail: userEmail },
                { adminEmail: userEmail },
                { adminEmail: adminEmail }
            ]
        });
    },

    getGroupByStatus: async (status) => {
        return await Group.find({ "paymentStatus.isPaid": status });
    },

    getAuditLog: async (groupId) => {
        const group = await Group.findById(groupId).select('paymentStatus.date');
        return group ? group.paymentStatus.date : null;
    },

    // UPDATED: Standardizing pagination to look into the members.email field
    getGroupsPaginated: async (email, adminId, limit, skip, sortOptions = { createdAt: -1 }) => {
        const query = {
            $or: [
                { "members.email": email }, // Match within the new object array
                { membersEmail: email },      // Legacy support for string array
                { adminId: adminId }          // Match if user is the admin
            ]
        };

        const [groups, totalCount] = await Promise.all([
            Group.find(query)
                .sort(sortOptions)
                .skip(skip)
                .limit(limit)
                .populate('adminId', 'name email'), // Optional: brings in admin details
            Group.countDocuments(query)
        ]);

        return { groups, totalCount };
    }
};

module.exports = groupDao;