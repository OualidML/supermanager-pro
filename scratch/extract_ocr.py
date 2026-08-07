import json
import os

transcript_path = r"C:\Users\gh\.gemini\antigravity\brain\47c1e9ef-02b6-488c-af38-655091e5823f\.system_generated\logs\transcript_full.jsonl"
output_path = r"c:\Users\gh\OneDrive\Desktop\supermanager-pro\scratch\raw_ocr.txt"

def main():
    if not os.path.exists(transcript_path):
        print("Transcript file not found!")
        return

    print("Reading transcript lines...")
    last_user_input = None
    with open(transcript_path, 'r', encoding='utf-8') as f:
        for line in f:
            if not line.strip():
                continue
            try:
                data = json.loads(line)
                if data.get('type') == 'USER_INPUT':
                    last_user_input = data.get('content', '')
            except Exception as e:
                pass

    if not last_user_input:
        print("No user input step found in logs!")
        return

    print("Found last user input. Writing to raw_ocr.txt...")
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(last_user_input)
    print("Success! Saved to", output_path)

if __name__ == "__main__":
    main()
