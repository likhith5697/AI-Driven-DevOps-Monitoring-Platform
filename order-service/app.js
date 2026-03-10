const express = require("express")
const routes = require("./routes/routes")
const { register } = require("./metrics/metrics")

const app = express()

app.use(express.json())

app.use("/api", routes)

app.get("/metrics", async (req, res) => {
  res.set("Content-Type", register.contentType)
  res.end(await register.metrics())
})

app.listen(3000, () => {
  console.log("Order Service running on port 3000")
})