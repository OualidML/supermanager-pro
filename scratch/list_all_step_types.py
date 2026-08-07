import json
import os

transcript_path = r"C:\Users\gh\.gemini\antigravity\brain\47c1e9ef-02b6-488c-af38-655091e5823f\.system_generated\logs\transcript_full.jsonl"

def main():
    with open(transcript_path, 'r', encoding='utf-8') as f:
        for idx, line in enumerate(f):
            try:
                data = json.loads(line)
                t = data.get('type')
                if t in ['USER_INPUT', 'CHECKPOINT', 'SYSTEM_MESSAGE']:
                    content = data.get('content', '')
                    print(f"Index {idx}: step_index={data.get('step_index')}, type={t}, source={data.get('source')}, len={len(content)}")
                    print(content[:150].replace('\n', ' '))
                    print("-" * 50)
            except Exception as e:
                pass

if __name__ == "__main__":
    main()
