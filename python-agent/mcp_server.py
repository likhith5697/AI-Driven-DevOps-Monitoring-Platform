import os
from datetime import datetime, timezone, timedelta
from typing import Any, Optional

from fastapi import FastAPI
import requests
from opensearchpy import OpenSearch


OPENSEARCH_HOST = os.getenv("OPENSEARCH_HOST", "localhost")
OPENSEARCH_PORT = int(os.getenv("OPENSEARCH_PORT", "9200"))
OPENSEARCH_USER = os.getenv("OPENSEARCH_USER", "admin")
OPENSEARCH_PASSWORD = os.getenv("OPENSEARCH_PASSWORD", "C0mpl3x$Admin!2026Secure")
OPENSEARCH_INDEX_PATTERN = os.getenv("OPENSEARCH_INDEX_PATTERN", "*service-logs-*")

PROMETHEUS_URL = os.getenv("PROMETHEUS_URL", "http://localhost:9090")


class OpenSearchClient:
    def __init__(self):
        self.client = OpenSearch(
            hosts=[{"host": OPENSEARCH_HOST, "port": OPENSEARCH_PORT}],
            http_auth=(OPENSEARCH_USER, OPENSEARCH_PASSWORD),
            use_ssl=False,
            verify_certs=False,
            timeout=30
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
        size: int = 20,
        time_window_hours: int = 1
    ) -> list:
        end = datetime.now(timezone.utc)
        start = end - timedelta(hours=time_window_hours)

        must = [
            {
                "range": {
                    "timestamp": {
                        "gte": start.isoformat(),
                        "lte": end.isoformat()
                    }
                }
            }
        ]

        if query:
            must.append({
                "query_string": {
                    "query": query,
                    "fields": [
                        "message",
                        "service",
                        "level",
                        "orderId",
                        "paymentId",
                        "reservationId",
                        "correlationId",
                        "*"
                    ],
                    "default_operator": "OR"
                }
            })

        body = {
            "query": {
                "bool": {
                    "must": must
                }
            },
            "size": size,
            "sort": [
                {
                    "timestamp": {
                        "order": "desc"
                    }
                }
            ]
        }

        try:
            res = self.client.search(index=OPENSEARCH_INDEX_PATTERN, body=body)
            return [hit["_source"] for hit in res["hits"]["hits"]]
        except Exception as e:
            return [{"error": str(e)}]

    def get_recent_logs(self, size: int = 20) -> list:
        return self.search_logs(size=size, time_window_hours=24)

    def get_order_logs(self, order_id: str) -> list:
        return self.search_logs(
            query=f'orderId:"{order_id}"',
            size=50,
            time_window_hours=24
        )

    def get_correlation_logs(self, correlation_id: str) -> list:
        return self.search_logs(
            query=f'correlationId:"{correlation_id}"',
            size=100,
            time_window_hours=24
        )


class PrometheusClient:
    def __init__(self):
        self.url = PROMETHEUS_URL

    def is_connected(self) -> bool:
        try:
            response = requests.get(f"{self.url}/-/healthy", timeout=5)
            return response.status_code == 200
        except Exception:
            return False

    def query(self, promql: str) -> list:
        try:
            response = requests.get(
                f"{self.url}/api/v1/query",
                params={"query": promql},
                timeout=10
            )
            data = response.json()

            if data.get("status") != "success":
                return []

            return data.get("data", {}).get("result", [])
        except Exception as e:
            return [{"error": str(e)}]

    def get_http_requests(self, time_window_minutes: int = 60) -> dict:
        query = f"sum by (service, status) (increase(http_requests_total[{time_window_minutes}m]))"
        results = self.query(query)

        total = 0
        success = 0
        fail = 0
        by_status = {}

        for item in results:
            metric = item.get("metric", {})
            status = metric.get("status", "unknown")
            service = metric.get("service", "unknown")

            value = float(item.get("value", [0, 0])[1])
            total += value

            key = f"{service}:{status}"
            by_status[key] = round(value, 2)

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
            "by_status": by_status
        }

    def get_metrics_summary(self) -> dict:
        return {
            "http_requests_60m": self.get_http_requests(60),
            "orders_created_total": self.query("orders_created_total"),
            "orders_failed_total": self.query("orders_failed_total"),
            "payments_total": self.query("payments_total"),
            "payments_amount_total": self.query("payments_amount_total"),
            "inventory_stock": self.query("inventory_product_stock")
        }

    def get_service_health(self) -> dict:
        metrics = self.get_http_requests(60)

        status = "healthy"
        if metrics["fail"] > 0:
            status = "degraded"
        if metrics["total"] == 0:
            status = "unknown"

        return {
            "status": status,
            "http_requests": metrics,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }


