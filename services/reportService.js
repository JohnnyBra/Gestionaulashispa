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

        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: process.env.EMAIL_TO,
            subject: `[TIC] Resumen de Incidencias - ${format(now, 'dd/MM/yyyy')}`,
            html: htmlContent
        };

        const info = await transporter.sendMail(mailOptions);
        console.log(`✅ [REPORT] Correo enviado: ${info.messageId}`);
        return info;

    } catch (error) {
        console.error('❌ [REPORT] Error enviando reporte:', error);
        throw error;
    }
};

const initScheduler = () => {
    // Schedule for Friday at 14:00
    cron.schedule('0 14 * * 5', () => {
        console.log('⏰ [SCHEDULER] Ejecutando tarea programada: Reporte Semanal');
        sendWeeklyReport();
    });
    console.log('✅ [SCHEDULER] Servicio de reportes inicializado (Viernes 14:00)');
};

module.exports = {
    sendWeeklyReport,
    initScheduler
};
