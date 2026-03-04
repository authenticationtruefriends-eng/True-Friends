import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
    uid: { type: String, required: true, unique: true },
    displayName: String,
    photoURL: String,
    friendCode: { type: String, unique: true },
    bio: String,
    phone: String,
    birthday: String,
    location: String,
    joinedAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);
export default User;
