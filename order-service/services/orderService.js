const orderDao = require("../dao/orderDao")
const logger = require("../logger/logger")
const { orderCreated } = require("../metrics/metrics")

function createOrder(order) {
  logger.logInfo("Creating order in service layer", { item: order.item }) 

  const created = orderDao.createOrder(order)

  orderCreated.inc()

  logger.logInfo("Order created in service layer", { orderId: created.id }) 

  return created
}

function getOrders() {
  logger.logInfo("Fetching all orders from service layer") 

  return orderDao.getOrders()
}

module.exports = {
  createOrder,
  getOrders
}