const client = require("prom-client")

const register = new client.Registry()

client.collectDefaultMetrics({ register })

const httpRequests = new client.Counter({
  name: "http_requests_total",
  help: "Total API requests",
  labelNames: ["method", "route", "status"]
})

const orderCreated = new client.Counter({
  name: "orders_created_total",
  help: "Total orders created"
})


const ordersFailed = new client.Counter({
  name:"orders_failed_total",
  help:"Total failed order creations"
});

const httpRequestDuration = new client.Histogram({
  name: "http_request_duration_seconds",
  help: "Duration of HTTP requests in seconds",
  labelNames: ["method", "route", "status"],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5]
});



register.registerMetric(httpRequests)
register.registerMetric(orderCreated)
register.registerMetric(ordersFailed)
register.registerMetric(httpRequestDuration)

module.exports = {
  register,
  httpRequests,
  orderCreated,
  ordersFailed,
  httpRequestDuration
}