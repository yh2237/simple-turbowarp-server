const fs = require("fs");
const moment = require("moment");
const chalk = require("chalk");
const yaml = require("js-yaml");

const CONFIG_FILE = "config/config.yml";

let config = {};
if (fs.existsSync(CONFIG_FILE)) {
    config = yaml.load(fs.readFileSync(CONFIG_FILE, "utf8"));
}

const MAX_LOG_LINES = config.max_log_lines;
const LOG_FILE = config.log_file_path;

const LEVELS = {
    INFO: chalk.green("[INFO]"),
    WARN: chalk.yellow("[WARN]"),
    ERROR: chalk.red("[ERROR]"),
    RECEIVED: chalk.blue("[RECEIVED]")
};

function log(level, message) {
    const currentTime = moment().format("YYYY-MM-DD HH:mm:ss");
    const formattedMessage = `[${currentTime}] ${LEVELS[level]} ${message}`;

    console.log(formattedMessage);

    if (fs.existsSync(CONFIG_FILE)) {
        const config = yaml.load(fs.readFileSync(CONFIG_FILE, "utf8"));
        if (config.log_to_file) {
            manageLogFile();
            fs.appendFileSync(LOG_FILE, formattedMessage + "\n", { encoding: "utf8" });
        }
    }
}

function manageLogFile() {
    if (!fs.existsSync(LOG_FILE)) return;

    const logData = fs.readFileSync(LOG_FILE, "utf8");
    const logLines = logData.split("\n").filter(line => line.trim() !== "");

    if (logLines.length >= MAX_LOG_LINES) {
        const newLogLines = logLines.slice(logLines.length - MAX_LOG_LINES + 1);
        fs.writeFileSync(LOG_FILE, newLogLines.join("\n") + "\n", { encoding: "utf8" });
    }
}

module.exports = {
    log
};