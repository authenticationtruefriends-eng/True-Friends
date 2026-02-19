const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER, // authentication.truefriends@gmail.com
        pass: process.env.EMAIL_PASS  // App Password
    }
});

const sendVerificationEmail = async (to, otp) => {
    const mailOptions = {
        from: `"True Friends" <${process.env.EMAIL_USER}>`,
        to,
        subject: 'Verify your email - True Friends',
        html: `
            <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
                <h2 style="color: #6a5acd;">Welcome to True Friends! 🌟</h2>
                <p>You are just one step away from joining. Please use the verification code below to complete your signup:</p>
                <div style="background: #f3f0ff; padding: 15px; border-radius: 8px; text-align: center; font-size: 24px; font-weight: bold; letter-spacing: 5px; color: #6a5acd; margin: 20px 0;">
                    ${otp}
                </div>
                <p>This code will expire in 10 minutes.</p>
                <p style="font-size: 12px; color: #888;">If you did not request this code, please ignore this email.</p>
            </div>
        `
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log(`✅ Email sent to ${to}`);
        return true;
    } catch (error) {
        console.error("❌ Error sending email:", error);
        return false;
    }
};

module.exports = { sendVerificationEmail };
