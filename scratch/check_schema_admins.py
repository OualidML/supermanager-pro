import os

schema_path = r"C:\Users\gh\OneDrive\Desktop\parfumworld\supabase\migrations\20260801100000_schema.sql"

def main():
    if not os.path.exists(schema_path):
        print(f"File not found: {schema_path}")
        return
        
    print("Searching for admins table or trigger in schema.sql:")
    with open(schema_path, 'r', encoding='utf-8') as f:
        for idx, line in enumerate(f, 1):
            if 'admins' in line.lower():
                print(f"{idx}: {line.strip()[:120]}")

if __name__ == "__main__":
    main()
