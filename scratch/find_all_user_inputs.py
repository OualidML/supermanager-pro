import json
import os

transcript_path = r"C:\Users\gh\.gemini\antigravity\brain\47c1e9ef-02b6-488c-af38-655091e5823f\.system_generated\logs\transcript_full.jsonl"

def main():
    if not os.path.exists(transcript_path):
        print("Transcript file not found!")
        return

    with open(transcript_path, 'r', encoding='utf-8') as f:
        for idx, line in enumerate(f):
            try:
                data = json.loads(line)
                if data.get('type') == 'USER_INPUT':
                    content = data.get('content', '')
                    if "Baccarat" in content:
                        print(f"Step {idx}: len={len(content)}")
                        print(content[:300])
                        print("-" * 50)
            except Exception as e:
                pass

if __name__ == "__main__":
    main()
