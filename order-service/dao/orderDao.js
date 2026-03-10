const { v4: uuidv4 } = require("uuid")

let orders = []

function createOrder(order) {
  const newOrder = {
    id: uuidv4(),
    item: order.item,
    price: order.price,
    createdAt: new Date()
  }

  orders.push(newOrder)

  return newOrder
}

function getOrders() {
  return orders
}

module.exports = {
  createOrder,
  getOrders
}