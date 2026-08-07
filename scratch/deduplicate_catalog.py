import json
import re

parsed_catalog_path = r"c:\Users\gh\OneDrive\Desktop\supermanager-pro\scratch\parsed_full_catalog.json"

def clean_perfume_name(name):
    # Normalize spaces and lower case
    name = name.lower()
    name = re.sub(r'\s+', ' ', name).strip()
    # Remove common brand names from the perfume name to get the base fragrance
    brands_to_remove = [
        "francis kurkdjian", "f.kurkdjian", "montale", "louis vuitton", "creed", "parfums de marly", "xerjoff", 
        "tiziana terenzi", "nishane", "byredo", "nassomatto", "nasomatto", "amouage", "acqua di parma", "kilian", 
        "by kilian", "venezia 1920", "penhaligon's", "ex nihilo", "thomas kosmala", "bdk", "orto parisi", "le labo", 
        "initio", "rebatchi", "marc-antoine barrois", "kayali", "jo malone", "roja dove", "roja", "arise", 
        "rosendo mateu", "liquides imaginaires", "ariana grande", "frederic malle", "atelier cologne", 
        "escentric molecules", "diptyque", "moresque", "floraïku", "giardini di toscana", "juliette has a gun", 
        "boadicea the victorious", "gissah", "stéphane humbert lucas", "gritti", "essential parfums", 
        "maison crivelli", "kajal", "anfas", "coach", "fragrance one", "goldfield & banks", "unique'e luxury", 
        "aramis", "laverne", "matiere premiere", "ramón béjar", "ramon béjar", "vertus", "house of sillage", 
        "kerene", "kerosene", "ibraheem alqurashi", "lancome", "victoria's secret", "al rehab", "surrati", 
        "ajmal", "banafa", "dior", "d&g", "gucci", "tom ford", "ard al zaafaran", "franck olivier", 
        "taif al emarat", "swiss arabian", "arabian oud", "armani", "giorgio armani", "burberry", "chanel", "lacoste", 
        "givenchy", "ysl", "yves saint laurent", "azzaro", "escada", "hugo boss", "boss", "carolina herrera", 
        "guerlain", "hermes", "jpg", "jean paul gaultier", "zara", "cacharel", "britney spears", "cartier", 
        "cerruti", "davidoff", "diesel", "nina ricci", "ralph lauren", "polo", "versace", "viktor & rolf", 
        "banderas", "lanvin", "balman", "mancera", "bvlgari", "chloe", "calvin klein", "jimmy choo", 
        "issey miyake", "kenzo", "mont blanc", "narciso rodriguez", "nikos", "roberto cavalli", "sospiro", 
        "mercedes-benz", "yves rocher", "brut", "valentino", "clinique", "elie saab", "joop", "nautica", 
        "tommy hilfiger", "thierry mugler", "mugler", "marc jacobs", "prada", "dunhill", "guy laroche", 
        "evaflora", "jaguar", "dove", "fa", "nivea", "aqualina", "lolita lempicka", "zadig & voltaire", 
        "rochas", "tesori d'orient", "franck boclet", "giorgio monti", "byron", "lt piver", "chopard", 
        "david beckham", "sistelle", "ferrari", "armaf", "emmanuel jane", "moschino", "cristiano ronald", 
        "jacques bogart", "french avenue"
    ]
    
    for brand in brands_to_remove:
        # Avoid removing brand name if it leaves the string empty
        pattern = r'\b' + re.escape(brand) + r'\b'
        temp = re.sub(pattern, '', name).strip()
        if temp:
            name = temp
            
    # Remove common suffixes like "top", "type", "oil", "inspiration", "parfums", "edp", "edt", "parfum", "cologne"
    suffixes = ["top", "type", "oil", "inspiration", "parfums", "edp", "edt", "parfum", "cologne", "intense", "elixir", "essence"]
    for s in suffixes:
        pattern = r'\b' + s + r'\b'
        temp = re.sub(pattern, '', name).strip()
        if temp:
            name = temp
            
    name = re.sub(r'\s+', ' ', name).strip()
    return name

def main():
    with open(parsed_catalog_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
        
    print(f"Original base entities count: {len(data)}")
    
    unique_names = {}
    for item in data:
        base_name = item['base_name']
        gender = item['gender']
        base_code = item['base_code']
        variants = item['variants']
        
        cleaned = clean_perfume_name(base_name)
        if not cleaned:
            cleaned = base_name.lower()
            
        key = (cleaned, gender)
        if key not in unique_names:
            unique_names[key] = {
                "cleaned_name": cleaned,
                "original_names": set(),
                "gender": gender,
                "base_codes": set(),
                "variants": []
            }
            
        unique_names[key]["original_names"].add(base_name)
        unique_names[key]["base_codes"].add(base_code)
        unique_names[key]["variants"].extend(variants)
        
    print(f"Deduplicated unique names count: {len(unique_names)}")
    
    # Sort and print some statistics
    sorted_unique = sorted(unique_names.values(), key=lambda x: x["cleaned_name"])
    print("\n--- FIRST 50 DEDUPLICATED NAMES ---")
    for idx, item in enumerate(sorted_unique[:50]):
        orig_names = ", ".join(list(item["original_names"]))
        codes = ", ".join(list(item["base_codes"]))
        print(f"[{idx+1}] Cleaned: '{item['cleaned_name']}' | Codes: {codes} | Gender: {item['gender']}")
        print(f"    Orig: {orig_names}")

if __name__ == "__main__":
    main()
