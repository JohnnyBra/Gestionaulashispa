const nodemailer = require('nodemailer');
const cron = require('node-cron');
const fs = require('fs');
const path = require('path');
const { format, subDays } = require('date-fns');

const INCIDENTS_FILE = path.join(__dirname, '../incidents.json');

const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: parseInt(process.env.EMAIL_PORT || '465'),
    secure: process.env.EMAIL_SECURE === 'true',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

const sendEmail = async (to, subject, html) => {
    try {
        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: to,
            subject: subject,
            html: html
        };
        const info = await transporter.sendMail(mailOptions);
        console.log(`📧 [EMAIL] Enviado a ${to} | Asunto: ${subject} | ID: ${info.messageId}`);
        return info;
    } catch (error) {
        console.error(`❌ [EMAIL] Error enviando a ${to}:`, error);
        throw error;
    }
};

const sendSwapRequestEmail = async (to, requesterName, requesterEmail, reason, bookingInfo, confirmLink) => {
    const htmlContent = `
        <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #e2e8f0; border-radius: 10px; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #1e293b;">Solicitud de cambio de reserva</h2>
            <p>Hola,</p>
            <p>El compañero/a <strong>${requesterName}</strong> (${requesterEmail}) está interesado/a en tu reserva y solicita si puedes cedérsela.</p>

            <div style="background-color: #f8fafc; padding: 15px; border-radius: 8px; margin: 20px 0;">
                <h3 style="margin-top: 0; color: #334155; font-size: 16px;">Detalles de la reserva:</h3>
                <ul style="list-style: none; padding: 0; margin: 0; color: #475569;">
                    <li style="margin-bottom: 5px;">📅 <strong>Fecha:</strong> ${bookingInfo.date}</li>
                    <li style="margin-bottom: 5px;">⏰ <strong>Horario:</strong> ${bookingInfo.slotLabel}</li>
                    <li style="margin-bottom: 5px;">🏫 <strong>Recurso:</strong> ${bookingInfo.resourceName}</li>
                </ul>
            </div>

            <div style="background-color: #fff1f2; padding: 15px; border-radius: 8px; margin: 20px 0; border: 1px solid #fecdd3;">
                <p style="margin: 0; font-weight: bold; color: #9f1239;">Motivo de la solicitud:</p>
                <p style="margin-top: 5px; color: #881337;">"${reason}"</p>
            </div>

            <p>Si estás de acuerdo en ceder tu hora, haz clic en el siguiente botón. <strong>Esto eliminará tu reserva inmediatamente</strong> y avisará al solicitante para que pueda reservar.</p>

            <div style="text-align: center; margin: 30px 0;">
                <a href="${confirmLink}" style="background-color: #0f172a; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">Aceptar y Ceder Reserva</a>
            </div>

            <p style="font-size: 12px; color: #64748b; margin-top: 30px; text-align: center;">Si no deseas cederla, simplemente ignora este correo.</p>
        </div>
    `;
    return sendEmail(to, `[Solicitud] Cambio de reserva - ${bookingInfo.date}`, htmlContent);
};

const sendSwapReleasedEmail = async (to, ownerName, bookingInfo) => {
    const htmlContent = `
        <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #e2e8f0; border-radius: 10px; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #059669;">¡Reserva Disponible!</h2>
            <p>Hola,</p>
            <p>El compañero/a <strong>${ownerName}</strong> ha aceptado tu solicitud y ha liberado su reserva.</p>

            <div style="background-color: #f0fdf4; padding: 15px; border-radius: 8px; margin: 20px 0; border: 1px solid #bbf7d0;">
                <h3 style="margin-top: 0; color: #166534; font-size: 16px;">Ya puedes reservar:</h3>
                <ul style="list-style: none; padding: 0; margin: 0; color: #14532d;">
                    <li style="margin-bottom: 5px;">📅 <strong>Fecha:</strong> ${bookingInfo.date}</li>
                    <li style="margin-bottom: 5px;">⏰ <strong>Horario:</strong> ${bookingInfo.slotLabel}</li>
                    <li style="margin-bottom: 5px;">🏫 <strong>Recurso:</strong> ${bookingInfo.resourceName}</li>
                </ul>
            </div>

            <p>Entra en la aplicación lo antes posible para formalizar tu reserva.</p>

            <div style="text-align: center; margin: 30px 0;">
                <a href="https://reservas.bibliohispa.es" style="background-color: #059669; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">Ir a la Aplicación</a>
            </div>
        </div>
    `;
    return sendEmail(to, `[Confirmada] Reserva liberada - ${bookingInfo.date}`, htmlContent);
};

