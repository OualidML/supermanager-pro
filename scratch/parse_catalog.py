import re
import json

raw_ocr_path = r"c:\Users\gh\OneDrive\Desktop\supermanager-pro\scratch\raw_ocr.txt"
parsed_output_path = r"c:\Users\gh\OneDrive\Desktop\supermanager-pro\scratch\parsed_catalog.json"

def clean_name(name):
    # Remove leading/trailing garbage, % symbols
    name = re.sub(r'^\s*%\s*', '', name)
    name = re.sub(r'^\s*~\s*', '', name)
    name = name.strip()
    return name

def parse_line(line):
    line = line.strip()
    if not line:
        return None
    
    # Check if this is a header line or page marker
    if line.startswith("==") or "Code" in line or "Désignation" in line or "Prix" in line or "Designer Parfums" in line or "Niche Parfums" in line:
        return None
    
    # Split into tokens
    tokens = line.split()
    if len(tokens) < 3:
        return None
    
    # First token is the code
    code = tokens[0]
    
    # Last token is the price (try to parse it)
    price_str = tokens[-1]
    # Price might have comments or numbers
    # Let's extract digits from the price string
    price_match = re.search(r'\d+', price_str)
    if price_match:
        price = int(price_match.group(0))
    else:
        # If last token is not a price, maybe the line is malformed
        return None
    
    # Designation is everything in between
    designation = " ".join(tokens[1:-1])
    
    # Clean up designation
    designation = clean_name(designation)
    
    return {
        "code": code,
        "designation": designation,
        "price": price
    }

def get_base_entity(code, designation):
    # Normalize code
    clean_c = re.sub(r'^[+%~]+', '', code)
    # Extract digits prefix if code is mostly numeric
    digit_match = re.match(r'^(\d+)', clean_c)
    if digit_match:
        base_code = digit_match.group(1)
        # Strip leading zeros to normalize (e.g. 0101 -> 101, 309 -> 309)
        base_code = base_code.lstrip('0')
    else:
        base_code = clean_c
        
    # Normalize designation to find base name
    # Suffixes to remove from name:
    # U, H, F (genders - but wait, they might indicate the fragrance gender)
    # TOP, TOP +, TOP X3, TOP *2, A, B, C, D, N, T, x2, x3, x4, x5, x6, x7, x8
    # 2022, 2023, 2024, 2025 (we might keep or remove years, but let's look at duplicates)
    name = designation
    
    # Strip % or ~ from name
    name = re.sub(r'^[+%~]+', '', name)
    
    # Capture gender from name if present as standalone token (U, H, F, M, W)
    gender = "Unisex"
    gender_match = re.search(r'\b([UHF])\b', name)
    if gender_match:
        g = gender_match.group(1)
        if g == 'H':
            gender = 'Men'
        elif g == 'F':
            gender = 'Women'
        elif g == 'U':
            gender = 'Unisex'
            
    # Clean suffixes from the end of the name
    # e.g., "Baccarat Rouge 540 U Francis Kurkdjian TOP" -> "Baccarat Rouge 540 Francis Kurkdjian"
    cleaned_name = name
    
    # Suffix patterns at the end of the string
    suffix_patterns = [
        r'\bTOP\b\s*\+*',
        r'\bTOP\s*X\d+\b',
        r'\bTOP\s*\*?\d+\b',
        r'\bx\d+\b',
        r'\b[A-DTN]\b$',
        r'\bTOP\s*202\d\b',
        r'\b202\d\s*TOP\b',
        r'\bB\s*202\d\b',
        r'\bN\s*202\d\b'
    ]
    
    for pattern in suffix_patterns:
        cleaned_name = re.sub(pattern, '', cleaned_name, flags=re.IGNORECASE).strip()
        
    # Remove standalone gender tags to get the pure brand/perfume name
    cleaned_name = re.sub(r'\b[UHF]\b', '', cleaned_name).strip()
    # Normalize spaces
    cleaned_name = re.sub(r'\s+', ' ', cleaned_name).strip()
    
    return base_code, cleaned_name, gender

def main():
    with open(raw_ocr_path, 'r', encoding='utf-8') as f:
        content = f.read()
        
    lines = content.split('\n')
    parsed_items = []
    
    for line in lines:
        parsed = parse_line(line)
        if parsed:
            parsed_items.append(parsed)
            
    print(f"Total raw lines parsed as items: {len(parsed_items)}")
    
    # Deduplicate and group by base entity
    base_entities = {}
    
    for item in parsed_items:
        code = item['code']
        designation = item['designation']
        price = item['price']
        
        base_code, base_name, gender = get_base_entity(code, designation)
        
        # Suffix/grade determination
        # If code has trailing letter like 0101A -> grade is "Top Quality" or "A"
        grade = "Standard"
        code_clean = re.sub(r'^[+%~]+', '', code)
        grade_match = re.search(r'\d+([A-DTN])$', code_clean)
        if grade_match:
            g_char = grade_match.group(1)
            if g_char == 'A' or 'TOP' in designation.upper():
                grade = "Top Quality"
            elif g_char == 'B':
                grade = "Premium Quality"
            elif g_char == 'N' or g_char == 'T':
                grade = "Ultra Premium"
            else:
                grade = f"Grade {g_char}"
        elif 'TOP' in designation.upper():
            grade = "Top Quality"
            
        key = (base_code, base_name.lower())
        
        if key not in base_entities:
            base_entities[key] = {
                "base_code": base_code,
                "base_name": base_name,
                "gender": gender,
                "variants": []
            }
            
        # Add variant
        base_entities[key]["variants"].append({
            "code": code,
            "grade": grade,
            "price_per_100g": price
        })
        
    print(f"Total unique base entities found: {len(base_entities)}")
    
    # Convert to list and save
    output_list = list(base_entities.values())
    with open(parsed_output_path, 'w', encoding='utf-8') as f:
        json.dump(output_list, f, indent=2, ensure_ascii=False)
        
    print(f"Saved parsed catalog to {parsed_output_path}")

if __name__ == "__main__":
    main()
