/**
 * Приём заявок с сайта GLOSSWORK.
 * Каждая заявка: новая строка в таблице + письмо на почту.
 *
 * Куда вставлять: Google Таблица → Расширения → Apps Script → стереть всё → вставить этот код.
 * Меняете только одну строку ниже — свою почту.
 */

const EMAIL = "ВАША_ПОЧТА@gmail.com"; // ← сюда свою Gmail-почту, в кавычках
const SHEET_NAME = "Заявки";           // так будет называться лист в таблице

const HEADERS = ["Дата и время", "Имя", "Телефон", "Машина", "Услуги", "Комментарий", "Откуда"];

/** Сайт присылает заявку сюда. */
function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000); // две заявки в одну секунду не перепутаются
  try {
    const data = JSON.parse((e && e.postData && e.postData.contents) || "{}");
    if (!String(data.name || "").trim() || !String(data.phone || "").trim()) {
      return reply({ ok: false, error: "Нет имени или телефона" });
    }
    const services = Array.isArray(data.service) ? data.service.join(", ") : (data.service || "");
    const row = [
      new Date(),
      clean(data.name),
      clean(data.phone),
      clean(data.car),
      clean(services),
      clean(data.note),
      data.form === "full" ? "Форма записи на сайте" : clean(data.form),
    ];
    sheet().appendRow(row);
    sendMail(row);
    return reply({ ok: true });
  } catch (err) {
    return reply({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

/** Лист «Заявки» с шапкой; создаётся сам при первой заявке. */
function sheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) sh = ss.insertSheet(SHEET_NAME);
  if (sh.getLastRow() === 0) {
    sh.appendRow(HEADERS);
    sh.getRange(1, 1, 1, HEADERS.length).setFontWeight("bold").setBackground("#0f7550").setFontColor("#ffffff");
    sh.setFrozenRows(1);
    sh.setColumnWidth(1, 150);
    sh.setColumnWidths(2, 6, 180);
  }
  return sh;
}

function sendMail(row) {
  const [date, name, phone, car, services, note, from] = row;
  const lines = [
    ["Имя", name],
    ["Телефон", phone],
    ["Машина", car || "не указана"],
    ["Услуги", services || "не выбраны"],
    ["Комментарий", note || "нет"],
    ["Когда", Utilities.formatDate(date, Session.getScriptTimeZone(), "dd.MM.yyyy HH:mm")],
    ["Откуда", from],
  ];
  const html =
    '<div style="font-family:Arial,sans-serif;font-size:15px;color:#111">' +
    '<h2 style="margin:0 0 12px;color:#0f7550">Новая заявка с сайта GLOSSWORK</h2>' +
    '<table cellpadding="6" style="border-collapse:collapse">' +
    lines.map(([k, v]) => '<tr><td style="color:#666">' + k + '</td><td><b>' + escapeHtml(v) + '</b></td></tr>').join("") +
    "</table>" +
    '<p style="margin-top:16px"><a href="' + SpreadsheetApp.getActiveSpreadsheet().getUrl() + '">Открыть таблицу заявок</a></p>' +
    "</div>";
  MailApp.sendEmail({
    to: EMAIL,
    subject: "Заявка GLOSSWORK: " + name + ", " + phone,
    htmlBody: html,
    name: "Сайт GLOSSWORK",
  });
}

/** Обрезаем слишком длинное и не даём тексту притвориться формулой таблицы. */
function clean(v) {
  const s = String(v == null ? "" : v).trim().slice(0, 1000);
  return /^[=+\-@]/.test(s) ? "'" + s : s;
}

function escapeHtml(v) {
  return String(v).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
}

function reply(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

/**
 * Проверка: выберите эту функцию вверху и нажмите «Выполнить».
 * В таблице появится тестовая строка, на почту придёт письмо.
 * Тестовую строку потом просто удалите.
 */
function test() {
  const res = doPost({
    postData: {
      contents: JSON.stringify({
        name: "Тест", phone: "+7 (900) 000-00-00", car: "BMW M4",
        service: ["Мойка пеной", "Кварц"], note: "Проверка связи", form: "full",
      }),
    },
  });
  Logger.log(res.getContent());
}
