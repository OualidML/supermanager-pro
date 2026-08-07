import os

logs_dir = r"C:\Users\gh\.gemini\antigravity\brain\47c1e9ef-02b6-488c-af38-655091e5823f"

def main():
    print("Listing files in brain folder recursively:")
    for root, dirs, files in os.walk(logs_dir):
        for file in files:
            path = os.path.join(root, file)
            print(path)

if __name__ == "__main__":
    main()
