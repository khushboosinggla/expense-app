const Group = require("../model/group");

const groupDao = {
    createGroup: async (data) => {
        const newGroup = new Group(data);
        return await newGroup.save();
    },

    updateGroup: async (data) => {
        const { groupId, name, description, thumbnail, adminEmail, paymentStatus } = data;

        return await Group.findByIdAndUpdate(groupId, {
            name, description, thumbnail, adminEmail, paymentStatus,
        }, { new: true });
    },

    addMembers: async (groupId, ...membersEmails) => {
        return await Group.findByIdAndUpdate(groupId, {
            $addToSet: { membersEmail: { $each: membersEmails }}
        }, { new: true });
    },

    removeMembers: async (groupId, ...membersEmails) => {
        return await Group.findByIdAndUpdate(groupId, {
            $pull: { membersEmail: { $in: membersEmails } }
        }, { new: true });
    },

    getGroupByEmail: async (email) => {
        return await Group.find({ membersEmail: email });
    },

    // RBAC FIX: Custom query to find groups for member OR parent admin
    getGroupsForUser: async (userEmail, adminEmail) => {
        return await Group.find({
            $or: [
                { membersEmail: userEmail },     // I am a member
                { adminEmail: userEmail },       // I am the admin/owner
                { adminEmail: adminEmail }       // My Parent Admin owns the group
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

    //default sorting order of createdAt is descending oredr(-1)
    getGroupsPaginated: async (email, limit, skip, sortOptions = {createdAt: -1}) => {
        const [groups, totalCount] = await Promise.all([
            /**
             * Find groups with given email,
             * sort them to preserve order across
             * pagination requests, and then perform
             * skip and limit to get results of desired page
             */
            Group.find({ membersEmail: email })
                .sort(sortOptions)
                .skip(skip)
                .limit(limit),
                /**
                 * // Count how many records are there in the collection
                 * // with the given email
                 */
            Group.countDocuments({ membersEmail: email })
        ]);
        return { groups, totalCount };
    },

};

module.exports = groupDao;
module.exports = groupDao;
