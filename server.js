const express = require("express");
const moment = require("moment");
const http = require("http");
const WebSocket = require("ws");
const fs = require("fs");
const path = require("path");
const chalk = require("chalk");
const yaml = require("js-yaml");
const { log } = require("./logger");

const CONFIG_FILE = "config/config.yml";

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

let config = {};
if (fs.existsSync(CONFIG_FILE)) {
    config = yaml.load(fs.readFileSync(CONFIG_FILE, "utf8"));
}

if (config.HTTP_response) {
    app.use(express.static(path.join(__dirname, 'public')));
    app.use('/data', express.static(path.join(__dirname, './data')));
}

const PORT = config.port;
const DATA_FILE = config.cloud_data_path;

let cloudData = {};
if (fs.existsSync(DATA_FILE)) {
    cloudData = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
}

let blockedIps = [];
if (config.ip_filter && fs.existsSync(config.ip_filter_path)) {
    blockedIps = JSON.parse(fs.readFileSync(config.ip_filter_path, "utf8")).ips;
}

let blockedNames = [];
if (config.name_filter && fs.existsSync(config.name_filter_path)) {
    blockedNames = JSON.parse(fs.readFileSync(config.name_filter_path, "utf8")).names;
}

console.log(blockedNames);

// =================================================================================================================

// banner表示
if (config.banner) {
    const banner = fs.readFileSync("./config/banner.txt", 'utf8');
    log("INFO", `\n${banner}`);
}

log("INFO", `Server started on port: ${PORT}`);

wss.on("connection", (ws, req) => {
    const clientIP = req.socket.remoteAddress;

    // IPフィルター処理
    if (config.ip_filter && blockedIps.includes(clientIP)) {
        log("INFO", `Rejected IP: ${clientIP}`);
        ws.close(1008, 'Forbidden');
        return;
    }

    // 接続してきたクライアントに変数を渡す
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

            // NAMEフィルター処理
            if (config.name_filter && blockedNames.includes(data.user)) {
                log("INFO", `Rejected Name: ${JSON.stringify(data.user)} IP: ${clientIP}`);
                ws.close(1008, 'Forbidden');
                return;
            }

            // クライアント接続処理
            if (data.method === "handshake") {
                log("INFO", `Client connected IP: ${clientIP} ${JSON.stringify(data)}`);
                return;
            }

            log("RECEIVED", `IP: ${clientIP} ${JSON.stringify(data)}`);

            // 変数受け取り処理
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
            log("ERROR", `Unknown format error: ${error}`);
        }
    });

    // ☠PONG☠
    ws.on("pong", (code) => {
        ws.send("pong!");
        log("INFO", `IP: ${clientIP} code: ${code}`);
    });

    // エラーが出たとき用
    ws.on("error", (error) => {
        log("ERROR", `IP: ${clientIP} error: ${error}`);
    });

    // クライアント切断処理
    ws.on("close", (code) => {
        log("INFO", `Client disconnected IP: ${clientIP} code: ${code}`);
    });
});

function broadcast(message) {
    wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(message);
        }
    });
}

// httpリクエスト処理
app.get("/", (req, res) => {
    if (config.HTTP_response) {
        res.sendFile(path.join(__dirname, "public", "index.html"));
    } else {
        res.status(403).send("403 Forbidden");
    }
});

app.get("/:file", (req, res) => {
    if (config.HTTP_response) {
        const filePath = path.join(__dirname, "public", req.params.file);
        if (fs.existsSync(filePath) && fs.lstatSync(filePath).isFile()) {
            res.sendFile(filePath);
        } else {
            res.status(404).send("404 Not Found");
            const currentTime = moment();
            console.log(`[${currentTime.format("YYYY-MM-DD-HH:mm:ss")}]${chalk.red("[ERROR]")} ${chalk.bgRed("[404]")} IP: ${req.ip} PATH: ${filePath}`)
        }
    } else {
        res.status(403).send("403 Forbidden");
    }
});

server.listen(PORT);