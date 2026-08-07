import os
from pypdf import PdfReader

pdf1_path = r"C:\Users\gh\.gemini\antigravity\brain\47c1e9ef-02b6-488c-af38-655091e5823f\.user_uploaded\media__1785882283542.pdf"
pdf2_path = r"C:\Users\gh\.gemini\antigravity\brain\47c1e9ef-02b6-488c-af38-655091e5823f\.user_uploaded\media__1785882303678.pdf"

out1_path = r"c:\Users\gh\OneDrive\Desktop\supermanager-pro\scratch\pdf1_text.txt"
out2_path = r"c:\Users\gh\OneDrive\Desktop\supermanager-pro\scratch\pdf2_text.txt"

def extract_pdf_text(pdf_path, out_path):
    if not os.path.exists(pdf_path):
        print(f"File {pdf_path} not found!")
        return False
        
    print(f"Reading {pdf_path}...")
    reader = PdfReader(pdf_path)
    text_content = []
    
    for idx, page in enumerate(reader.pages):
        text = page.extract_text()
        text_content.append(f"=== PAGE {idx+1} ===")
        text_content.append(text)
        
    with open(out_path, 'w', encoding='utf-8') as f:
        f.write("\n".join(text_content))
        
    print(f"Extracted {len(reader.pages)} pages to {out_path}")
    return True

def main():
    extract_pdf_text(pdf1_path, out1_path)
    extract_pdf_text(pdf2_path, out2_path)

if __name__ == "__main__":
    main()
