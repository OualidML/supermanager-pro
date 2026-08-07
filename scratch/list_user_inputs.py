import json
import os

transcript_path = r"C:\Users\gh\.gemini\antigravity\brain\47c1e9ef-02b6-488c-af38-655091e5823f\.system_generated\logs\transcript_full.jsonl"

def main():
    if not os.path.exists(transcript_path):
        print("Transcript file not found!")
        return

    print("Reading transcript lines...")
    idx = 0
    with open(transcript_path, 'r', encoding='utf-8') as f:
        for line in f:
            if not line.strip():
                continue
            try:
                data = json.loads(line)
                if data.get('type') == 'USER_INPUT':
                    content = data.get('content', '')
                    print(f"[{idx}] Length of content: {len(content)}")
                    print(content[:200])
                    print("-" * 50)
                idx += 1
            except Exception as e:
                pass

if __name__ == "__main__":
    main()