const sendWeeklyReport = async () => {
    try {
        console.log('📧 [REPORT] Generando reporte semanal de incidencias...');

        if (!fs.existsSync(INCIDENTS_FILE)) {
            console.log('ℹ️ [REPORT] No se encontró el archivo de incidencias.');
            return;
        }

        const rawData = fs.readFileSync(INCIDENTS_FILE, 'utf8');
        let incidents = [];
        try {
            incidents = JSON.parse(rawData);
        } catch (e) {
            console.error('❌ [REPORT] Error parseando JSON de incidencias:', e);
            return;
        }

        const now = new Date();
        const sevenDaysAgo = subDays(now, 7);

        // Filter: Unresolved OR Recent (last 7 days)
        const relevantIncidents = incidents.filter(inc => {
            const isUnresolved = !inc.isResolved;
            const isRecent = new Date(inc.timestamp) >= sevenDaysAgo;
            return isUnresolved || isRecent;
        });

        if (relevantIncidents.length === 0) {
            console.log('✅ [REPORT] No hay incidencias relevantes para enviar.');
            return;
        }

        // Sort: Pending first, then by date (newest first)
        relevantIncidents.sort((a, b) => {
            if (a.isResolved === b.isResolved) {
                return b.timestamp - a.timestamp;
            }
            return a.isResolved ? 1 : -1; // Resolved (true) comes after Unresolved (false)
        });

        const tableRows = relevantIncidents.map(inc => {
            const statusColor = inc.isResolved ? 'green' : 'red';
            const statusText = inc.isResolved ? 'Resuelta' : 'Pendiente';
            const dateStr = format(new Date(inc.timestamp), 'dd/MM HH:mm');
            const resourceStr = inc.resource + (inc.pcNumber ? ` (PC ${inc.pcNumber})` : '');

            return `
                <tr>
                    <td style="color: ${statusColor}; font-weight: bold;">${statusText}</td>
                    <td>${dateStr}</td>
                    <td>${resourceStr}</td>
                    <td>${inc.teacherName || 'N/A'}</td>
                    <td>${inc.description || ''}</td>
                </tr>
            `;
        }).join('');

        const htmlContent = `
            <h2>Resumen Semanal de Incidencias TIC</h2>
            <p>Se han encontrado <strong>${relevantIncidents.length}</strong> incidencias relevantes (pendientes o de los últimos 7 días).</p>
            <table border="1" cellpadding="8" cellspacing="0" style="border-collapse: collapse; width: 100%;">
                <thead>
                    <tr style="background-color: #f2f2f2;">
                        <th>Estado</th>
                        <th>Fecha</th>
                        <th>Recurso</th>
                        <th>Profesor</th>
                        <th>Descripción</th>
                    </tr>
                </thead>
                <tbody>
                    ${tableRows}
                </tbody>
            </table>
            <p><em>Este es un correo automático.</em></p>
        `;

        await sendEmail(process.env.EMAIL_TO, `[TIC] Resumen de Incidencias - ${format(now, 'dd/MM/yyyy')}`, htmlContent);

    } catch (error) {
        console.error('❌ [REPORT] Error enviando reporte:', error);
        throw error;
    }
};

const initScheduler = () => {
    // Schedule for Friday at 11:00
    cron.schedule('0 11 * * 5', () => {
        console.log('⏰ [SCHEDULER] Ejecutando tarea programada: Reporte Semanal');
        sendWeeklyReport();
    });
    console.log('✅ [SCHEDULER] Servicio de reportes inicializado (Viernes 11:00)');
};

module.exports = {
    sendEmail,
    sendSwapRequestEmail,
    sendSwapReleasedEmail,
    sendWeeklyReport,
    initScheduler
};
