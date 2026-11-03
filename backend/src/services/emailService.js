
const nodemailer = require("nodemailer");

function createEmailService() {
  const frontendUrl =
    process.env.FRONTEND_URL || "http://127.0.0.1:5173";

  const from =
    process.env.EMAIL_FROM ||
    "Task Manager <no-reply@taskmanager.local>";

  const smtpConfigured = Boolean(process.env.SMTP_HOST);

  const transporter = smtpConfigured
    ? nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT || 587),
        secure: process.env.SMTP_SECURE === "true",
        auth: process.env.SMTP_USER
          ? {
              user: process.env.SMTP_USER,
              pass: process.env.SMTP_PASSWORD,
            }
          : undefined,
      })
    : null;

  async function sendRegistrationConfirmation({
    email,
    name,
    token,
  }) {
    const confirmationUrl =
      `${frontendUrl}/?confirm=${encodeURIComponent(token)}`;

    if (!transporter) {
      console.log(
        `Registration confirmation for ${email}: ${confirmationUrl}`
      );

      return {
        delivery: "development-log",
        email,
        name,
      };
    }

    await transporter.sendMail({
      from,
      to: email,
      subject: "Confirm your Task Manager account",
      text: `Hi ${name}, confirm your account: ${confirmationUrl}`,
      html:
        `<p>Hi ${name},</p>` +
        `<p><a href="${confirmationUrl}">` +
        `Confirm your Task Manager account</a>.</p>`,
    });

    return {
      delivery: "smtp",
      email,
    };
  }

  async function sendOverdueTaskReminder({
    email,
    name,
    taskTitle,
    dueDate,
  }) {
    const formattedDueDate = new Date(
      dueDate
    ).toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata",
      dateStyle: "medium",
      timeStyle: "short",
    });

    const subject = `Overdue high-priority task: ${taskTitle}`;

    const text = [
      `Hi ${name || "there"},`,
      "",
      "You have an overdue high-priority task.",
      "",
      `Task: ${taskTitle}`,
      `Due date: ${formattedDueDate}`,
      "",
      `Open Task Manager: ${frontendUrl}`,
      "",
      "Please review and update this task.",
    ].join("\n");

    if (!transporter) {
      console.log(`[DEV EMAIL] Overdue reminder for ${email}`);
      console.log(text);

      return {
        delivery: "development-log",
        email,
      };
    }

    await transporter.sendMail({
      from,
      to: email,
      subject,
      text,
    });

    return {
      delivery: "smtp",
      email,
    };
  }

  return {
    sendRegistrationConfirmation,
    sendOverdueTaskReminder,
  };
}

module.exports = createEmailService;
