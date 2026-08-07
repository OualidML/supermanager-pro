import json

dataset_path = r"c:\Users\gh\OneDrive\Desktop\supermanager-pro\scratch\perfumes_dataset.json"

def main():
    with open(dataset_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
        
    print(f"Total entries: {len(data)}")
    
    # Check for duplicate names (case-insensitive) under different brands or genders
    name_map = {}
    for item in data:
        name = item["original_name"].lower()
        if name not in name_map:
            name_map[name] = []
        name_map[name].append(item)
        
    print(f"Unique names: {len(name_map)}")
    
    # Print names with multiple entries
    duplicates = {k: v for k, v in name_map.items() if len(v) > 1}
    print(f"Names with multiple brands/genders: {len(duplicates)}")
    
    # Print the first 20 duplicates
    for idx, (name, items) in enumerate(list(duplicates.items())[:20]):
        print(f"\n[{idx+1}] Name: '{name}'")
        for item in items:
            print(f"  Brand: '{item['brand']}' | Gender: {item['gender']} | Cat: {item['category']} | Variants: {[v['code'] for v in item['variants']]}")

if __name__ == "__main__":
    main()
