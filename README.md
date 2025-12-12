# Gestión de Reservas - Cooperativa de Enseñanza La Hispanidad

Aplicación web para la gestión de reservas de aulas (Informática e Idiomas).

## Instalación Automática en Servidor (Ubuntu/Debian)

Sigue estos pasos para desplegar la aplicación en tu servidor VPS.

### 1. Preparación
Conéctate a tu servidor por SSH y asegúrate de estar en una carpeta limpia (o en tu carpeta de usuario home).

### 2. Crear y ejecutar el instalador
Copia y pega el siguiente bloque de comandos en tu terminal. Esto creará el script de instalación y le dará permisos:

```bash
nano install.sh
```

Pega dentro el contenido del archivo `install.sh` de este repositorio. Guarda con `Ctrl+O` y sal con `Ctrl+X`.

Después, ejecuta:

```bash
chmod +x install.sh
sudo ./install.sh
```

### 3. Sigue las instrucciones
El script te pedirá:
1. La **URL de tu repositorio de GitHub**.
2. El **Puerto** donde quieres que funcione la web. **Por defecto usará el 3001** para evitar conflictos con otras aplicaciones en el puerto 3000.

## Configuración de Cloudflare Tunnel

Si tienes otro servicio en el puerto 3000, esta aplicación correrá por defecto en el **3001** (o el que hayas elegido en la instalación).

Debes actualizar la configuración de tu `cloudflared` (en `config.yml` o en el panel Zero Trust):

1. Servicio: `HTTP`
2. URL: `localhost:3001` (o el puerto que hayas configurado).

Si usas el panel web de Cloudflare Zero Trust:
1. Ve a **Access** > **Tunnels**.
2. Configura el **Public Hostname**.
3. Cambia el destino del servicio a `http://localhost:3001`.

## Mantenimiento

### Actualizar la web
Si haces cambios en el código y los subes a GitHub:

```bash
cd nombre-de-tu-repo
git pull
npm install
npm run build
pm2 restart hispanidad-reservas
```

### Cambiar el puerto manualmente
Si necesitas cambiar el puerto una vez instalada la aplicación:

```bash
# Ejemplo para cambiar al puerto 4000
pm2 delete hispanidad-reservas
PORT=4000 pm2 start npm --name "hispanidad-reservas" -- start
pm2 save
```

### Ver estado
Para ver si la aplicación está corriendo:
```bash
pm2 status
```

Para ver los logs (errores o accesos):
```bash
pm2 logs hispanidad-reservas
```

## Desarrollo Local

1. Clonar repositorio.
2. `npm install`
3. `npm start` (Por defecto usa el puerto 3001 si no se especifica otro).
