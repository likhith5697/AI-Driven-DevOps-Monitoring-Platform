const orderDao = require("../dao/orderDao");
const logger = require("../logger/logger");
const { orderCreated } = require("../metrics/metrics");

function createOrder(order, correlationId) {
  logger.logInfo(
    "Creating order in service layer",
    {
      orderId: order.orderId,
      item: order.item
    },
    correlationId
  );

  const created = orderDao.createOrder(order);

  orderCreated.inc();

  logger.logInfo(
    "Order created in service layer",
    {
      orderId: created.orderId
    },
    correlationId
  );

  return created;
}

function getOrders(correlationId) {
  logger.logInfo("Fetching all orders from service layer", {}, correlationId);

  return orderDao.getOrders();
}

module.exports = {
  createOrder,
  getOrders
};