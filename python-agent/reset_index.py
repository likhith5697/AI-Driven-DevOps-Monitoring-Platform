from opensearchpy import OpenSearch

# Connect to OpenSearch
client = OpenSearch(
    hosts=[{"host": "localhost", "port": 9200}],
    http_auth=("admin", "C0mpl3x$Admin!2026Secure"),
    use_ssl=False
)

INDEX_NAME = "node-service-logs"

# Delete the index
if client.indices.exists(index=INDEX_NAME):
    client.indices.delete(index=INDEX_NAME)
    print(f"Deleted index: {INDEX_NAME}")
else:
    print(f"Index {INDEX_NAME} does not exist")