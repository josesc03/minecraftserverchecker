const express = require('express');
const dns = require('dns').promises;
const net = require('net');
const https = require('https');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Cargar configuración desde archivo config.json
let config;
try {
    const configPath = path.join(__dirname, 'config.json');
    if (!fs.existsSync(configPath)) {
        console.error('❌ Error: Archivo config.json no encontrado. Copia config.example.json a config.json y configúralo.');
        process.exit(1);
    }
    config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    console.log('✅ Configuración cargada correctamente');
} catch (error) {
    console.error('❌ Error cargando configuración:', error.message);
    process.exit(1);
}

// URL del webhook de Discord
const DISCORD_WEBHOOK_URL = config.DISCORD_WEBHOOK_URL;

// Configuración
const debug = config.DEBUG || false; // Cambia a true para ver el payload JSON enviado a Discord
const MINECRAFT_DOMAIN = config.MINECRAFT_DOMAIN;
const UPDATE_INTERVAL = config.UPDATE_INTERVAL || 30000; // 30 segundos por defecto
const STATE_FILE = path.join(__dirname, 'message-state.json');

// Variable para almacenar el ID del último mensaje enviado
let lastMessageId = null;

// Función para cargar el estado desde el archivo
function loadState() {
    try {
        if (fs.existsSync(STATE_FILE)) {
            const data = fs.readFileSync(STATE_FILE, 'utf8');
            const state = JSON.parse(data);
            lastMessageId = state.lastMessageId;
            if (lastMessageId) {
                console.log(`📂 Estado cargado: Mensaje anterior encontrado (ID: ${lastMessageId})`);
            } else {
                console.log(`📂 Estado cargado: No hay mensaje anterior`);
            }
        } else {
            console.log(`📂 Archivo de estado no encontrado, creando uno nuevo...`);
            saveState();
        }
    } catch (error) {
        console.error('⚠️ Error cargando estado:', error.message);
        lastMessageId = null;
    }
}

// Función para guardar el estado en el archivo
function saveState() {
    try {
        const state = {
            lastMessageId: lastMessageId,
            lastUpdate: new Date().toISOString()
        };
        fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf8');
        console.log(`💾 Estado guardado: ${lastMessageId ? `Mensaje ID: ${lastMessageId}` : 'Sin mensaje'}`);
    } catch (error) {
        console.error('⚠️ Error guardando estado:', error.message);
    }
}

// Middleware para parsear JSON
app.use(express.json());

// Función para resolver el registro SRV
async function resolveSRV(domain) {
    try {
        console.log(`Resolviendo SRV para: _minecraft._tcp.${domain}`);
        const records = await dns.resolveSrv(`_minecraft._tcp.${domain}`);
        if (records && records.length > 0) {
            console.log('Registro SRV encontrado:', records[0]);
            return {
                host: records[0].name,
                port: records[0].port
            };
        }
        console.log('No se encontraron registros SRV');
        return null;
    } catch (error) {
        console.error('Error resolviendo SRV:', error.message);
        return null;
    }
}

// Función para verificar el estado del servidor de Minecraft
async function checkMinecraftServer(host, port) {
    return new Promise((resolve) => {
        console.log(`Verificando servidor ${host}:${port}`);
        const socket = new net.Socket();
        const startTime = Date.now();
        
        socket.setTimeout(5000);
        
        socket.connect(port, host, () => {
            const latency = Date.now() - startTime;
            console.log(`Conexión exitosa a ${host}:${port} (${latency}ms)`);
            socket.destroy();
            resolve({
                online: true,
                players: { online: 0, max: 0 },
                version: 'Desconocida',
                motd: 'Servidor activo (conexión exitosa)',
                latency: latency
            });
        });
        
        socket.on('error', (error) => {
            console.log(`Error conectando a ${host}:${port}: ${error.message}`);
            socket.destroy();
            resolve({
                online: false,
                error: `Error de conexión: ${error.message}`
            });
        });
        
        socket.on('timeout', () => {
            console.log(`Timeout conectando a ${host}:${port}`);
            socket.destroy();
            resolve({
                online: false,
                error: 'Timeout de conexión (5 segundos)'
            });
        });
    });
}

// Función para enviar mensaje a Discord
// Función para eliminar el mensaje anterior
async function deleteLastMessage() {
    if (!lastMessageId) return Promise.resolve();

    return new Promise((resolve) => {
        const url = new URL(DISCORD_WEBHOOK_URL);
        
        const options = {
            hostname: url.hostname,
            path: `${url.pathname}/messages/${lastMessageId}`,
            method: 'DELETE'
        };

        console.log(`🗑️ Eliminando mensaje anterior (ID: ${lastMessageId})...`);

        const req = https.request(options, (res) => {
            if (res.statusCode === 204) {
                console.log('✅ Mensaje anterior eliminado');
                lastMessageId = null; // Resetear el ID
                saveState(); // Guardar el estado actualizado
            } else {
                console.log(`⚠️ No se pudo eliminar el mensaje (Status: ${res.statusCode})`);
            }
            resolve();
        });

        req.on('error', (error) => {
            console.error('Error eliminando mensaje:', error);
            resolve();
        });

        req.end();
    });
}

