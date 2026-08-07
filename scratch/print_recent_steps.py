import json
import os

transcript_path = r"C:\Users\gh\.gemini\antigravity\brain\47c1e9ef-02b6-488c-af38-655091e5823f\.system_generated\logs\transcript_full.jsonl"

def main():
    with open(transcript_path, 'r', encoding='utf-8') as f:
        lines = f.readlines()
        
    print(f"Total lines: {len(lines)}")
    for idx in range(1560, len(lines)):
        try:
            data = json.loads(lines[idx])
            content_snippet = data.get('content', '')[:100].replace('\n', ' ')
            print(f"[{idx}] step_index={data.get('step_index')}, type={data.get('type')}, source={data.get('source')}, status={data.get('status')}, len={len(data.get('content', ''))} snippet={content_snippet}")
        except Exception as e:
            print(f"[{idx}] Error: {e}")

if __name__ == "__main__":
    main()
