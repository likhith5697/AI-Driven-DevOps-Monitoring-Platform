const orderService = require("../services/orderService")
const { httpRequests, ordersFailed } = require("../metrics/metrics")
const logger = require("../logger/logger") // <- added

async function createOrder(req, res) {
  logger.logInfo("Received createOrder API call", { body: req.body }) 
  const start = Date.now();

  if (!req.body.item || !req.body.price) {
    logger.logError("Invalid order request", { body: req.body })
    httpRequests.inc({
      method: "POST",
      route: "/orders",
      status: 400
    });
    
    ordersFailed.inc();
    return res.status(400).send("Item and price required")
  }

  try {
    const order = orderService.createOrder(req.body)

    httpRequests.inc({
      method: "POST",
      route: "/orders",
      status: 200
    })

    logger.logInfo("createOrder API success", { orderId: order.id }) 

    res.json(order)
  } catch (err) {
    httpRequests.inc({
      method: "POST",
      route: "/orders",
      status: 500
    });

    ordersFailed.inc();

    logger.logError("createOrder API error", { error: err.message }) 

    res.status(500).send(err.message)
  }
}

async function getOrders(req, res) {
  logger.logInfo("Received getOrders API call") 

  const orders = orderService.getOrders()

 try{
   httpRequests.inc({
    method: "GET",
    route: "/orders",
    status: 200
  })

  logger.logInfo("getOrders API success", { count: orders.length }) 

  res.json(orders)
 }
 catch(err){
  httpRequests.inc({
      method: "GET",
      route: "/orders",
      status: 500
    });
    ordersFailed.inc();

    logger.logError("get API error", { error: err.message }) 
    res.status(500).send(err.message)
 }
}

module.exports = {
  createOrder,
  getOrders
}