async function sendDiscordMessage(serverStatus, domain, srvRecord) {
    // Primero eliminar el mensaje anterior si existe
    await deleteLastMessage();

    return new Promise((resolve) => {
        const url = new URL(DISCORD_WEBHOOK_URL);
        
        let embed = {
            title: `ESTADO SERVIDOR MINECRAFT`,
            color: serverStatus.online ? 65280 : 16711680, // Verde o Rojo
            description: serverStatus.online ? ` 🟢 **SERVIDOR ONLINE** 🟢` : `🔴 **SERVIDOR OFFLINE** 🔴`,
            fields: [],
            timestamp: new Date().toISOString(),
            footer: {
                text: "Magic Art Hat - Minecraft Status"
            }
        };
        embed.fields.push(
            {
                name: " ",
                value: ` `,
                inline: false
            }
        );
        embed.fields.push(
            {
                name: "DIRECCION IP",
                value: `${srvRecord.host}`,
                inline: true
            }
        );
        embed.fields.push(
            {
                name: "VERSION",
                value: `1.21.5`,
                inline: true
            }
        );
        embed.fields.push(
            {
                name: " ",
                value: ` `,
                inline: false
            }
        );
        embed.fields.push(
            {
                name: "VOICE CHAT - Modrinth",
                value: `[PLASMO VOICE](https://modrinth.com/plugin/plasmo-voice)`,
                inline: true
            }
        );
        embed.fields.push(
            {
                name: "VOICE CHAT - CurseForge",
                value: `[PLASMO VOICE](https://www.curseforge.com/minecraft/mc-mods/plasmo-voice)`,
                inline: true
            }
        );
        embed.fields.push(
            {
                name: " ",
                value: ` `,
                inline: false
            }
        );
        embed.fields.push(
            {
                name: "WHITELIST",
                value: `Si no estás en la whitelist contacta con un administrador para obtener acceso`,
                inline: false
            }
        );
        embed.fields.push(
            {
                name: " ",
                value: ` `,
                inline: false
            }
        );

        const payload = JSON.stringify({
            username: "Minecraft Status Bot",
            avatar_url: "https://www.minecraft.net/content/dam/minecraftnet/games/minecraft/logos/Homepage_Gameplay-Trailer_MC-OV-logo_300x300.png",
            embeds: [embed]
        });

        console.log('📝 Creando nuevo mensaje en Discord...');
        if (debug) {
            console.log('Payload:', payload);
        }

        const options = {
            hostname: url.hostname,
            path: `${url.pathname}?wait=true`,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(payload, 'utf8')
            }
        };

        const req = https.request(options, (res) => {
            if (debug) console.log(`Respuesta de Discord - Status: ${res.statusCode}`);
            let responseData = '';
            res.on('data', (chunk) => {
                responseData += chunk;
            });
            res.on('end', () => {
                if (res.statusCode === 200) {
                    try {
                        const responseJson = JSON.parse(responseData);
                        if (responseJson.id) {
                            lastMessageId = responseJson.id;
                            console.log(`✅ Mensaje creado con ID: ${lastMessageId}`);
                            saveState(); // Guardar el estado después de crear el mensaje
                        }
                    } catch (e) {
                        console.log('✅ Mensaje enviado');
                    }
                    resolve({ success: true, statusCode: res.statusCode, messageId: lastMessageId });
                } else {
                    if (debug) console.log('Respuesta de Discord (error):', responseData);
                    resolve({ success: false, statusCode: res.statusCode });
                }
            });
        });

        req.on('error', (error) => {
            console.error('Error enviando mensaje a Discord:', error);
            resolve({ success: false, error: error.message });
        });

        req.write(payload);
        req.end();
    });
}

// Endpoint para verificar que el webhook está funcionando
app.get('/health', (req, res) => {
    console.log('Health check solicitado');
    res.json({
        success: true,
        message: 'Webhook funcionando correctamente',
        domain_configurado: MINECRAFT_DOMAIN,
        intervalo_actualizacion: `${UPDATE_INTERVAL / 1000} segundos`,
        timestamp: new Date().toISOString()
    });
});

