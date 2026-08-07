import json
import os

transcript_path = r"C:\Users\gh\.gemini\antigravity\brain\47c1e9ef-02b6-488c-af38-655091e5823f\.system_generated\logs\transcript_full.jsonl"

def main():
    if not os.path.exists(transcript_path):
        print("Transcript file not found!")
        return

    with open(transcript_path, 'r', encoding='utf-8') as f:
        lines = f.readlines()
        
    print(f"Total lines: {len(lines)}")
    # Print the raw text of the last line
    print("--- RAW LAST LINE ---")
    last_line = lines[-1]
    print(last_line[:1000])
    print("...")
    print(last_line[-1000:])

if __name__ == "__main__":
    main()
