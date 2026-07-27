const nodemailer = require("nodemailer");

function isEmailConfigured() {
  return Boolean(
    process.env.SMTP_HOST &&
      process.env.SMTP_PORT &&
      process.env.SMTP_USER &&
      process.env.SMTP_PASS &&
      process.env.SMTP_FROM
  );
}

function getSmtpTimeoutMs() {
  const timeoutMs = Number(process.env.SMTP_TIMEOUT_MS);

  if (Number.isFinite(timeoutMs) && timeoutMs > 0) {
    return timeoutMs;
  }

  return 10000;
}

function createTransporter() {
  const timeoutMs = getSmtpTimeoutMs();

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    secure: String(process.env.SMTP_SECURE).toLowerCase() === "true",
    connectionTimeout: timeoutMs,
    greetingTimeout: timeoutMs,
    socketTimeout: timeoutMs,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

async function sendEmail({ to, subject, text }) {
  if (!Array.isArray(to) || to.length === 0) {
    return {
      skipped: true,
      reason: "NO_RECIPIENTS",
    };
  }

  if (!isEmailConfigured()) {
    console.warn(
      "Email non inviata: configurazione SMTP mancante o incompleta"
    );

    return {
      skipped: true,
      reason: "SMTP_NOT_CONFIGURED",
    };
  }

  const transporter = createTransporter();

  await transporter.sendMail({
    from: process.env.SMTP_FROM,
    to,
    subject,
    text,
  });

  return {
    skipped: false,
  };
}

module.exports = {
  sendEmail,
  isEmailConfigured,
};