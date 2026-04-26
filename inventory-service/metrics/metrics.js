const client = require("prom-client");

const register = new client.Registry();
client.collectDefaultMetrics({ register });

const stockChecks = new client.Counter({
  name: "inventory_stock_checks_total",
  help: "Total number of stock availability checks",
  labelNames: ["available"]
});

const stockReservations = new client.Counter({
  name: "inventory_stock_reservations_total",
  help: "Total number of stock reservations",
  labelNames: ["status"]
});

const stockReleases = new client.Counter({
  name: "inventory_stock_releases_total",
  help: "Total number of stock releases"
});

const stockConfirmed = new client.Counter({
  name: "inventory_stock_confirmed_total",
  help: "Total number of confirmed reservations"
});

const inventoryLevel = new client.Gauge({
  name: "inventory_product_stock",
  help: "Current stock level",
  labelNames: ["product_id", "product_name"]
});

const reservationDuration = new client.Histogram({
  name: "inventory_reservation_duration_seconds",
  help: "Reservation duration",
  labelNames: ["status"],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5]
});

register.registerMetric(stockChecks);
register.registerMetric(stockReservations);
register.registerMetric(stockReleases);
register.registerMetric(stockConfirmed);
register.registerMetric(inventoryLevel);
register.registerMetric(reservationDuration);

module.exports = {
  register,
  stockChecks,
  stockReservations,
  stockReleases,
  stockConfirmed,
  inventoryLevel,
  reservationDuration
};