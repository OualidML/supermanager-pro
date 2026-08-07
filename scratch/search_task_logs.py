import os

tasks_dir = r"C:\Users\gh\.gemini\antigravity\brain\47c1e9ef-02b6-488c-af38-655091e5823f\.system_generated\tasks"

def main():
    if not os.path.exists(tasks_dir):
        print(f"Tasks directory not found at {tasks_dir}")
        return
        
    print("Searching task logs for 'db push' or 'supabase':")
    for file in os.listdir(tasks_dir):
        if file.endswith(".log"):
            path = os.path.join(tasks_dir, file)
            try:
                with open(path, 'r', encoding='utf-8') as f:
                    content = f.read()
                    if 'db push' in content or 'supabase' in content:
                        print(f"Found in {file}:")
                        # Print first few lines of content
                        lines = content.splitlines()
                        for line in lines[:5]:
                            print(f"  {line}")
            except Exception as e:
                pass

if __name__ == "__main__":
    main()
