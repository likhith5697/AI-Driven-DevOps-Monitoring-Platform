const client = require("prom-client");

const register = new client.Registry();

client.collectDefaultMetrics({ register });

const paymentsTotal = new client.Counter({
  name: "payments_total",
  help: "Total number of payment requests",
  labelNames: ["payment_method", "status"]
});

const paymentsAmount = new client.Counter({
  name: "payments_amount_total",
  help: "Total amount processed in payments",
  labelNames: ["currency"]
});

const paymentsRefunded = new client.Counter({
  name: "payments_refunded_total",
  help: "Total number of refunded payments"
});

const paymentDuration = new client.Histogram({
  name: "payment_processing_duration_seconds",
  help: "Duration of payment processing in seconds",
  labelNames: ["payment_method", "status"],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5]
});

register.registerMetric(paymentsTotal);
register.registerMetric(paymentsAmount);
register.registerMetric(paymentsRefunded);
register.registerMetric(paymentDuration);

module.exports = {
  register,
  paymentsTotal,
  paymentsAmount,
  paymentsRefunded,
  paymentDuration
};