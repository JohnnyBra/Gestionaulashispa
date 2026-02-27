# Aulas — Gestión de Reservas de Espacios y Recursos Tecnológicos

Aplicación web progresiva (PWA) para la gestión de reservas del aula de informática y los carros de portátiles, con seguimiento de incidencias técnicas. Forma parte de la Suite Educativa La Hispanidad.

> **Acceso:** Exclusivo para profesorado y administración. Los datos de usuarios y clases se sincronizan automáticamente desde PrismaEdu.

---

## 🚀 Funcionalidades por Público

### 👨‍🏫 Profesorado

- **Dashboard de reservas**
  - Vista resumen de las próximas reservas propias
  - Selección rápida de etapa (Primaria / Secundaria) con indicador de huecos libres disponibles

- **Calendario de reservas**
  - Cuadrícula semanal: días de la semana × franjas horarias
  - Color por estado: libre (verde) · reservado (rojo) · bloqueado (gris)
  - Ver detalles de cualquier reserva: docente, curso, asignatura, justificación y plan de asientos

- **Crear y gestionar reservas**
  - Reservar especificando etapa, recurso (aula o carro), curso, asignatura y justificación
  - Soporte para reservas recurrentes (repetición semanal)
  - Plan de asientos integrado: asignar alumnos a puestos concretos
  - Editar y cancelar reservas propias

- **Traspasos de reserva**
  - Solicitar el traspaso de una reserva a otro docente
  - Confirmación por correo electrónico (aceptar / rechazar)

- **Incidencias técnicas**
  - Reportar problemas con descripción, recurso afectado y número de PC
  - Ver el historial de incidencias propias

**Franjas horarias disponibles:**

| Primaria | Horario | Secundaria | Horario |
|----------|---------|------------|---------|
| P1 | 09:00 - 10:00 | S1 | 08:00 - 09:00 |
| P2 | 10:00 - 11:00 | S2 | 09:00 - 10:00 |
| P3 | 11:30 - 12:30 | S3 | 10:00 - 11:00 |
| P4 | 12:30 - 14:00 | S4 | 11:30 - 12:30 |
| | | S5 | 12:30 - 13:30 |
| | | S6 | 13:30 - 14:30 |

---

### 🏫 Dirección / Administración

Todo lo del profesorado, más:

- **Gestión avanzada de reservas**
  - Ver y administrar reservas de cualquier docente
  - Bloquear y desbloquear franjas horarias para impedir nuevas reservas
  - Eliminar cualquier reserva del sistema

- **Gestión de incidencias**
  - Marcar incidencias como resueltas
  - Ver el historial completo de todas las incidencias del centro
  - Recibir informes periódicos de incidencias por correo electrónico (cron semanal)

- **Administración del sistema**
  - Forzar sincronización con PrismaEdu
  - Probar la configuración de correo electrónico
  - Consultar el registro de auditoría (historial de acciones)

---

## ⚙️ Características Técnicas

- **Frontend:** React 18 + TypeScript, Tailwind CSS
- **Backend:** Express.js (Node.js, CommonJS)
- **Tiempo real:** Socket.IO para propagación de cambios a todos los clientes
- **Sincronización:** Socket.IO conectado a PrismaEdu para sincronizar usuarios, clases y alumnos
- **Email:** Nodemailer (Gmail SMTP) para traspasos e informes de incidencias
- **PDF:** jsPDF + jspdf-autotable
- **Datos:** Archivos JSON en disco (sin base de datos)
- **Despliegue:** PM2 en Ubuntu/Debian

---

## Requisitos Previos

Antes de empezar, asegúrate de tener instalado **Node.js** (versión 18 o superior) y **Git** en tu servidor.

Si estás en un servidor Ubuntu/Debian nuevo, ejecuta esto primero:

```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs git build-essential
```

---

## Instalación Desde Cero

Sigue estos pasos para desplegar la aplicación por primera vez:

1.  **Clona el repositorio** (Sustituye la URL por la de tu repositorio):
    ```bash
    git clone https://github.com/TU_USUARIO/TU_REPOSITORIO.git reservas
    ```

2.  **Entra en la carpeta**:
    ```bash
    cd reservas
    ```

3.  **Dale permisos de ejecución al instalador**:
    ```bash
    chmod +x install.sh
    ```

4.  **Ejecuta el instalador**:
    ```bash
    ./install.sh
    ```

El script te guiará preguntando el **puerto** (por defecto 3001) y configurará todo automáticamente (dependencias, construcción y arranque con PM2).

---

## Actualización

Cuando hagas cambios en el código y los subas a GitHub, solo tienes que entrar en el servidor y volver a ejecutar el script. Él detectará que ya está instalada y solo actualizará:

```bash
cd reservas
./install.sh
```

El script se encargará de:
1. Descargar los cambios (`git pull`).
2. Actualizar librerías (`npm install`).
3. Reconstruir la web (`npm run build`).
4. Reiniciar el servidor sin caídas.

---

## Configuración Técnica

### Cloudflare Tunnel (Recomendado)
Si usas Cloudflare Tunnel para exponer la web:
1. Servicio: `HTTP`
2. URL: `localhost:3001` (o el puerto que hayas elegido).

### Comandos Útiles

- **Ver estado del servidor:**
  ```bash
  pm2 status
  ```

- **Ver logs (errores/actividad):**
  ```bash
  pm2 logs hispanidad-reservas
  ```

- **Detener el servidor:**
  ```bash
  pm2 stop hispanidad-reservas
  ```
