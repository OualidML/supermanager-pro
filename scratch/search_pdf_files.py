import os

parfumworld_dir = r"c:\Users\gh\OneDrive\Desktop\parfumworld"

def main():
    print("Searching for PDF files in parfumworld:")
    for root, dirs, files in os.walk(parfumworld_dir):
        for file in files:
            if file.endswith('.pdf'):
                print(os.path.join(root, file))

if __name__ == "__main__":
    main()
