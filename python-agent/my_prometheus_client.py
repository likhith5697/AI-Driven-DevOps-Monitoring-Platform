import requests

PROM_URL = "http://localhost:9090"

def query_prometheus(metric_query):
    try:
        url = f"{PROM_URL}/api/v1/query"
        response = requests.get(url, params={"query": metric_query}, timeout=10)
        data = response.json()
        if data["status"] != "success":
            return []
        results = data["data"]["result"]
        return results
    except Exception as e:
        print(f"Prometheus query error: {e}")
        return []