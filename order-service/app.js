const express = require("express");
const routes = require("./routes/routes");
const { register } = require("./metrics/metrics");
const logger = require("./logger/logger");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.get("/health", (req, res) => {
  res.json({ status: "healthy", service: "order-service" });
});

app.use("/api", routes);

app.get("/metrics", async (req, res) => {
  res.set("Content-Type", register.contentType);
  res.end(await register.metrics());
});

app.listen(PORT, () => {
  logger.logInfo(`Order Service running on port ${PORT}`, {}, "system");
});

module.exports = app;