import os
import requests
from dotenv import load_dotenv

load_dotenv()

api_key = os.getenv("GEMINI_API_KEY")

url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent"

headers = {
    "Content-Type": "application/json",
    "x-goog-api-key": api_key
}

payload = {
    "contents": [
        {
            "parts": [
                {"text": "Say hello in one sentence"}
            ]
        }
    ]
}

r = requests.post(url, headers=headers, json=payload)

print("Status:", r.status_code)
print(r.text)