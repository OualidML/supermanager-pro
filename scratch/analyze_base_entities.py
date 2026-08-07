import json

parsed_catalog_path = r"c:\Users\gh\OneDrive\Desktop\supermanager-pro\scratch\parsed_full_catalog.json"

def main():
    with open(parsed_catalog_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
        
    print(f"Loaded {len(data)} base entities.")
    
    # Let's print the first 100 entities sorted by base_code
    sorted_data = sorted(data, key=lambda x: (x.get('base_code', ''), x.get('base_name', '')))
    
    print("\n--- FIRST 100 ENTRIES ---")
    for idx, item in enumerate(sorted_data[:100]):
        variants_summary = ", ".join([f"{v['code']}({v['grade']}:{v['price_per_100g']})" for v in item['variants']])
        print(f"[{idx+1}] Code={item['base_code']} Gender={item['gender']} Name={item['base_name']}")
        print(f"    Variants: {variants_summary}")

if __name__ == "__main__":
    main()
