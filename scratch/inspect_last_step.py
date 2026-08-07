import json
import os

transcript_path = r"C:\Users\gh\.gemini\antigravity\brain\47c1e9ef-02b6-488c-af38-655091e5823f\.system_generated\logs\transcript_full.jsonl"

def main():
    if not os.path.exists(transcript_path):
        print("Transcript file not found!")
        return

    with open(transcript_path, 'r', encoding='utf-8') as f:
        lines = f.readlines()
        
    print(f"Total lines in transcript_full.jsonl: {len(lines)}")
    # Print the last few lines' types and lengths
    for idx, line in enumerate(lines[-5:]):
        try:
            data = json.loads(line)
            print(f"Index {len(lines)-5+idx}: type={data.get('type')}, source={data.get('source')}, status={data.get('status')}, content_len={len(data.get('content', ''))}")
        except Exception as e:
            print(f"Error parsing line {len(lines)-5+idx}: {e}")

    # Inspect the last user input's content
    for line in reversed(lines):
        try:
            data = json.loads(line)
            if data.get('type') == 'USER_INPUT':
                content = data.get('content', '')
                print(f"\n--- LAST USER INPUT (len={len(content)}) ---")
                print(content[:500])
                print("...")
                print(content[-500:])
                break
        except:
            pass

if __name__ == "__main__":
    main()
