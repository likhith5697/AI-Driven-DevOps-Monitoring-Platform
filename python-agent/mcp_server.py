import os
from datetime import datetime, timezone, timedelta
from typing import Any, Optional

from fastapi import FastAPI
import requests
from opensearchpy import OpenSearch

OPENSEARCH_HOST = os.getenv("OPENSEARCH_HOST", "opensearch")
OPENSEARCH_PORT = int(os.getenv("OPENSEARCH_PORT", "9200"))
OPENSEARCH_USER = os.getenv("OPENSEARCH_USER", "admin")
OPENSEARCH_PASSWORD = os.getenv("OPENSEARCH_PASSWORD", "Str0ng@Passw0rd#2026!!")
OPENSEARCH_INDEX_PATTERN = os.getenv("OPENSEARCH_INDEX_PATTERN", "*service-logs-*")
PROMETHEUS_URL = os.getenv("PROMETHEUS_URL", "http://prometheus:9090")


class OpenSearchClient:
    def __init__(self):
        self.client = OpenSearch(
            hosts=[{"host": OPENSEARCH_HOST, "port": OPENSEARCH_PORT}],
            http_auth=(OPENSEARCH_USER, OPENSEARCH_PASSWORD),
            use_ssl=False,
            verify_certs=False,
            timeout=30,
        )

    def is_connected(self) -> bool:
        try:
            self.client.info()
            return True
        except Exception:
            return False

    def search_logs(
        self,
        query: Optional[str] = None,
        service: Optional[str] = None,
        order_id: Optional[str] = None,
        correlation_id: Optional[str] = None,
        size: int = 50,
        time_window_hours: int = 24,
    ) -> list:
        end = datetime.now(timezone.utc)
        start = end - timedelta(hours=time_window_hours)

        must = [
            {
                "range": {
                    "timestamp": {
                        "gte": start.isoformat(),
                        "lte": end.isoformat(),
                    }
                }
            }
        ]

        if service:
            must.append({"term": {"service.keyword": service}})

        if order_id:
            must.append({"term": {"orderId.keyword": order_id}})

        if correlation_id:
            must.append({"term": {"correlationId.keyword": correlation_id}})

        if query:
            must.append(
                {
                    "query_string": {
                        "query": query,
                        "fields": [
                            "message",
                            "level",
                            "service",
                            "orderId",
                            "paymentId",
                            "reservationId",
                            "correlationId",
                            "*",
                        ],
                        "default_operator": "OR",
                    }
                }
            )

        body = {
            "query": {"bool": {"must": must}},
            "size": size,
            "sort": [{"timestamp": {"order": "asc"}}],
        }

        try:
            res = self.client.search(index=OPENSEARCH_INDEX_PATTERN, body=body)
            return [hit["_source"] for hit in res["hits"]["hits"]]
        except Exception as e:
            return [{"error": str(e)}]

    def get_flow_timeline(
        self,
        order_id: Optional[str] = None,
        correlation_id: Optional[str] = None,
        time_window_hours: int = 24,
    ) -> dict:
        logs = self.search_logs(
            order_id=order_id,
            correlation_id=correlation_id,
            size=100,
            time_window_hours=time_window_hours,
        )

        services_seen = sorted(
            list({log.get("service") for log in logs if log.get("service")})
        )

        return {
            "order_id": order_id,
            "correlation_id": correlation_id,
            "services_seen": services_seen,
            "timeline": logs,
            "count": len(logs),
        }


