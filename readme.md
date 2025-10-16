# Webhook de Estado de Servidor Minecraft para Discord

Bot automático que monitorea el estado de tu servidor de Minecraft y actualiza un mensaje en Discord con el estado actual.

## Características

- ✅ **Actualización automática**: Verifica el estado del servidor cada X segundos
- ✅ **Persistencia de mensajes**: Mantiene el mismo mensaje en Discord entre reinicios
- ✅ **Resolución SRV**: Resuelve automáticamente registros SRV de DNS
- ✅ **Estado persistente**: Guarda el ID del mensaje en archivo para no perderlo
- ✅ **Limpieza automática**: Elimina el mensaje anterior antes de crear uno nuevo
- ✅ **API REST**: Endpoints disponibles para consultas manuales
- ✅ **Configuración externa**: Archivo de configuración separado no incluido en Git

## Instalación

1. **Clonar el repositorio** (o descargar los archivos)

2. **Instalar dependencias**:
```powershell
& "C:\Program Files\nodejs\npm.cmd" install
```

O si tienes Node.js en el PATH:
```bash
npm install
```

## Configuración

1. **Crear archivo de configuración**:
   Copia `config.example.json` a `config.json`:
   ```powershell
   Copy-Item config.example.json config.json
   ```

2. **Editar `config.json`** con tus valores:
   ```json
   {
     "DISCORD_WEBHOOK_URL": "https://discord.com/api/webhooks/TU_WEBHOOK_ID/TU_WEBHOOK_TOKEN",
     "MINECRAFT_DOMAIN": "mc.tuservidor.com",
     "UPDATE_INTERVAL": 30000,
     "DEBUG": false
   }
   ```

### Configuración explicada:
- **DISCORD_WEBHOOK_URL**: URL del webhook de tu canal de Discord
- **MINECRAFT_DOMAIN**: Dominio de tu servidor de Minecraft (con registro SRV)
- **UPDATE_INTERVAL**: Intervalo de actualización en milisegundos
- **DEBUG**: Mostrar información de depuración (true/false)

### Intervalos de actualización sugeridos:
- `30000` = 30 segundos
- `60000` = 1 minuto
- `300000` = 5 minutos
- `600000` = 10 minutos

## Uso

### Iniciar el bot

```powershell
& "C:\Program Files\nodejs\node.exe" server.js
```

O si tienes Node.js en el PATH:
```bash
node server.js
```

### Funcionamiento automático

Una vez iniciado, el bot:
1. ✅ Carga el estado anterior (si existe)
2. ✅ Verifica el estado del servidor inmediatamente
3. ✅ Envía/actualiza el mensaje en Discord
4. ✅ Continúa actualizando cada X segundos automáticamente

### API Endpoints (opcional)

El bot expone algunos endpoints HTTP para consultas manuales:

#### `GET /health`
Verifica que el webhook está funcionando y muestra la configuración.

```bash
curl http://localhost:3000/health
```

#### `GET /status/:domain`
Obtiene el estado de cualquier servidor (respuesta JSON).

```bash
curl http://localhost:3000/status/mc.example.com
```

#### `GET /discord/:domain`
Fuerza una actualización en Discord para cualquier dominio.

```bash
curl http://localhost:3000/discord/mc.example.com
```

## Archivos

- `server.js` - Código principal del bot
- `package.json` - Dependencias del proyecto
- `message-state.json` - Estado persistente (ID del último mensaje)
- `.gitignore` - Archivos a ignorar en Git

## Características técnicas

### Persistencia de estado

El bot guarda el ID del último mensaje en `message-state.json`:

```json
{
  "lastMessageId": "1234567890",
  "lastUpdate": "2025-10-16T10:30:00.000Z"
}
```

Esto permite que:
- ✅ El bot recuerde el mensaje anterior después de reiniciarse
- ✅ No se creen mensajes duplicados
- ✅ El mensaje se actualice en lugar de crear nuevos

### Resolución SRV

El bot resuelve automáticamente registros SRV del formato:
```
_minecraft._tcp.tu-dominio.com
```

### Verificación de conexión

Realiza una conexión TCP directa al servidor para verificar:
- ✅ Si el servidor está online/offline
- ✅ Latencia de conexión
- ✅ IP y puerto resueltos

## Personalización del mensaje

Puedes personalizar el embed de Discord editando la función `sendDiscordMessage` en `server.js`:

```javascript
let embed = {
    title: `ESTADO SERVIDOR MINECRAFT`,
    color: serverStatus.online ? 65280 : 16711680, // Verde/Rojo
    description: serverStatus.online ? ` 🟢 ONLINE` : `🔴 OFFLINE`,
    fields: [
        // Tus campos personalizados aquí
    ],
    footer: {
        text: "Tu texto personalizado"
    }
};
```

## Debug

Activa el modo debug para ver el payload JSON enviado a Discord:

```javascript
debug = true; // En la línea 15 de server.js
```

## Logs

El bot muestra logs detallados en la consola:
- 📂 Carga/guardado de estado
- 🔍 Resolución de DNS SRV
- 🌐 Conexiones al servidor de Minecraft
- 🗑️ Eliminación de mensajes anteriores
- ✅ Creación/actualización de mensajes en Discord

## Troubleshooting

### El mensaje no aparece en Discord
- Verifica que la URL del webhook sea correcta
- Revisa los logs en la consola para ver errores
- Activa el modo debug para ver el payload enviado

### El bot no detecta el mensaje anterior
- Verifica que exista el archivo `message-state.json`
- Revisa que tenga el formato JSON correcto
- Si el mensaje fue eliminado manualmente de Discord, elimina `message-state.json` y reinicia

### Errores de DNS SRV
- Verifica que tu dominio tenga un registro SRV configurado
- Formato: `_minecraft._tcp.tu-dominio.com`
- El registro debe apuntar al servidor correcto

## Licencia

MIT

## Contribuciones

¡Las contribuciones son bienvenidas! Siéntete libre de abrir issues o pull requests.
