const orders = [];

function createOrder(order) {
  const createdOrder = {
    orderId: order.orderId,
    item: order.item,
    price: order.price,
    paymentMethod: order.paymentMethod,
    paymentId: order.paymentId,
    reservationId: order.reservationId,
    status: order.status || "pending",
    correlationId: order.correlationId,
    createdAt: new Date().toISOString()
  };

  orders.push(createdOrder);

  return createdOrder;
}

function getOrders() {
  return orders;
}

module.exports = {
  createOrder,
  getOrders
};