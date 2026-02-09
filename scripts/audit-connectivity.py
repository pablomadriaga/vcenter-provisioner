import requests
import sys
import os

def check_service(name, url):
    print(f"Checking {name} at {url}...", end=" ")
    try:
        response = requests.get(url, timeout=2)
        if response.status_code == 200:
            print("✅ UP")
            return True
        else:
            print(f"⚠️ DOWN (Status: {response.status_code})")
            return False
    except Exception as e:
        print(f"❌ DEAD ({type(e).__name__})")
        return False

def verify_system():
    print("=== vCenter Provisioner: Inter-Service Connectivity Audit ===\n")
    
    # In a real Lab, these would be the Docker service names or localhost mappings
    services = {
        "API Gateway": "http://localhost:8080/health",
        "Auth Service": "http://localhost:8081/health",
        "Typing Service": "http://localhost:8000/health",
        "Orchestrator": "http://localhost:8083/health",
        "Monitoring": "http://localhost:8082/health"
    }
    
    results = []
    for name, url in services.items():
        results.append(check_service(name, url))
        
    print("\n--- Summary ---")
    if all(results):
        print("🚀 System is 100% Operational.")
    else:
        print("⚠️ Some services are unreachable. Ensure Docker matches local-dev-lab.md instructions.")

if __name__ == "__main__":
    verify_system()
