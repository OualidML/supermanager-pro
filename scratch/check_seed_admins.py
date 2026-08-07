import os

seed_path = r"C:\Users\gh\OneDrive\Desktop\parfumworld\supabase\migrations\20260801200000_seed.sql"

def main():
    if not os.path.exists(seed_path):
        print(f"File not found: {seed_path}")
        return
        
    print("Searching for admins or auth inserts in seed.sql:")
    with open(seed_path, 'r', encoding='utf-8') as f:
        for idx, line in enumerate(f, 1):
            if 'admin' in line.lower() or 'auth' in line.lower():
                print(f"{idx}: {line.strip()[:120]}")

if __name__ == "__main__":
    main()
