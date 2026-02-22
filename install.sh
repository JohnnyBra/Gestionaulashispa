#!/bin/bash

# Colores para los mensajes
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}====================================================${NC}"
echo -e "${BLUE}   INSTALADOR DE RESERVAS LA HISPANIDAD   ${NC}"
echo -e "${BLUE}====================================================${NC}"

# 1. Comprobación de entorno
echo -e "\n${YELLOW}[1/6] Comprobando entorno...${NC}"

if ! command -v node &> /dev/null; then
    echo "❌ Node.js no está instalado. Por favor instálalo primero."
    exit 1
fi

if ! command -v npm &> /dev/null; then
    echo "❌ NPM no está instalado."
    exit 1
fi

# Instalar PM2 globalmente si no existe
if ! command -v pm2 &> /dev/null; then
    echo "📦 Instalando PM2 globalmente..."
    sudo npm install -g pm2
fi

# 2. Configuración (.env)
echo -e "\n${YELLOW}[2/6] Configuración...${NC}"
ENV_FILE=".env"

if [ -f "$ENV_FILE" ]; then
    echo "✅ Archivo de configuración .env encontrado."
    # Cargar variables actuales para usarlas si es necesario
    export $(cat .env | xargs)
else
    echo "⚠️  No se encontró configuración previa."
    read -p "Introduce el PUERTO para la web [3001]: " PORT_INPUT
    PORT=${PORT_INPUT:-3001}
    
    echo "PORT=$PORT" > $ENV_FILE
    read -p "Introduce el API_SECRET de Prisma: " API_SECRET_INPUT
    echo "API_SECRET=${API_SECRET_INPUT}" >> $ENV_FILE
    echo "✅ Configuración guardada en .env"
fi

# 3. Actualización de Código
echo -e "\n${YELLOW}[3/6] Sincronizando repositorio...${NC}"
git pull origin main
if [ $? -ne 0 ]; then
    echo "⚠️  Hubo un problema con git pull, pero continuamos..."
fi

# 4. Instalación de Dependencias
echo -e "\n${YELLOW}[4/6] Instalando dependencias...${NC}"
npm install

# 5. Construcción del Frontend
echo -e "\n${YELLOW}[5/6] Construyendo aplicación (Build)...${NC}"
npm run build

# 6. Gestión del Proceso PM2
echo -e "\n${YELLOW}[6/6] Gestionando proceso PM2...${NC}"

APP_NAME="hispanidad-reservas"
PM2_ID=$(pm2 list | grep "$APP_NAME" | awk '{print $4}')

if [ -z "$PM2_ID" ]; then
    echo "🚀 Iniciando servidor por primera vez..."
    # Cargar variables del .env para el inicio
    source .env
    pm2 start server.js --name "$APP_NAME" --time
else
    echo "🔄 Reiniciando servidor..."
    pm2 reload "$APP_NAME"
fi

# Guardar lista de procesos para que se inicie al reiniciar el servidor
pm2 save

echo -e "\n${GREEN}====================================================${NC}"
echo -e "${GREEN}   ¡INSTALACIÓN/ACTUALIZACIÓN COMPLETADA!   ${NC}"
echo -e "${GREEN}====================================================${NC}"
echo -e "La aplicación está corriendo en el puerto: ${PORT:-3001}"
echo -e "Para ver logs: pm2 logs $APP_NAME"
