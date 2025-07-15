import sendEmail from "../utils/sendEmail.js";

export const sendGeneralEmail = async (req, res) => {
  const { to, subject, message } = req.body;

  try {
    await sendEmail(to, subject, message);

    res.status(200).json({
      success: true,
      message: "Email sent successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to send email",
      error: error.message,
    });
  }
};
