import json
import os

transcript_path = r"C:\Users\gh\.gemini\antigravity\brain\47c1e9ef-02b6-488c-af38-655091e5823f\.system_generated\logs\transcript_full.jsonl"

def main():
    if not os.path.exists(transcript_path):
        print("Transcript file not found!")
        return

    with open(transcript_path, 'r', encoding='utf-8') as f:
        for idx, line in enumerate(f):
            if "Baccarat" in line or "BOMBSHELL" in line:
                try:
                    data = json.loads(line)
                    print(f"Line {idx}: type={data.get('type')}, source={data.get('source')}, content_len={len(data.get('content', ''))}")
                except Exception as e:
                    # Maybe it's not JSON
                    print(f"Line {idx} error: {e}")

if __name__ == "__main__":
    main()
