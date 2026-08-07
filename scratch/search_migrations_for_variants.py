import os

migrations_dir = r"C:\Users\gh\OneDrive\Desktop\parfumworld\supabase\migrations"

def main():
    print("Searching for 'variants' in migrations:")
    for root, dirs, files in os.walk(migrations_dir):
        for file in files:
            path = os.path.join(root, file)
            with open(path, 'r', encoding='utf-8') as f:
                content = f.read()
                if 'variant' in content.lower() or 'sku' in content.lower():
                    print(f"Found in {file}")

if __name__ == "__main__":
    main()
