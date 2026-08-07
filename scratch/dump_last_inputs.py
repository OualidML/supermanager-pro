import json
import os

transcript_path = r"C:\Users\gh\.gemini\antigravity\brain\47c1e9ef-02b6-488c-af38-655091e5823f\.system_generated\logs\transcript_full.jsonl"

def main():
    if not os.path.exists(transcript_path):
        print("Transcript file not found!")
        return

    # Let's search for "Baccarat Rouge 540" or "==Start of PDF==" in the logs
    with open(transcript_path, 'r', encoding='utf-8') as f:
        for idx, line in enumerate(f):
            if "Baccarat Rouge 540" in line:
                try:
                    data = json.loads(line)
                    print(f"Line {idx}: type={data.get('type')}, source={data.get('source')}, content_len={len(data.get('content', ''))}")
                    # Print first 200 chars of content
                    print(data.get('content', '')[:300])
                    print("="*50)
                except Exception as e:
                    print(f"Error parsing line {idx}: {e}")

if __name__ == "__main__":
    main()
