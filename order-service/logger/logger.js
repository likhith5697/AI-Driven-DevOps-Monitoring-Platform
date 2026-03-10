const winston = require("winston")
const { Client } = require("@opensearch-project/opensearch")

const client = new Client({
  node: "http://opensearch:9200"
})

const logger = winston.createLogger({
  level: "info",
  format: winston.format.json(),
  transports: [
    new winston.transports.Console()
  ]
})

async function sendLog(log) {
  try {
    await client.index({
      index: "node-service-logs",
      body: log
    })
  } catch (err) {
    console.error("OpenSearch log error", err)
  }
}

function logInfo(message, data = {}) {
  const log = {
    level: "info",
    message,
    timestamp: new Date(),
    ...data
  }

  logger.info(log)
  sendLog(log)
}

function logError(message, data = {}) {
  const log = {
    level: "error",
    message,
    timestamp: new Date(),
    ...data
  }

  logger.error(log)
  sendLog(log)
}

module.exports = { logInfo, logError }