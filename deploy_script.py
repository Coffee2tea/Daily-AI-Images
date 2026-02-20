import json
import requests
import time

url = "https://space.ai-builders.com/backend/v1/deployments"
token = "sk_e954e069_055cfe5e1e0e13a0e5cd1aaa141412afb110"

print("Reading deploy-config.json...")
try:
    with open("deploy-config.json", "r") as f:
        data = json.load(f)
except Exception as e:
    print(f"Error reading config: {e}")
    exit(1)

headers = {
    "Authorization": f"Bearer {token}",
    "Content-Type": "application/json",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Origin": "https://www.superlinear.academy",
    "Referer": "https://www.superlinear.academy/"
}

print(f"Deploying to {url} using requests...")

s = requests.Session()
# First visit the home page to get cookies/tokens
try:
    s.get("https://www.superlinear.academy/", headers=headers, timeout=10)
    print("Visited home page.")
except Exception as e:
    print(f"Warning visiting home page: {e}")

# Now post
try:
    response = s.post(url, json=data, headers=headers, timeout=120, verify=False)
    print(f"Status: {response.status_code}")
    import sys
    safe_text = response.text.encode('utf-8', errors='replace').decode(sys.stdout.encoding or 'utf-8', errors='replace')
    print("Response:", safe_text)
except Exception as e:
    print(f"Error: {e}")
