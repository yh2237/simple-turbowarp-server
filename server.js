const express = require("express");
const http = require("http");
const WebSocket = require("ws");
const fs = require("fs");
const moment = require("moment");
const path = require("path");

const CONFIG_FILE = "./config.json";

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(express.static(path.join(__dirname, 'public')));
app.use('/data', express.static(path.join(__dirname, './data')));

let config = {};
if (fs.existsSync(CONFIG_FILE)) {
    config = JSON.parse(fs.readFileSync(CONFIG_FILE, "utf8"));
}

const PORT = config.port;
const DATA_FILE = config.cloud_data_path;

let cloudData = {};
if (fs.existsSync(DATA_FILE)) {
    cloudData = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
}

let blockedIps = [];
if (config.ip_filter_enabled && fs.existsSync(config.ip_filter_path)) {
    blockedIps = JSON.parse(fs.readFileSync(config.ip_filter_path, "utf8")).ips;
}

const currentTime = moment();
console.log(`[${currentTime.format("YYYY-MM-DD-HH:mm:ss")}][INFO] TurboWarp クラウド変数サーバーがポート ${PORT} で起動しました`);

wss.on("connection", (ws, req) => {
    const clientIP = req.socket.remoteAddress;

    if (config.ip_filter_enabled && blockedIps.includes(clientIP)) {
        const currentTime = moment();
        console.log(`[${currentTime.format("YYYY-MM-DD-HH:mm:ss")}][INFO] 接続拒否されたIP: ${clientIP}`);
        ws.close();
        return;
    }

    for (let key in cloudData) {
        ws.send(JSON.stringify({
            method: "set",
            name: key,
            value: cloudData[key]
        }));
    }

    ws.on("message", (message) => {
        try {
            const data = JSON.parse(message);

            if (data.method === "handshake") {
                const currentTime = moment();
                console.log(`[${currentTime.format("YYYY-MM-DD-HH:mm:ss")}][INFO] クライアントが接続しました IP: ${clientIP} ${JSON.stringify(data)}`);
                return;
            }

            const currentTime = moment();
            console.log(`[${currentTime.format("YYYY-MM-DD-HH:mm:ss")}][RECEIVED] IP: ${clientIP} ${JSON.stringify(data)}`);

            if (data.method === "set" && data.name && typeof data.value !== "undefined") {
                const variableName = data.name;
                const value = data.value;

                cloudData[variableName] = value;
                fs.writeFileSync(DATA_FILE, JSON.stringify(cloudData, null, 2));

                broadcast(JSON.stringify({
                    method: "set",
                    name: variableName,
                    value: value
                }));
            }
        } catch (error) {
            const currentTime = moment();
            console.error(`[${currentTime.format("YYYY-MM-DD-HH:mm:ss")}][ERROR] JSONの解析エラー:`, error);
        }
    });

    ws.on("close", () => {
        const currentTime = moment();
        console.log(`[${currentTime.format("YYYY-MM-DD-HH:mm:ss")}][INFO] IP: ${clientIP} クライアントが切断しました`);
    });
});

function broadcast(message) {
    wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(message);
        }
    });
}

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.get("/:file", (req, res) => {
    const filePath = path.join(__dirname, "public", req.params.file);
    if (fs.existsSync(filePath) && fs.lstatSync(filePath).isFile()) {
        res.sendFile(filePath);
    } else {
        res.status(404).send("404 Not Found");
        const currentTime = moment();
        console.log(`[${currentTime.format("YYYY-MM-DD-HH:mm:ss")}][ERROR] [404] IP: ${req.ip} PATH: ${filePath}`)
    }
});

server.listen(PORT);