// Endpoint para enviar estado de cualquier dominio a Discord
app.get('/discord/:domain', async (req, res) => {
    try {
        const domain = req.params.domain;
        console.log(`Discord notification solicitada para ${domain}`);
        
        // Resolver el registro SRV
        const srvRecord = await resolveSRV(domain);
        
        if (!srvRecord) {
            const discordResult = await sendDiscordMessage(
                { online: false, error: 'No se pudo resolver el registro SRV' },
                domain,
                null
            );
            
            return res.json({
                success: false,
                message: 'No se pudo resolver el registro SRV',
                domain: domain,
                discord: discordResult,
                timestamp: new Date().toISOString()
            });
        }

        // Verificar el estado del servidor
        const serverStatus = await checkMinecraftServer(srvRecord.host, srvRecord.port);
        
        // Enviar mensaje a Discord
        const discordResult = await sendDiscordMessage(serverStatus, domain, srvRecord);
        
        res.json({
            success: true,
            message: 'Estado verificado y enviado a Discord',
            domain: domain,
            server: {
                host: srvRecord.host,
                port: srvRecord.port
            },
            status: serverStatus,
            discord: discordResult,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('Error en el webhook de Discord:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// Endpoint con parámetro personalizable de dominio
app.get('/status/:domain', async (req, res) => {
    try {
        const domain = req.params.domain;
        console.log(`Status check solicitado para ${domain}`);
        
        // Resolver el registro SRV
        const srvRecord = await resolveSRV(domain);
        
        if (!srvRecord) {
            return res.status(500).json({
                success: false,
                message: 'No se pudo resolver el registro SRV',
                domain: domain,
                online: false,
                timestamp: new Date().toISOString()
            });
        }

        // Verificar el estado del servidor
        const serverStatus = await checkMinecraftServer(srvRecord.host, srvRecord.port);
        
        res.json({
            success: true,
            domain: domain,
            server: {
                host: srvRecord.host,
                port: srvRecord.port
            },
            ...serverStatus,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('Error en el webhook:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor',
            error: error.message,
            online: false,
            timestamp: new Date().toISOString()
        });
    }
});

// Función para actualizar automáticamente el estado
async function updateServerStatus() {
    try {
        console.log(`\n⏰ [${new Date().toLocaleString()}] Actualizando estado del servidor...`);
        
        // Resolver el registro SRV
        const srvRecord = await resolveSRV(MINECRAFT_DOMAIN);
        
        if (!srvRecord) {
            console.log('❌ No se pudo resolver el registro SRV');
            await sendDiscordMessage(
                { online: false, error: 'No se pudo resolver el registro SRV' },
                MINECRAFT_DOMAIN,
                null
            );
            return;
        }

        // Verificar el estado del servidor
        const serverStatus = await checkMinecraftServer(srvRecord.host, srvRecord.port);
        
        // Enviar mensaje a Discord
        await sendDiscordMessage(serverStatus, MINECRAFT_DOMAIN, srvRecord);
        
        console.log(`✅ Estado actualizado - Servidor: ${serverStatus.online ? 'ONLINE' : 'OFFLINE'}`);
    } catch (error) {
        console.error('❌ Error al actualizar estado:', error);
    }
}

app.listen(PORT, () => {
    console.log(`╔══════════════════════════════════════════╗`);
    console.log(`║  🚀 WEBHOOK DE MINECRAFT - EJECUTÁNDOSE  ║`);
    console.log(`╚══════════════════════════════════════════╝`);
    
    // Cargar estado del archivo
    console.log(`\n🔍 Cargando estado anterior...`);
    loadState();
    
    console.log(`\n📍 Configuración:`);
    console.log(`   Puerto: ${PORT}`);
    console.log(`   Dominio monitoreado: ${MINECRAFT_DOMAIN}`);
    console.log(`   Intervalo de actualización: ${UPDATE_INTERVAL / 1000} segundos (${UPDATE_INTERVAL / 60000} minutos)`);
    console.log(`\nAPI Endpoints disponibles:`);
    console.log(`   GET /health`);
    console.log(`       → Verifica el estado del webhook y configuración`);
    console.log(`\n   GET /status/:domain`);
    console.log(`       → Verifica el estado de cualquier servidor (solo JSON)`);
    console.log(`       → Ejemplo: http://localhost:${PORT}/status/${MINECRAFT_DOMAIN}`);
    console.log(`\n   GET /discord/:domain`);
    console.log(`       → Verifica el estado y envía notificación a Discord`);
    console.log(`       → Ejemplo: http://localhost:${PORT}/discord/${MINECRAFT_DOMAIN}`);
    console.log(`\n🔄 Actualización automática:`);
    console.log(`   ✓ El bot actualiza automáticamente el estado en Discord`);
    console.log(`   ✓ No necesitas llamar a la API manualmente`);
    console.log(`   ✓ Cambios de estado se reflejan automáticamente`);
    console.log(`   ✓ El mensaje anterior se mantiene entre reinicios`);
    
    // Ejecutar la primera actualización inmediatamente
    console.log(`\n⏳ Iniciando primera actualización...`);
    updateServerStatus();
    
    // Configurar actualizaciones periódicas
    setInterval(updateServerStatus, UPDATE_INTERVAL);
    console.log(`✅ Sistema de actualización automática activado\n`);
    console.log(`╔═══════════════════════════════════════════════════════════╗`);
    console.log(`║  Presiona Ctrl+C para detener el servidor                ║`);
    console.log(`╚═══════════════════════════════════════════════════════════╝\n`);
});

module.exports = app;