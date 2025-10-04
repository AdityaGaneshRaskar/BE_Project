import os
import requests
from dotenv import load_dotenv

# Load .env file
load_dotenv()

API_KEY = os.getenv("GEMINI_API_KEY")
if not API_KEY:
    raise ValueError("❌ No GEMINI_API_KEY found in .env file!")

url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent"

headers = {
    "Content-Type": "application/json",
    "x-goog-api-key": API_KEY,
}

data = {
    "contents": [
        {"parts": [{"text": "Give me a short motivational quote"}]}
    ]
}

print("🔄 Sending request to Gemini API...")

response = requests.post(url, headers=headers, json=data)

if response.status_code == 200:
    resp_json = response.json()
    print("✅ Gemini API Response:")
    print(resp_json["candidates"][0]["content"]["parts"][0]["text"])
else:
    print(f"❌ Error {response.status_code}: {response.text}")
