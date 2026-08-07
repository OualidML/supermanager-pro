import os

src_dir = r"C:\Users\gh\OneDrive\Desktop\parfumworld\src"

def main():
    print("Listing all files in parfumworld/src:")
    for root, dirs, files in os.walk(src_dir):
        for file in files:
            path = os.path.relpath(os.path.join(root, file), src_dir)
            print(path)

if __name__ == "__main__":
    main()
