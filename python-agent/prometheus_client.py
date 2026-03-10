import requests

PROM_URL = "http://localhost:9090"

def query_prometheus(metric_query):
    url = f"{PROM_URL}/api/v1/query"
    response = requests.get(url, params={"query": metric_query})
    data = response.json()
    if data["status"] != "success":
        return []
    results = data["data"]["result"]
    return results