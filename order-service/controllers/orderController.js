const axios = require("axios");
const { v4: uuidv4 } = require("uuid");

const orderService = require("../services/orderService");
const {
  httpRequests,
  ordersFailed,
  httpRequestDuration
} = require("../metrics/metrics");

const logger = require("../logger/logger");

const PAYMENT_SERVICE_URL =
  process.env.PAYMENT_SERVICE_URL || "http://localhost:3001";

const INVENTORY_SERVICE_URL =
  process.env.INVENTORY_SERVICE_URL || "http://localhost:3002";

async function createOrder(req, res) {
  const start = Date.now();

  const correlationId =
    req.headers["x-correlation-id"] || req.body.correlationId || uuidv4();

  logger.logInfo(
    "Received createOrder API call",
    { body: req.body },
    correlationId
  );

  if (!req.body.item || !req.body.price) {
    logger.logError(
      "Invalid order request",
      { body: req.body },
      correlationId
    );

    httpRequests.inc({
      method: "POST",
      route: "/orders",
      status: "400"
    });

    ordersFailed.inc();

    httpRequestDuration.observe(
      { method: "POST", route: "/orders", status: "400" },
      (Date.now() - start) / 1000
    );

    return res.status(400).json({
      error: "item and price required",
      correlationId
    });
  }

  const { item, price, paymentMethod } = req.body;
  const itemNormalized = item.toLowerCase();
  const orderId = req.body.orderId || uuidv4();

  const headers = {
    "x-correlation-id": correlationId
  };

  let reservationId = null;
  let paymentResult = null;

  try {
    const items = [
  {
    productId: itemNormalized,
    quantity: 1
  }
];

    // =======================
    // Step 1: Check inventory
    // =======================
    logger.logInfo(
      "Checking inventory availability",
     { orderId, item: itemNormalized },
      correlationId
    );

    const inventoryCheckResponse = await axios.post(
      `${INVENTORY_SERVICE_URL}/api/inventory/check`,
      { items },
      { headers }
    );

    const inventoryAvailable =
      inventoryCheckResponse.data?.available === true ||
      inventoryCheckResponse.data?.every?.((i) => i.available === true);

    if (!inventoryAvailable) {
      logger.logWarn(
        "Inventory not available",
        { orderId, item },
        correlationId
      );

      httpRequests.inc({
        method: "POST",
        route: "/orders",
        status: "409"
      });

      ordersFailed.inc();

      httpRequestDuration.observe(
        { method: "POST", route: "/orders", status: "409" },
        (Date.now() - start) / 1000
      );

      return res.status(409).json({
        error: "Item out of stock",
        orderId,
        correlationId
      });
    }

    // =======================
    // Step 2: Reserve inventory
    // =======================
    const reserveResponse = await axios.post(
      `${INVENTORY_SERVICE_URL}/api/inventory/reserve`,
      {
        orderId,
        items
      },
      { headers }
    );

    reservationId = reserveResponse.data.reservationId;

    logger.logInfo(
      "Inventory reserved",
      { orderId, reservationId },
      correlationId
    );

    // =======================
    // Step 3: Process payment
    // =======================
    const paymentResponse = await axios.post(
      `${PAYMENT_SERVICE_URL}/api/payments`,
      {
        orderId,
        amount: price,
        paymentMethod: paymentMethod || "card",
        cardNumber: req.body.cardNumber || "****"
      },
      { headers }
    );

    paymentResult = paymentResponse.data;

    logger.logInfo(
      "Payment processed",
      {
        orderId,
        paymentId: paymentResult.paymentId,
        paymentStatus: paymentResult.status
      },
      correlationId
    );

    if (paymentResult.status !== "completed") {
      logger.logError(
        "Payment failed",
        { orderId, paymentStatus: paymentResult.status },
        correlationId
      );

      if (reservationId) {
        await axios.post(
          `${INVENTORY_SERVICE_URL}/api/inventory/release`,
          { reservationId },
          { headers }
        );

        logger.logInfo(
          "Inventory released after payment failure",
          { orderId, reservationId },
          correlationId
        );
      }

      ordersFailed.inc();

      httpRequests.inc({
        method: "POST",
        route: "/orders",
        status: "402"
      });

      httpRequestDuration.observe(
        { method: "POST", route: "/orders", status: "402" },
        (Date.now() - start) / 1000
      );

      return res.status(402).json({
        error: "Payment failed",
        orderId,
        correlationId
      });
    }

    // =======================
    // Step 4: Create order
    // =======================
    const order = orderService.createOrder(
      {
        orderId,
        item,
        price,
        paymentMethod: paymentMethod || "card",
        paymentId: paymentResult.paymentId,
        reservationId,
        status: "confirmed",
        correlationId
      },
      correlationId
    );

    // =======================
    // Step 5: Confirm inventory
    // =======================
    if (reservationId) {
      await axios.post(
        `${INVENTORY_SERVICE_URL}/api/inventory/confirm`,
        { reservationId },
        { headers }
      );

      logger.logInfo(
        "Inventory reservation confirmed",
        { orderId, reservationId },
        correlationId
      );
    }

    httpRequests.inc({
      method: "POST",
      route: "/orders",
      status: "200"
    });

    httpRequestDuration.observe(
      { method: "POST", route: "/orders", status: "200" },
      (Date.now() - start) / 1000
    );

    logger.logInfo(
      "createOrder API success",
      {
        orderId,
        paymentId: paymentResult.paymentId,
        reservationId
      },
      correlationId
    );

    return res.status(200).json({
      ...order,
      paymentStatus: paymentResult.status,
      inventoryReserved: true,
      correlationId
    });
  } catch (err) {
    logger.logError(
      "createOrder API error",
      {
        orderId,
        reservationId,
        error: err.message
      },
      correlationId
    );

    if (reservationId && !paymentResult) {
      try {
        await axios.post(
          `${INVENTORY_SERVICE_URL}/api/inventory/release`,
          { reservationId },
          { headers }
        );
      } catch (_) {}
    }

    httpRequests.inc({
      method: "POST",
      route: "/orders",
      status: "500"
    });

    ordersFailed.inc();

    httpRequestDuration.observe(
      { method: "POST", route: "/orders", status: "500" },
      (Date.now() - start) / 1000
    );

    return res.status(500).json({
      error: err.message,
      orderId,
      correlationId
    });
  }
}

async function getOrders(req, res) {
  const start = Date.now();

  const correlationId =
    req.headers["x-correlation-id"] || req.query.correlationId || uuidv4();

  logger.logInfo("Received getOrders API call", {}, correlationId);

  try {
    const orders = orderService.getOrders(correlationId);

    httpRequests.inc({
      method: "GET",
      route: "/orders",
      status: "200"
    });

    httpRequestDuration.observe(
      { method: "GET", route: "/orders", status: "200" },
      (Date.now() - start) / 1000
    );

    logger.logInfo(
      "getOrders API success",
      { count: orders.length },
      correlationId
    );

    return res.json(orders);
  } catch (err) {
    httpRequests.inc({
      method: "GET",
      route: "/orders",
      status: "500"
    });

    ordersFailed.inc();

    httpRequestDuration.observe(
      { method: "GET", route: "/orders", status: "500" },
      (Date.now() - start) / 1000
    );

    logger.logError(
      "getOrders API error",
      { error: err.message },
      correlationId
    );

    return res.status(500).json({
      error: err.message,
      correlationId
    });
  }
}

module.exports = {
  createOrder,
  getOrders
};