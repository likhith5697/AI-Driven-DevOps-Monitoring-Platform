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
  stockChecks,
  stockReservations,
  stockReleases,
  stockConfirmed,
  inventoryLevel,
  reservationDuration
} = require("./metrics/metrics");

const app = express();
app.use(express.json());
app.use(cors());

const PORT = process.env.PORT || 3002;

// =======================
// In-memory DB
// =======================
const inventory = new Map([
  ["iphone", { productId: "iphone", name: "iPhone", stock: 10 }]
]);

const reservations = new Map();

// Initialize gauge
inventory.forEach((item) => {
  inventoryLevel.set(
    { product_id: item.productId, product_name: item.name },
    item.stock
  );
});

// =======================
// Health
// =======================
app.get("/health", (req, res) => {
  res.json({ status: "healthy", service: "inventory-service" });
});

// =======================
// Metrics
// =======================
app.get("/metrics", async (req, res) => {
  res.set("Content-Type", register.contentType);
  res.end(await register.metrics());
});

// =======================
// Check Stock
// =======================
app.post("/api/inventory/check", (req, res) => {
  const correlationId = req.headers["x-correlation-id"] || uuidv4();
  const { items } = req.body;

  logInfo("Checking stock availability", { items }, correlationId);

  const result = items.map((item) => {
    const product = inventory.get(item.productId.toLowerCase());

    const available = product && product.stock > 0;

    stockChecks.inc({ available: String(available) });

    return {
      productId: item.productId,
      available
    };
  });

  res.json(result);
});

// =======================
// Reserve Stock
// =======================
app.post("/api/inventory/reserve", (req, res) => {
  const start = Date.now();
  const correlationId = req.headers["x-correlation-id"] || uuidv4();

  const { orderId, items } = req.body;

  logInfo("Reserving stock", { orderId, items }, correlationId);

  // Validate availability
  for (let item of items) {
    const product = inventory.get(item.productId.toLowerCase());

    if (!product || product.stock < item.quantity) {
      stockReservations.inc({ status: "failed" });

      logError(
        "Stock reservation failed",
        { orderId, item },
        correlationId
      );

      return res.status(400).json({
        error: "Out of stock",
        productId: item.productId
      });
    }
  }

  // Reserve stock
  items.forEach((item) => {
    const product = inventory.get(item.productId.toLowerCase());

    product.stock -= item.quantity;

    inventoryLevel.set(
      { product_id: product.productId, product_name: product.name },
      product.stock
    );
  });

  const reservationId = uuidv4();

  reservations.set(reservationId, {
    reservationId,
    orderId,
    items,
    status: "reserved",
    timestamp: new Date().toISOString()
  });

  const duration = (Date.now() - start) / 1000;

  reservationDuration.observe({ status: "reserved" }, duration);
  stockReservations.inc({ status: "success" });

  logInfo(
    "Stock reserved",
    { orderId, reservationId },
    correlationId
  );

  res.json({ reservationId });
});

// =======================
// Confirm Reservation
// =======================
app.post("/api/inventory/confirm", (req, res) => {
  const correlationId = req.headers["x-correlation-id"] || uuidv4();
  const { reservationId } = req.body;

  const reservation = reservations.get(reservationId);

  if (!reservation) {
    logError(
      "Reservation not found",
      { reservationId },
      correlationId
    );
    return res.status(404).json({ error: "Reservation not found" });
  }

  reservation.status = "confirmed";
  stockConfirmed.inc();

  logInfo(
    "Reservation confirmed",
    { reservationId, orderId: reservation.orderId },
    correlationId
  );

  res.json(reservation);
});

// =======================
// Release Reservation (Rollback)
// =======================
app.post("/api/inventory/release", (req, res) => {
  const correlationId = req.headers["x-correlation-id"] || uuidv4();
  const { reservationId } = req.body;

  const reservation = reservations.get(reservationId);

  if (!reservation) {
    logError(
      "Reservation not found for release",
      { reservationId },
      correlationId
    );
    return res.status(404).json({ error: "Reservation not found" });
  }

  if (reservation.status !== "reserved") {
    logWarn(
      "Cannot release non-reserved inventory",
      { reservationId },
      correlationId
    );
    return res.status(400).json({ error: "Invalid state" });
  }

  // Restore stock
  reservation.items.forEach((item) => {
    const product = inventory.get(item.productId.toLowerCase());

    product.stock += item.quantity;

    inventoryLevel.set(
      { product_id: product.productId, product_name: product.name },
      product.stock
    );
  });

  reservation.status = "released";
  stockReleases.inc();

  logInfo(
    "Stock released",
    { reservationId, orderId: reservation.orderId },
    correlationId
  );

  res.json(reservation);
});

// =======================
// Start Server
// =======================
app.listen(PORT, () => {
  logInfo(`Inventory service started on port ${PORT}`);
});

module.exports = app;