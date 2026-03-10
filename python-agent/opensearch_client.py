from opensearchpy import OpenSearch, exceptions

# Connect to OpenSearch
client = OpenSearch(
    hosts=[{"host": "localhost", "port": 9200}],
    http_auth=("admin", "C0mpl3x$Admin!2026Secure"),
    use_ssl=False
)

INDEX_NAME = "node-service-logs"

def ensure_index():
    """Ensure the index exists with correct mapping"""
    try:
        if not client.indices.exists(index=INDEX_NAME):
            mapping = {
                "mappings": {
                    "properties": {
                        "timestamp": {"type": "date"},
                        "message": {"type": "text"},
                        "level": {"type": "keyword"},
                        "status": {"type": "integer"}
                    }
                }
            }
            client.indices.create(index=INDEX_NAME, body=mapping)
            print(f"Created OpenSearch index with mapping: {INDEX_NAME}")
    except exceptions.OpenSearchException as e:
        print("Error creating index:", e)

def search_logs(index=INDEX_NAME, query=None, size=10):
    """Fetch logs from OpenSearch, sorted by timestamp descending"""
    ensure_index()  # make sure index exists
    
    body = {
        "query": {
            "match_all": {} if not query else {"query_string": {"query": query}}
        },
        "size": size,
        "sort": [{"timestamp": {"order": "desc"}}]  # safe now, mapping exists
    }
    
    try:
        res = client.search(index=index, body=body)
        logs = [hit["_source"] for hit in res["hits"]["hits"]]
        return logs
    except exceptions.RequestError as e:
        print("Search error:", e)
        return []