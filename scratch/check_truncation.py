import json
import os

transcript_path = r"C:\Users\gh\.gemini\antigravity\brain\47c1e9ef-02b6-488c-af38-655091e5823f\.system_generated\logs\transcript_full.jsonl"

def main():
    with open(transcript_path, 'r', encoding='utf-8') as f:
        for idx, line in enumerate(f):
            try:
                data = json.loads(line)
                if data.get('step_index') == 1577:
                    print(f"Step 1577: type={data.get('type')}, keys={list(data.keys())}")
                    if 'is_truncated' in data:
                        print(f"  is_truncated={data['is_truncated']}")
                    content = data.get('content', '')
                    print(f"  content length={len(content)}")
                    print(f"  content ends with: {content[-100:]}")
            except Exception as e:
                pass

if __name__ == "__main__":
    main()
