
import urllib.request
import json
import time
import sys

def test_chat():
    url = "http://localhost:8000/api/chat"
    data = {
        "prompt": "Hello",
        "history": []
    }
    req = urllib.request.Request(url, 
        data=json.dumps(data).encode('utf-8'), 
        headers={'Content-Type': 'application/json'}
    )
    try:
        with urllib.request.urlopen(req) as response:
            if response.status == 200:
                body = json.loads(response.read().decode('utf-8'))
                if "text" in body:
                    print(f"Chat Endpoint: OK. Response: {body['text'][:20]}...")
                    return True
                else:
                    print("Chat Endpoint: Unexpected response format")
                    return False
            else:
                print(f"Chat Endpoint: Failed with status {response.status}")
                return False
    except Exception as e:
        # Don't print error while waiting for server to come up
        return False

print("Waiting for server to start...")
# Try for 20 seconds
for i in range(10):
    if test_chat():
        print("Verification Successful!")
        sys.exit(0)
    time.sleep(2)

print("Server connection failed.")
sys.exit(1)
