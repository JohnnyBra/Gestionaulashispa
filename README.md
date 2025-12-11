# Guía de Instalación y Puesta en Marcha - Reserva Aulas Hispanidad

Esta guía explica paso a paso cómo instalar esta aplicación en un servidor Ubuntu desde cero. Incluye persistencia de datos en el servidor.

## Requisitos Previos

1.  **Servidor Ubuntu:** Acceso a un servidor (VPS) con Ubuntu 20.04 o superior.
2.  **Dominio (Opcional):** Una cuenta de Cloudflare configurada.

---

## Paso 1: Conectarse al Servidor

Usa una terminal para conectarte a tu servidor:

```bash
ssh root@TU_IP_DEL_SERVIDOR
```

---

## Paso 2: Instalar las herramientas necesarias

Ejecuta estos comandos para instalar Node.js:

```bash
# 1. Actualizar sistema
sudo apt update && sudo apt upgrade -y

# 2. Instalar Node.js 18+
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# 3. Instalar PM2 (Gestor de procesos)
sudo npm install -g pm2
```

---

## Paso 3: Instalar la Aplicación

Sube los archivos a una carpeta (ej. `/root/reservas-hispanidad`) y ejecuta:

```bash
cd /root/reservas-hispanidad

# Instalar dependencias del servidor (express, cors, etc.)
npm install
```

---

## Paso 4: Poner la web en marcha

Ahora usaremos `node` para arrancar el servidor `server.js`, que servirá la web y guardará los datos.

```bash
# Iniciar con PM2 para que no se apague
pm2 start server.js --name "reservas-hispanidad"

# Guardar la configuración para reinicios del servidor
pm2 save
pm2 startup
```
*(Ejecuta el comando que te indique `pm2 startup` si es necesario).*

La aplicación estará corriendo en el puerto **3000**. Los datos de las reservas se guardarán automáticamente en el archivo `bookings.json` en la misma carpeta.

---

## Paso 5: Publicar con Cloudflare

1.  En Cloudflare Zero Trust > Tunnels, crea un túnel y conéctalo a tu servidor.
2.  Añade un Public Hostname:
    *   **Domain:** `reservas.colegiolahispanidad.es`
    *   **Service:** `HTTP` -> `localhost:3000`

---

## Notas de Administración

*   **Usuario Administrador:** Para gestionar bloqueos, inicia sesión con un email que empiece por `admin` o `direccion` (ej: `admin@colegiolahispanidad.es`).
*   **Créditos:** Aplicación desarrollada por Javi Barrero.
