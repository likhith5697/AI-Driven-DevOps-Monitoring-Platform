const winston = require("winston");
const { Client } = require("@opensearch-project/opensearch");

const client = new Client({
  node: process.env.OPENSEARCH_URL || "http://opensearch:9200"
});

const logger = winston.createLogger({
  level: "info",
  format: winston.format.json(),
  transports: [new winston.transports.Console()]
});

// Retry + daily index
async function sendLog(log, retries = 3) {
  const index = `payment-service-logs-${new Date()
    .toISOString()
    .split("T")[0]}`;

  for (let i = 0; i < retries; i++) {
    try {
      await client.index({
        index,
        body: log
      });
      return;
    } catch (err) {
      if (i === retries - 1) {
        console.error("OpenSearch log error", err);
      } else {
        await new Promise(res => setTimeout(res, 1000));
      }
    }
  }
}

function logInfo(message, data = {}, correlationId = null) {
  const log = {
    level: "info",
    service: "payment-service",
    message,
    correlationId,
    timestamp: new Date().toISOString(),
    ...data
  };

  logger.info(log);
  sendLog(log);
}

function logError(message, data = {}, correlationId = null) {
  const log = {
    level: "error",
    service: "payment-service",
    message,
    correlationId,
    timestamp: new Date().toISOString(),
    ...data
  };

  logger.error(log);
  sendLog(log);
}

function logWarn(message, data = {}, correlationId = null) {
  const log = {
    level: "warn",
    service: "payment-service",
    message,
    correlationId,
    timestamp: new Date().toISOString(),
    ...data
  };

  logger.warn(log);
  sendLog(log);
}

module.exports = { logInfo, logError, logWarn };