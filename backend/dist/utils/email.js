"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendEmail = void 0;
const nodemailer_1 = __importDefault(require("nodemailer"));
const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '587');
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const SMTP_FROM = process.env.SMTP_FROM || 'no-reply@docflow.com';
let transporter = null;
if (SMTP_HOST && SMTP_USER && SMTP_PASS) {
    transporter = nodemailer_1.default.createTransport({
        host: SMTP_HOST,
        port: SMTP_PORT,
        secure: SMTP_PORT === 465,
        auth: {
            user: SMTP_USER,
            pass: SMTP_PASS,
        },
    });
}
const sendEmail = async ({ to, subject, text, html }) => {
    if (transporter) {
        try {
            await transporter.sendMail({
                from: `"DocFlow" <${SMTP_FROM}>`,
                to,
                subject,
                text,
                html: html || text.replace(/\n/g, '<br>'),
            });
            console.log(`[Email] Envoi réussi à ${to} : "${subject}"`);
        }
        catch (error) {
            console.error(`[Email Error] Échec de l'envoi d'e-mail à ${to} :`, error);
        }
    }
    else {
        // Mock Mode in Console
        console.log('\n================== EMAIL MOCK ==================');
        console.log(`De : "DocFlow" <${SMTP_FROM}>`);
        console.log(`À : ${to}`);
        console.log(`Sujet : ${subject}`);
        console.log(`Date : ${new Date().toLocaleString('fr-FR')}`);
        console.log('------------------------------------------------');
        console.log(text);
        console.log('================================================\n');
    }
};
exports.sendEmail = sendEmail;
//# sourceMappingURL=email.js.map