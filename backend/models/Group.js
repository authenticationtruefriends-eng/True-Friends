import mongoose from 'mongoose';

const groupSchema = new mongoose.Schema({
    groupId: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    members: [{ type: String }], // Array of normalized uids
    createdBy: { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
});

const Group = mongoose.model('Group', groupSchema);
export default Group;