class PrometheusClient:
    def __init__(self):
        self.url = PROMETHEUS_URL

    def is_connected(self) -> bool:
        try:
            r = requests.get(f"{self.url}/-/healthy", timeout=5)
            return r.status_code == 200
        except Exception:
            return False

    def query(self, promql: str) -> list:
        try:
            r = requests.get(
                f"{self.url}/api/v1/query",
                params={"query": promql},
                timeout=10,
            )
            data = r.json()
            if data.get("status") != "success":
                return []
            return data.get("data", {}).get("result", [])
        except Exception as e:
            return [{"error": str(e)}]

    def get_http_requests(self, time_window_minutes: int = 60) -> dict:
        window = f"{time_window_minutes}m"

        query = f"sum by (job, status) (increase(http_requests_total[{window}]))"
        results = self.query(query)

        total = 0.0
        success = 0.0
        fail = 0.0
        by_status = {}

        for item in results:
            metric = item.get("metric", {})
            job = metric.get("job", "unknown")
            status = metric.get("status", "unknown")
            value = float(item.get("value", [0, 0])[1])

            total += value
            by_status[f"{job}:{status}"] = round(value, 2)

            if status.startswith("2"):
                success += value
            else:
                fail += value

        return {
            "window_minutes": time_window_minutes,
            "total": round(total, 2),
            "success": round(success, 2),
            "fail": round(fail, 2),
            "success_rate": round((success / total) * 100, 2) if total else 0,
            "by_status": by_status,
        }

    def get_business_metrics(self) -> dict:
        return {
            "orders_created_total": self.query("orders_created_total"),
            "orders_failed_total": self.query("orders_failed_total"),
            "payments_total": self.query("payments_total"),
            "payments_amount_total": self.query("payments_amount_total"),
            "inventory_stock": self.query("inventory_product_stock"),
            "inventory_reservations": self.query("inventory_stock_reservations_total"),
        }

    def get_service_health(self) -> dict:
        http = self.get_http_requests(60)
        business = self.get_business_metrics()

        status = "healthy"
        if http["fail"] > 0:
            status = "degraded"
        if http["total"] == 0 and not business:
            status = "unknown"

        return {
            "status": status,
            "http_requests": http,
            "business_metrics": business,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }


opensearch_client = OpenSearchClient()
prometheus_client = PrometheusClient()


class Tool:
    name = ""
    description = ""
    input_schema = {}

    def execute(self, **kwargs) -> Any:
        raise NotImplementedError


class SearchLogsTool(Tool):
    name = "search_logs"
    description = "Search logs with optional service, order_id, correlation_id filters."
    input_schema = {
        "type": "object",
        "properties": {
            "query": {"type": "string"},
            "service": {"type": "string"},
            "order_id": {"type": "string"},
            "correlation_id": {"type": "string"},
            "size": {"type": "integer"},
            "time_window_hours": {"type": "integer"},
        },
    }

    def execute(
        self,
        query: str = None,
        service: str = None,
        order_id: str = None,
        correlation_id: str = None,
        size: int = 50,
        time_window_hours: int = 24,
    ):
        logs = opensearch_client.search_logs(
            query=query,
            service=service,
            order_id=order_id,
            correlation_id=correlation_id,
            size=size,
            time_window_hours=time_window_hours,
        )
        return {"logs": logs, "count": len(logs)}


class GetFlowTimelineTool(Tool):
    name = "get_flow_timeline"
    description = "Get ordered timeline for an orderId or correlationId across order, inventory, and payment services."
    input_schema = {
        "type": "object",
        "properties": {
            "order_id": {"type": "string"},
            "correlation_id": {"type": "string"},
            "time_window_hours": {"type": "integer"},
        },
    }

    def execute(
        self,
        order_id: str = None,
        correlation_id: str = None,
        time_window_hours: int = 24,
    ):
        return opensearch_client.get_flow_timeline(
            order_id=order_id,
            correlation_id=correlation_id,
            time_window_hours=time_window_hours,
        )


