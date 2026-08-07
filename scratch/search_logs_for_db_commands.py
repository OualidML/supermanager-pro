import os
import json

log_file = r"C:\Users\gh\.gemini\antigravity\brain\47c1e9ef-02b6-488c-af38-655091e5823f\.system_generated\logs\transcript_full.jsonl"

def main():
    if not os.path.exists(log_file):
        print(f"Log file not found at {log_file}")
        return
        
    print("Searching for db push commands in brain transcript logs:")
    with open(log_file, 'r', encoding='utf-8') as f:
        for line in f:
            try:
                data = json.loads(line)
                # Look for tool calls containing "supabase" or "db push"
                tool_calls = data.get("tool_calls", [])
                for tc in tool_calls:
                    if "supabase" in str(tc) or "push" in str(tc):
                        print(json.dumps(tc, indent=2))
            except:
                pass

if __name__ == "__main__":
    main()
