import os

desktop_dir = r"c:\Users\gh\OneDrive\Desktop"

def main():
    print("Searching for PDF files on Desktop:")
    for root, dirs, files in os.walk(desktop_dir):
        if 'node_modules' in root or '.git' in root:
            continue
        for file in files:
            if file.endswith('.pdf'):
                print(os.path.join(root, file))

if __name__ == "__main__":
    main()
