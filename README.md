# Gestión de Reservas - Cooperativa de Enseñanza La Hispanidad

Aplicación web progresiva (PWA) para la gestión de reservas de espacios (Aulas de Informática, Idiomas, Carros de portátiles, etc.).

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
