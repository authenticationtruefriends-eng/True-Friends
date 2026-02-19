# True Friends - Real-time Chat Application

A modern, full-featured chat application built with React and Node.js, featuring real-time messaging, video calls, AI chatbot, and more.

## 🚀 Features

- ✅ Real-time messaging with Socket.IO
- ✅ Video/Audio calls with WebRTC
- ✅ Email verification (OTP)
- ✅ AI chatbot integration
- ✅ File sharing and image uploads
- ✅ Group chats
- ✅ End-to-end encryption
- ✅ User profiles and friend system
- ✅ Emoji support and GIF integration

## 🛠️ Tech Stack

**Frontend:**

- React 19
- Vite
- Socket.IO Client
- PeerJS (WebRTC)
- React Router

**Backend:**

- Node.js + Express
- Socket.IO
- Nodemailer (Email)
- OpenAI API (Chatbot)
- Multer (File uploads)

## 📦 Local Development

### Prerequisites

- Node.js 18+
- Gmail account (for email verification)
- OpenAI API key (optional, for AI features)

### Setup

1. **Clone the repository**

   ```bash
   git clone https://github.com/YOUR_USERNAME/true-friends-chat.git
   cd true-friends-chat
   ```

2. **Install dependencies**

   ```bash
   # Backend
   cd backend
   npm install

   # Frontend
   cd ../frontend
   npm install
   ```

3. **Configure environment variables**

   Backend (`.env`):

   ```env
   EMAIL_USER=your_gmail@gmail.com
   EMAIL_PASS=your_app_password
   SECRET_KEY=true_friends_secret_key_2024
   PORT=5000
   ```

   Frontend (`.env`):

   ```env
   VITE_API_URL=http://localhost:5000
   ```

4. **Run the application**

   ```bash
   # Terminal 1 - Backend
   cd backend
   node index.js

   # Terminal 2 - Frontend
   cd frontend
   npm run dev
   ```

5. **Access the app**
   - Frontend: <https://localhost:5173>
   - Backend: <http://localhost:5000>

## 🌐 Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed deployment instructions to Railway or Render.

### Quick Deploy to Railway

1. Push code to GitHub
2. Sign up at [railway.app](https://railway.app)
3. Deploy from GitHub repo
4. Set environment variables
5. Get your live URL!

## 📝 Environment Variables

### Backend

- `EMAIL_USER` - Gmail address for sending verification emails
- `EMAIL_PASS` - Gmail app password
- `SECRET_KEY` - JWT secret key
- `PORT` - Server port (default: 5000)
- `OPENAI_API_KEY` - OpenAI API key (optional)

### Frontend

- `VITE_API_URL` - Backend API URL

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

This project is licensed under the MIT License.

## 🙏 Acknowledgments

- Built with ❤️ using modern web technologies
- Icons from Lucide React
- Avatars from DiceBear

---

Made with 💜 by [Your Name]
