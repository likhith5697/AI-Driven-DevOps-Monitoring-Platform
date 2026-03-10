from openai import OpenAI
from dotenv import load_dotenv
import os

# Load environment variables from .env
load_dotenv()

# Read the API key from the .env file
api_key = os.getenv("OPENAI_API_KEY")
if not api_key:
    raise ValueError("OPENAI_API_KEY not found in .env file!")

client = OpenAI(api_key=api_key)

# Make a test chat request
response = client.chat.completions.create(
    model="gpt-3.5-turbo",  # Free/trial-friendly model
    messages=[{"role": "user", "content": "Hello"}]
)

# Print the model's response
print(response.choices[0].message.content)