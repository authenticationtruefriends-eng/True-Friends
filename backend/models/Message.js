import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
    msgId: { type: String, required: true, unique: true },
    text: { type: String, required: true },
    from: { type: String, required: true },
    to: { type: String, required: true },
    type: { type: String, default: 'text' }, // text, image, file
    timestamp: { type: Number, default: Date.now },
    time: String, // HH:MM AM/PM
    replyTo: { type: String, default: null },
    fileUrl: String,
    imageUrl: String,
    encrypted: { type: Boolean, default: true }
});

// Index for fast retrieval of conversations
messageSchema.index({ from: 1, to: 1, timestamp: 1 });

const Message = mongoose.model('Message', messageSchema);
export default Message;