class GetOrderFailureRcaTool(Tool):
    name = "get_order_failure_rca"
    description = "Analyze order failures using service-aware order flow: order -> inventory -> payment."
    input_schema = {
        "type": "object",
        "properties": {
            "order_id": {"type": "string"},
            "correlation_id": {"type": "string"},
            "time_window_hours": {"type": "integer"},
        },
    }

    def execute(
        self,
        order_id: str = None,
        correlation_id: str = None,
        time_window_hours: int = 24,
    ):
        timeline = opensearch_client.get_flow_timeline(
            order_id=order_id,
            correlation_id=correlation_id,
            time_window_hours=time_window_hours,
        )

        logs = timeline["timeline"]

        messages = " ".join(
            str(log.get("message", "")).lower() for log in logs
        )

        services_seen = timeline["services_seen"]

        has_inventory_failure = any(
            phrase in messages
            for phrase in [
                "out of stock",
                "inventory not available",
                "stock reservation failed",
                "failed to reserve inventory",
            ]
        )

        has_payment_failure = any(
            phrase in messages
            for phrase in [
                "payment failed",
                "payment processing failed",
                "payment not completed",
            ]
        )

        has_payment_service = "payment-service" in services_seen
        has_inventory_service = "inventory-service" in services_seen

        if has_inventory_failure and not has_payment_service:
            root_cause = "inventory_out_of_stock"
            explanation = "Inventory failed before the payment step. No payment-service logs were found for this flow."
        elif has_inventory_failure:
            root_cause = "inventory_issue"
            explanation = "Inventory failure logs were found in the flow."
        elif has_payment_failure:
            root_cause = "payment_issue"
            explanation = "Payment failure logs were found after inventory processing."
        elif has_inventory_service and has_payment_service:
            root_cause = "no_failure_detected"
            explanation = "Inventory and payment services both participated. No explicit failure signal found."
        else:
            root_cause = "unknown"
            explanation = "Insufficient timeline evidence to identify root cause."

        return {
            "root_cause": root_cause,
            "explanation": explanation,
            "services_seen": services_seen,
            "timeline": logs,
            "count": len(logs),
        }


class GetHttpMetricsTool(Tool):
    name = "get_http_metrics"
    description = "Get accurate HTTP request counts using Prometheus increase()."
    input_schema = {
        "type": "object",
        "properties": {
            "time_window_minutes": {"type": "integer"},
        },
    }

    def execute(self, time_window_minutes: int = 60):
        return prometheus_client.get_http_requests(time_window_minutes)


class GetBusinessMetricsTool(Tool):
    name = "get_business_metrics"
    description = "Get business metrics: orders, payments, inventory."
    input_schema = {"type": "object", "properties": {}}

    def execute(self):
        return prometheus_client.get_business_metrics()


class GetServiceHealthTool(Tool):
    name = "get_service_health"
    description = "Get service health using HTTP and business metrics."
    input_schema = {"type": "object", "properties": {}}

    def execute(self):
        return prometheus_client.get_service_health()


TOOLS = [
    SearchLogsTool(),
    GetFlowTimelineTool(),
    GetOrderFailureRcaTool(),
    GetHttpMetricsTool(),
    GetBusinessMetricsTool(),
    GetServiceHealthTool(),
]

app = FastAPI(title="ObservAI MCP Server", version="3.0.0")


@app.get("/")
def home():
    return {
        "service": "ObservAI MCP Server",
        "status": "running",
        "tools": [tool.name for tool in TOOLS],
    }


@app.get("/health")
def health():
    os_ok = opensearch_client.is_connected()
    prom_ok = prometheus_client.is_connected()

    return {
        "status": "healthy" if os_ok and prom_ok else "degraded",
        "opensearch": "connected" if os_ok else "disconnected",
        "prometheus": "connected" if prom_ok else "disconnected",
    }


@app.get("/tools")
def list_tools():
    return {
        "tools": [
            {
                "name": tool.name,
                "description": tool.description,
                "input_schema": tool.input_schema,
            }
            for tool in TOOLS
        ]
    }


@app.post("/tools/{tool_name}")
def execute_tool(tool_name: str, params: dict = None):
    params = params or {}

    for tool in TOOLS:
        if tool.name == tool_name:
            try:
                return {"success": True, "result": tool.execute(**params)}
            except Exception as e:
                return {"success": False, "error": str(e)}

    return {"success": False, "error": f"Tool '{tool_name}' not found"}