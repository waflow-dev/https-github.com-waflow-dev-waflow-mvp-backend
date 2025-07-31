import nodemailer from "nodemailer";

const sendEmail = async (to, subject, text) => {
  try {
    // Check if email credentials are configured
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      console.log("⚠️ Email credentials not configured. Skipping email send.");
      console.log("📧 Would send email to:", to);
      console.log("📧 Subject:", subject);
      console.log("📧 Content:", text);
      return; // Don't throw error, just log and continue
    }

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to,
      subject,
      text,
    };

    await transporter.sendMail(mailOptions);
    console.log("✅ Email sent successfully");
  } catch (error) {
    console.error("🔴 Error sending email:", error.message);
    console.log("📧 Would send email to:", to);
    console.log("📧 Subject:", subject);
    console.log("📧 Content:", text);
    // Don't throw error for now, just log it
    // throw error;
  }
};

export default sendEmail;
