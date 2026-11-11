const AppSettings = require("../models/AppSettings");
const User = require("../models/User");
const { sendEmail } = require("./email");
const { dayjs, APP_TZ } = require("./dateTime");

async function notifyTimeRecord({ userId, mode, note, reason, action, at }) {
  try {
    const settings = await AppSettings.findOne({ key: "global" }).lean();
    const recipients = settings?.leaveNotificationEmails || [];
    if (!recipients.length) return;
    const user = await User.findById(userId).select("username fullName").lean();
    const username = user?.fullName || user?.username || "Dipendente";
    const when = dayjs(at).tz(APP_TZ).format("DD/MM/YYYY HH:mm");
    const subject = `Office Clocking - ${mode === "offsite" ? "Timbratura fuori sede" : "Nota timbratura"} - ${username}`;
    await sendEmail({
      to: recipients,
      subject,
      text: [
        "Nuova comunicazione relativa a una timbratura.", "",
        `Dipendente: ${username}`, `Operazione: ${action}`,
        `Data e ora: ${when}`,
        `Modalità: ${mode === "offsite" ? "Fuori sede" : "In sede"}`,
        ...(mode === "offsite" ? [`Motivazione fuori sede: ${reason}`] : []),
        ...(note ? [`Nota: ${note}`] : []), "",
        "Consulta il dettaglio in Office Clocking.",
      ].join("\n"),
    });
  } catch (error) {
    console.error("Errore invio email timbratura (timbratura già salvata):", error);
  }
}

function scheduleTimeRecordEmail(payload) {
  setImmediate(() => {
    notifyTimeRecord(payload).catch(error => console.error("Errore notifica timbratura:", error));
  });
}

module.exports = { notifyTimeRecord, scheduleTimeRecordEmail };
