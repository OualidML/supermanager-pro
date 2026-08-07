import json
import os

transcript_path = r"C:\Users\gh\.gemini\antigravity\brain\47c1e9ef-02b6-488c-af38-655091e5823f\.system_generated\logs\transcript_full.jsonl"

def main():
    with open(transcript_path, 'r', encoding='utf-8') as f:
        lines = f.readlines()
        
    for idx in range(1595, min(1615, len(lines))):
        try:
            data = json.loads(lines[idx])
            print(f"[{idx}] type={data.get('type')}, source={data.get('source')}, content_len={len(data.get('content', ''))}")
            # If content has length, print first 100 characters of content
            content = data.get('content', '')
            if content:
                print(f"  Content: {content[:150]}")
        except Exception as e:
            print(f"[{idx}] Error: {e}")

if __name__ == "__main__":
    main()