opensearch_client = OpenSearchClient()
prometheus_client = PrometheusClient()


class Tool:
    name = ""
    description = ""
    input_schema = {}

    def execute(self, **kwargs) -> Any:
        raise NotImplementedError


class GetRecentLogsTool(Tool):
    name = "get_recent_logs"
    description = "Get recent logs across all services."
    input_schema = {
        "type": "object",
        "properties": {
            "size": {"type": "integer"}
        }
    }

    def execute(self, size: int = 20):
        logs = opensearch_client.get_recent_logs(size=size)
        return {"logs": logs, "count": len(logs)}


class SearchLogsTool(Tool):
    name = "search_logs"
    description = "Search logs by keyword, error, service, orderId, correlationId."
    input_schema = {
        "type": "object",
        "properties": {
            "query": {"type": "string"},
            "size": {"type": "integer"},
            "time_window_hours": {"type": "integer"}
        }
    }

    def execute(self, query: str = None, size: int = 20, time_window_hours: int = 1):
        logs = opensearch_client.search_logs(
            query=query,
            size=size,
            time_window_hours=time_window_hours
        )
        return {"logs": logs, "count": len(logs)}


class GetOrderLogsTool(Tool):
    name = "get_order_logs"
    description = "Trace a specific order by orderId."
    input_schema = {
        "type": "object",
        "properties": {
            "order_id": {"type": "string"}
        },
        "required": ["order_id"]
    }

    def execute(self, order_id: str):
        logs = opensearch_client.get_order_logs(order_id)
        return {"logs": logs, "count": len(logs)}


class GetCorrelationLogsTool(Tool):
    name = "get_correlation_logs"
    description = "Trace a request across services by correlationId."
    input_schema = {
        "type": "object",
        "properties": {
            "correlation_id": {"type": "string"}
        },
        "required": ["correlation_id"]
    }

    def execute(self, correlation_id: str):
        logs = opensearch_client.get_correlation_logs(correlation_id)
        return {"logs": logs, "count": len(logs)}


class GetServiceHealthTool(Tool):
    name = "get_service_health"
    description = "Get current service health from Prometheus."
    input_schema = {
        "type": "object",
        "properties": {}
    }

    def execute(self):
        return prometheus_client.get_service_health()


class GetHttpMetricsTool(Tool):
    name = "get_http_metrics"
    description = "Get HTTP request metrics from Prometheus."
    input_schema = {
        "type": "object",
        "properties": {
            "time_window_minutes": {"type": "integer"}
        }
    }

    def execute(self, time_window_minutes: int = 60):
        return prometheus_client.get_http_requests(time_window_minutes)


class GetMetricsSummaryTool(Tool):
    name = "get_metrics_summary"
    description = "Get key metrics summary."
    input_schema = {
        "type": "object",
        "properties": {}
    }

    def execute(self):
        return prometheus_client.get_metrics_summary()


TOOLS = [
    GetRecentLogsTool(),
    SearchLogsTool(),
    GetOrderLogsTool(),
    GetCorrelationLogsTool(),
    GetServiceHealthTool(),
    GetHttpMetricsTool(),
    GetMetricsSummaryTool()
]

app = FastAPI(title="ObservAI MCP Server", version="2.0.0")


@app.get("/")
def home():
    return {
        "service": "ObservAI MCP Server",
        "status": "running",
        "tools": [tool.name for tool in TOOLS]
    }


@app.get("/health")
def health():
    os_ok = opensearch_client.is_connected()
    prom_ok = prometheus_client.is_connected()

    return {
        "status": "healthy" if os_ok and prom_ok else "degraded",
        "opensearch": "connected" if os_ok else "disconnected",
        "prometheus": "connected" if prom_ok else "disconnected"
    }


@app.get("/tools")
def list_tools():
    return {
        "tools": [
            {
                "name": tool.name,
                "description": tool.description,
                "input_schema": tool.input_schema
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
                result = tool.execute(**params)
                return {
                    "success": True,
                    "result": result
                }
            except Exception as e:
                return {
                    "success": False,
                    "error": str(e)
                }

    return {
        "success": False,
        "error": f"Tool '{tool_name}' not found"
    }