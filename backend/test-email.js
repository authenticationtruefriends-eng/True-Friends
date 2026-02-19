import 'dotenv/config';
import nodemailer from "nodemailer";

async function testEmail() {
    console.log("📧 Testing Email Configuration...");
    // Log masked password for verification
    const pass = process.env.EMAIL_PASS?.trim().replace(/\s/g, "") || "";
    console.log(`User: ${process.env.EMAIL_USER}`);
    console.log(`Password (masked): ${pass.substring(0, 3)}...${pass.substring(pass.length - 3)} (Length: ${pass.length})`);

    // SMTP Configuration (matching index.js fallback)
    const transportConfig = {
        host: "smtp.gmail.com",
        port: 587,
        secure: false, // true for 465, false for other ports
        requireTLS: true,
        auth: {
            user: process.env.EMAIL_USER?.trim(),
            pass: pass
        },
        tls: {
            rejectUnauthorized: false
        },
        logger: true, // Enable built-in logger
        debug: true   // Enable debug output
    };

    const transporter = nodemailer.createTransport(transportConfig);

    try {
        console.log("Verifying connection...");
        await transporter.verify();
        console.log("✅ SMTP Connection Verified!");

        console.log("Attempting to send test email...");
        const info = await transporter.sendMail({
            from: `"Test Script" <${process.env.EMAIL_USER}>`,
            to: process.env.EMAIL_USER, // Send to self
            subject: "Test Email from Backend Debugger",
            text: "If you receive this, the email configuration is working correctly.",
        });

        console.log("✅ Message sent: %s", info.messageId);
        console.log("Preview URL: %s", nodemailer.getTestMessageUrl(info));
    } catch (error) {
        console.error("❌ Email Test Failed:");
        if (error.response) console.error("Response:", error.response);
        if (error.code) console.error("Code:", error.code);
        console.error(error);
    }
}

testEmail();
