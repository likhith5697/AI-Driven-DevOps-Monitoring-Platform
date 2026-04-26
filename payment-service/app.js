const express = require("express");
const cors = require("cors");
const { v4: uuidv4 } = require("uuid");

const {
  logInfo,
  logError,
  logWarn
} = require("./logger/logger");

const {
  register,
  paymentsTotal,
  paymentsAmount,
  paymentsRefunded,
  paymentDuration
} = require("./metrics/metrics");

const app = express();
app.use(express.json());
app.use(cors());

const PORT = process.env.PORT || 3001;

// In-memory DB
const payments = new Map();

// =======================
// Health Check
// =======================
app.get("/health", (req, res) => {
  res.json({ status: "healthy", service: "payment-service" });
});

// =======================
// Metrics Endpoint
// =======================
app.get("/metrics", async (req, res) => {
  res.set("Content-Type", register.contentType);
  res.end(await register.metrics());
});

// =======================
// Process Payment
// =======================
app.post("/api/payments", (req, res) => {
  const start = Date.now();

  // ✅ Correlation ID
  const correlationId = req.headers["x-correlation-id"] || uuidv4();

  const { orderId, amount, paymentMethod } = req.body;

  logInfo(
    "Received payment request",
    { orderId, amount, paymentMethod },
    correlationId
  );

  if (!orderId || !amount || !paymentMethod) {
    logError(
      "Invalid payment request",
      { orderId, amount },
      correlationId
    );

    paymentsTotal.inc({
      payment_method: paymentMethod || "unknown",
      status: "failed"
    });

    return res
      .status(400)
      .json({ error: "orderId, amount, and paymentMethod required" });
  }

  const paymentId = uuidv4();
  const isSuccess = Math.random() > 0.1;
  const status = isSuccess ? "completed" : "failed";

  const payment = {
    paymentId,
    orderId,
    amount,
    paymentMethod,
    status,
    correlationId,
    timestamp: new Date().toISOString()
  };

  payments.set(paymentId, payment);

  // Metrics
  const duration = (Date.now() - start) / 1000;

  paymentDuration.observe(
    { payment_method: paymentMethod, status },
    duration
  );

  paymentsTotal.inc({
    payment_method: paymentMethod,
    status
  });

  paymentsAmount.inc({ currency: "USD" }, amount);

  if (isSuccess) {
    logInfo(
      "Payment processed successfully",
      { paymentId, orderId, status, amount },
      correlationId
    );
  } else {
    logError(
      "Payment processing failed",
      { paymentId, orderId, status },
      correlationId
    );
  }

  res.json(payment);
});

// =======================
// Get Payment by ID
// =======================
app.get("/api/payments/:paymentId", (req, res) => {
  const correlationId = req.headers["x-correlation-id"] || uuidv4();

  const { paymentId } = req.params;
  const payment = payments.get(paymentId);

  if (!payment) {
    logError("Payment not found", { paymentId }, correlationId);
    return res.status(404).json({ error: "Payment not found" });
  }

  res.json(payment);
});

// =======================
// Get Payments by Order ID
// =======================
app.get("/api/payments/by-order/:orderId", (req, res) => {
  const { orderId } = req.params;

  const orderPayments = Array.from(payments.values()).filter(
    p => p.orderId === orderId
  );

  res.json(orderPayments);
});

// =======================
// Refund Payment
// =======================
app.post("/api/payments/:paymentId/refund", (req, res) => {
  const correlationId = req.headers["x-correlation-id"] || uuidv4();

  const { paymentId } = req.params;
  const payment = payments.get(paymentId);

  if (!payment) {
    logError(
      "Payment not found for refund",
      { paymentId },
      correlationId
    );
    return res.status(404).json({ error: "Payment not found" });
  }

  if (payment.status !== "completed") {
    logWarn(
      "Cannot refund non-completed payment",
      { paymentId },
      correlationId
    );
    return res.status(400).json({ error: "Payment not completed" });
  }

  payment.status = "refunded";
  payment.refundedAt = new Date().toISOString();

  paymentsRefunded.inc();

  logInfo(
    "Payment refunded",
    { paymentId, orderId: payment.orderId },
    correlationId
  );

  res.json(payment);
});

// =======================
// Start Server
// =======================
app.listen(PORT, () => {
  logInfo(`Payment service started on port ${PORT}`);
});

module.exports = app;