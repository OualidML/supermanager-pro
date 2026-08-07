import os

workspace_dir = r"c:\Users\gh\OneDrive\Desktop\supermanager-pro"

def main():
    print("Listing all files in workspace recursively:")
    for root, dirs, files in os.walk(workspace_dir):
        # Skip node_modules and .git
        if 'node_modules' in root or '.git' in root:
            continue
        for file in files:
            path = os.path.join(root, file)
            print(path)

if __name__ == "__main__":
    main()
