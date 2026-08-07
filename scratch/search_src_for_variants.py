import os

src_dir = r"C:\Users\gh\OneDrive\Desktop\parfumworld\src"

def main():
    print("Searching for 'variant' or 'grade' in src:")
    for root, dirs, files in os.walk(src_dir):
        for file in files:
            if file.endswith(('.ts', '.tsx', '.json', '.js', '.jsx')):
                path = os.path.join(root, file)
                try:
                    with open(path, 'r', encoding='utf-8') as f:
                        content = f.read()
                        if 'variant' in content.lower() or 'grade' in content.lower() or 'price_per_100g' in content.lower():
                            print(f"Found in {os.path.relpath(path, src_dir)}")
                except:
                    pass

if __name__ == "__main__":
    main()
