const nodemailer = require("nodemailer");

function createEmailService() {
  const frontendUrl = process.env.FRONTEND_URL || "http://127.0.0.1:5173";
  const from = process.env.EMAIL_FROM || "Task Manager <no-reply@taskmanager.local>";

  if (!process.env.SMTP_HOST) {
    return {
      async sendRegistrationConfirmation({ email, name, token }) {
        const confirmationUrl = `${frontendUrl}/?confirm=${encodeURIComponent(token)}`;
        console.log(`Registration confirmation for ${email}: ${confirmationUrl}`);
        return { delivery: "development-log", email, name };
      },
    };
  }

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === "true",
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
      : undefined,
  });

  return {
    async sendRegistrationConfirmation({ email, name, token }) {
      const confirmationUrl = `${frontendUrl}/?confirm=${encodeURIComponent(token)}`;
      await transporter.sendMail({
        from,
        to: email,
        subject: "Confirm your Task Manager account",
        text: `Hi ${name}, confirm your account: ${confirmationUrl}`,
        html: `<p>Hi ${name},</p><p><a href="${confirmationUrl}">Confirm your Task Manager account</a>.</p>`,
      });
      return { delivery: "smtp", email };
    },
  };
}

module.exports = createEmailService;
