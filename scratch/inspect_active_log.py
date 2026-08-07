import json
import os

transcript_path = r"C:\Users\gh\.gemini\antigravity\brain\47c1e9ef-02b6-488c-af38-655091e5823f\.system_generated\logs\transcript_full.jsonl"

def main():
    with open(transcript_path, 'r', encoding='utf-8') as f:
        lines = f.readlines()
        
    print(f"Total lines: {len(lines)}")
    # Print the types of the last 15 lines
    for idx in range(max(0, len(lines)-15), len(lines)):
        try:
            data = json.loads(lines[idx])
            print(f"Line {idx}: type={data.get('type')}, source={data.get('source')}, content_len={len(data.get('content', ''))}")
        except Exception as e:
            print(f"Error parsing line {idx}: {e}")

if __name__ == "__main__":
    main()
