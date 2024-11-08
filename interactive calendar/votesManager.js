// votesManager.js

// Using a Map to store departments for efficient key-based management
const departments = new Map();

class VotesManager {
    constructor() {
        // Default "floating" department for users not assigned to any department
        this.defaultDepartmentId = "floating";
        this.getDepartmentVotes(this.defaultDepartmentId);
    }

    // Create or retrieve votes data for a department
    getDepartmentVotes(departmentId) {
        if (!departments.has(departmentId)) {
            departments.set(departmentId, {
                owner: null,           // userId of the department owner
                votesData: {},         // Stores votes data for each date
                members: new Set(),    // Stores userIds of department members
            });
        }
        return departments.get(departmentId).votesData;
    }

    // Assign the first member as the owner of the department
    assignOwner(departmentId, userId) {
        const department = departments.get(departmentId);
        if (!department.owner) {
            department.owner = userId;
        }
    }

    // Check if a user is the department owner
    isOwner(departmentId, userId) {
        const department = departments.get(departmentId);
        return department && department.owner === userId;
    }

    // Add a user to a department
    addUserToDepartment(departmentId, userId) {
        this.getDepartmentVotes(departmentId); // Ensure department exists
        const department = departments.get(departmentId);
        department.members.add(userId);
    }

    // Remove a user from a department
    removeUserFromDepartment(departmentId, userId) {
        const department = departments.get(departmentId);
        if (department) {
            department.members.delete(userId);
            // If the owner leaves, reset the department owner
            if (department.owner === userId) {
                department.owner = null;
            }
        }
    }

    // Update a vote for a specific date (or cell) in the department
    updateVote(departmentId, date, userId) {
        const votesData = this.getDepartmentVotes(departmentId);
        if (!votesData[date]) {
            votesData[date] = new Set();
        }
        votesData[date].add(userId);
    }

    // Remove a vote for a specific date by a specific user
    removeVote(departmentId, date, userId) {
        const votesData = this.getDepartmentVotes(departmentId);
        if (votesData[date]) {
            votesData[date].delete(userId);
            // Remove date entry if no votes left
            if (votesData[date].size === 0) {
                delete votesData[date];
            }
        }
    }

    // Get all votes in a department (convert Set to array for JSON compatibility)
    getAllVotes(departmentId) {
        const votesData = this.getDepartmentVotes(departmentId);
        return Object.fromEntries(
            Object.entries(votesData).map(([date, users]) => [date, Array.from(users)])
        );
    }

    // Reset votes data for a department (only by owner)
    resetVotes(departmentId, userId) {
        if (this.isOwner(departmentId, userId)) {
            departments.get(departmentId).votesData = {};
            return true;
        }
        return false;
    }

    // Retrieve a list of all members in a department
    getDepartmentMembers(departmentId) {
        const department = departments.get(departmentId);
        return department ? Array.from(department.members) : [];
    }

    // Handle messaging between members of a department
    sendMessage(departmentId, senderId, recipientIds, message) {
        const department = departments.get(departmentId);
        if (!department) return null;

        // Filter members based on recipients, exclude the sender
        const members = Array.from(department.members);
        return members
            .filter((userId) => recipientIds.includes(userId) && userId !== senderId)
            .map((userId) => ({ userId, message }));
    }

    // Function to create or retrieve the default department (for unassigned users)
    getDefaultDepartment() {
        return this.getDepartmentVotes(this.defaultDepartmentId);
    }
}

module.exports = new VotesManager();
