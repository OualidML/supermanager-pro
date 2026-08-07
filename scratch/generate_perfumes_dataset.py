import re
import json

pdf1_path = r"c:\Users\gh\OneDrive\Desktop\supermanager-pro\scratch\pdf1_text.txt"
pdf2_path = r"c:\Users\gh\OneDrive\Desktop\supermanager-pro\scratch\pdf2_text.txt"
dataset_output_path = r"c:\Users\gh\OneDrive\Desktop\supermanager-pro\scratch\perfumes_dataset.json"

# Define brand mappings based on code prefixes (e.g. 3xx -> Louis Vuitton)
# We match from longest prefix to shortest
brand_ranges = [
    # 4 digits
    ("^210", "Le Labo", "Niche"),
    ("^220", "Initio Parfums Prives", "Niche"),
    ("^230", "Maison Rebatchi", "Niche"),
    ("^250", "Marc-Antoine Barrois", "Niche"),
    ("^260", "Kayali", "Niche"),
    ("^261", "Kayali", "Niche"),
    ("^270", "Jo Malone London", "Niche"),
    ("^280", "Roja Dove", "Niche"),
    ("^290", "Rosendo Mateu", "Niche"),
    ("^300", "Liquides Imaginaires", "Niche"),
    ("^310", "Initio Parfums Prives", "Niche"),
    ("^320", "Ariana Grande", "Designer"),
    ("^330", "Frederic Malle", "Niche"),
    ("^350", "Atelier Cologne", "Niche"),
    ("^360", "Escentric Molecules", "Niche"),
    ("^370", "Diptyque", "Niche"),
    ("^380", "Moresque", "Niche"),
    ("^390", "Floraïku", "Niche"),
    ("^400", "Giardini Di Toscana", "Niche"),
    ("^410", "Juliette Has A Gun", "Niche"),
    ("^420", "Boadicea the Victorious", "Niche"),
    ("^430", "Gissah", "Niche"),
    ("^440", "Stéphane Humbert Lucas 777", "Niche"),
    ("^450", "Gritti", "Niche"),
    ("^460", "Essential Parfums", "Niche"),
    ("^470", "Maison Crivelli", "Niche"),
    ("^480", "Kajal", "Niche"),
    ("^490", "Anfas", "Niche"),
    ("^500", "Coach", "Designer"),
    ("^510", "Fragrance One", "Niche"),
    ("^520", "Goldfield & Banks", "Niche"),
    ("^530", "Unique'e Luxury", "Niche"),
    ("^540", "Aramis", "Designer"),
    ("^550", "Laverne", "Niche"),
    ("^560", "Matiere Premiere", "Niche"),
    ("^570", "Ramón Béjar", "Niche"),
    ("^580", "Vertus", "Niche"),
    ("^590", "House Of Sillage", "Niche"),
    ("^600", "Kerosene", "Niche"),
    ("^610", "Ibraheem AlQurashi", "Niche"),
    ("^620", "Maison Martin Margiela", "Designer"),
    ("^630", "Vilhelm Parfumerie", "Niche"),
    ("^640", "Lorenzo Pazzaglia", "Niche"),
    ("^650", "The 7 Virtues", "Niche"),
    ("^660", "Victoria's Secret", "Designer"),
    ("^670", "Caron", "Designer"),
    ("^680", "Thierry Mugler", "Designer"),
    ("^690", "Marc Jacobs", "Designer"),
    ("^720", "Prada", "Designer"),
    ("^730", "Dunhill", "Designer"),
    ("^740", "Guy Laroche", "Designer"),
    ("^750", "Evaflora", "Designer"),
    ("^760", "Jaguar", "Designer"),
    ("^770", "Dove", "Designer"),
    ("^780", "Aqualina", "Designer"),
    ("^800", "Lolita Lempicka", "Designer"),
    ("^810", "Zadig & Voltaire", "Designer"),
    ("^820", "Rochas", "Designer"),
    ("^830", "Tesori d'Orient", "Designer"),
    ("^840", "Franck Boclet", "Niche"),
    ("^850", "Giorgio Monti", "Designer"),
    ("^860", "Byron", "Niche"),
    ("^880", "Lt Piver", "Niche"),
    ("^890", "Chopard", "Designer"),
    ("^900", "David Beckham", "Designer"),
    ("^910", "Ted Lapidus", "Designer"),
    ("^920", "Yves de Sistelle", "Designer"),
    ("^930", "Ferrari", "Designer"),
    ("^940", "Jacques Bogart", "Designer"),
    ("^950", "Armaf", "Designer"),
    ("^960", "Emmanuel Jane", "Designer"),
    ("^970", "Moschino", "Designer"),
    ("^980", "Cristiano Ronaldo", "Designer"),
    # 3 digits
    ("^10[2-9]", "Maison Francis Kurkdjian", "Niche"),
    ("^110", "Maison Francis Kurkdjian", "Niche"),
    ("^20[1-9]", "Montale", "Niche"),
    ("^30[1-9]", "Louis Vuitton", "Niche"),
    ("^31[0-9]", "Louis Vuitton", "Niche"),
    ("^32[0-9]", "Louis Vuitton", "Niche"),
    ("^33[0-9]", "Louis Vuitton", "Niche"),
    ("^40[1-9]", "Creed", "Niche"),
    ("^50[1-9]", "Parfums de Marly", "Niche"),
    ("^51[0-9]", "Parfums de Marly", "Niche"),
    ("^60[1-9]", "Xerjoff", "Niche"),
    ("^61[0-9]", "Xerjoff", "Niche"),
    ("^70[1-9]", "Tiziana Terenzi", "Niche"),
    ("^80[1-9]", "Nishane", "Niche"),
    ("^90[1-9]", "Byredo", "Niche"),
    # Special prefixes
    ("^BO_ALMOKHTAR", "Banafa For Oud", "Oriental/Attar"),
    ("^BO_AMIR", "Banafa For Oud", "Oriental/Attar"),
    ("^BO_EMIRATES", "Banafa For Oud", "Oriental/Attar"),
    ("^BO_ISPHAN", "Banafa For Oud", "Oriental/Attar"),
    ("^BO_KING", "Banafa For Oud", "Oriental/Attar"),
    ("^BO_MILLE", "Banafa For Oud", "Oriental/Attar"),
    ("^BO_SHWAL", "Banafa For Oud", "Oriental/Attar"),
    ("^BO_SHWL", "Banafa For Oud", "Oriental/Attar"),
    ("^BO_Musk", "Shada Oud", "Oriental/Attar"),
    ("^BO_BCR", "Banafa For Oud", "Oriental/Attar"),
    ("^BO_KHANJAR", "Banafa For Oud", "Oriental/Attar"),
    ("^SR-", "Surrati", "Oriental/Attar"),
    ("^musk_", "Banafa For Oud", "Oriental/Attar"),
    ("^so-", "Shada Oud", "Oriental/Attar"),
    ("^CRM-", "Oriental Oils", "Oriental/Attar"),
    ("^MKH", "Oriental Oils", "Oriental/Attar"),
]

def parse_line(line):
    line = line.strip()
    if not line:
        return None
    
    # Check if this is a header line or page marker
    if line.startswith("==") or line.startswith("===") or "Code" in line or "Désignation" in line or "Prix" in line or "Designer Parfums" in line or "Niche Parfums" in line:
        return None
    
    # Split into tokens
    tokens = line.split()
    if len(tokens) < 3:
        return None
    
    # First token is the code
    code = tokens[0]
    
    # Last token is the price (try to parse it)
    price_str = tokens[-1]
    price_match = re.search(r'\d+', price_str)
    if price_match:
        price = int(price_match.group(0))
    else:
        return None
    
    # Designation is everything in between
    designation = " ".join(tokens[1:-1])
    designation = clean_designation(designation)
    
    return {
        "code": code,
        "designation": designation,
        "price": price
    }

def clean_designation(name):
    # Remove % or ~ or * or #
    name = re.sub(r'^[+%~\s*#]+', '', name)
    name = re.sub(r'[%\s*#~]+$', '', name)
    name = re.sub(r'\s+', ' ', name).strip()
    return name

def get_perfume_details(code, designation, section):
    clean_c = re.sub(r'^[+%~]+', '', code)
    
    # 1. Determine Brand & Category from Code Prefix
    brand = "Unknown Brand"
    category = "Designer"
    
    matched = False
    for pattern, br, cat in brand_ranges:
        if re.match(pattern, clean_c):
            brand = br
            category = cat
            matched = True
            break
            
    # 2. Check if we are in the Oriental section (page 7-8 of PDF 1, page 15-16 of PDF 2)
    # If the code is short and starts with 0 or 1, or is one of the attars
    is_oriental_section = section == "oriental"
    
    if is_oriental_section or category == "Oriental/Attar":
        category = "Oriental/Attar"
        # Parse brand from designation if it contains known oil brands
        if "Lattafa" in designation:
            brand = "Lattafa"
        elif "Al Rehab" in designation or "Al-Rehab" in designation or "AlRehab" in designation:
            brand = "Al Rehab"
        elif "Surrati" in designation:
            brand = "Surrati"
        elif "Ajmal" in designation:
            brand = "Ajmal"
        elif "Banafa" in designation:
            brand = "Banafa For Oud"
        elif "Arabian Oud" in designation:
            brand = "Arabian Oud"
        elif "Swiss Arabian" in designation:
            brand = "Swiss Arabian"
        elif "Dior" in designation:
            brand = "Dior"
        elif "Armani" in designation:
            brand = "Giorgio Armani"
        elif "Lancome" in designation or "LANCOME" in designation:
            brand = "Lancôme"
        elif "Tom Ford" in designation:
            brand = "Tom Ford"
        elif "Victoria's Secret" in designation or "V.Secret" in designation:
            brand = "Victoria's Secret"
        elif "Bvlgari" in designation or "Bulgari" in designation:
            brand = "Bvlgari"
        elif "Lacoste" in designation:
            brand = "Lacoste"
        elif "Chanel" in designation:
            brand = "Chanel"
        elif "Gucci" in designation:
            brand = "Gucci"
        elif "D&G" in designation or "Dolce" in designation:
            brand = "Dolce & Gabbana"
        elif "Thomas Kosmala" in designation:
            brand = "Thomas Kosmala"
        elif "Byredo" in designation:
            brand = "Byredo"
        elif "Maison Francis" in designation or "Kurkdjian" in designation:
            brand = "Maison Francis Kurkdjian"
        else:
            if brand == "Unknown Brand":
                brand = "Oriental Oils"
                
    # 3. If still unknown, try matching brand keywords from designation
    if brand == "Unknown Brand":
        # Check standard list
        known_brands = {
            "Maison Francis Kurkdjian": ["Francis Kurkdjian", "F.Kurkdjian", "Maison Francis"],
            "Montale": ["Montale"],
            "Louis Vuitton": ["Louis Vuitton", "Louis Vuion"],
            "Creed": ["Creed"],
            "Parfums de Marly": ["Parfums de Marly", "de Marly"],
            "Xerjoff": ["Xerjoff", "Casamorati"],
            "Tiziana Terenzi": ["Tiziana Terenzi", "TizianaTerenzi"],
            "Nishane": ["Nishane"],
            "Byredo": ["Byredo"],
            "Nasomatto": ["Nasomatto", "Nassomato"],
            "Amouage": ["Amouage"],
            "Acqua Di Parma": ["Acqua Di Parma", "Acqua di Parma"],
            "Kilian": ["Kilian", "By Kilian"],
            "Venezia 1920": ["Venezia 1920", "Venezia"],
            "Penhaligon's": ["Penhaligon's"],
            "Ex Nihilo": ["Ex Nihilo", "Ex Nihlo"],
            "Thomas Kosmala": ["Thomas Kosmala"],
            "BDK Parfums": ["BDK"],
            "Orto Parisi": ["Orto Parisi"],
            "Bharara": ["Bharara"],
            "Le Labo": ["Le Labo"],
            "Initio Parfums Prives": ["Initio"],
            "Maison Rebatchi": ["Rebatchi"],
            "Marc-Antoine Barrois": ["Marc-Antoine Barrois", "Barrois"],
            "Kayali": ["Kayali"],
            "Jo Malone London": ["Jo Malone"],
            "Roja Dove": ["Roja Dove", "Roja"],
            "Rosendo Mateu": ["Rosendo Mateu"],
            "Liquides Imaginaires": ["Liquides Imaginaires"],
            "Ariana Grande": ["Ariana Grande"],
            "Frederic Malle": ["Frederic Malle"],
            "Atelier Cologne": ["Atelier Cologne"],
            "Escentric Molecules": ["Escentric Molecules"],
            "Diptyque": ["Diptyque"],
            "Moresque": ["Moresque"],
            "Floraïku": ["Floraïku"],
            "Giardini Di Toscana": ["Giardini Di Toscana", "Giardini di Toscana"],
            "Juliette Has A Gun": ["Juliette Has A Gun"],
            "Boadicea the Victorious": ["Boadicea the Victorious", "Boadicea"],
            "Gissah": ["Gissah"],
            "Stéphane Humbert Lucas 777": ["Stéphane Humbert Lucas", "Humbert Lucas"],
            "Gritti": ["Gritti"],
            "Essential Parfums": ["Essential Parfums"],
            "Maison Crivelli": ["Maison Crivelli", "Maison Criveli"],
            "Kajal": ["Kajal"],
            "Anfas": ["Anfas"],
            "Coach": ["Coach"],
            "Fragrance One": ["Fragrance One"],
            "Goldfield & Banks": ["Goldfield & Banks", "Goldfield"],
            "Unique'e Luxury": ["Unique'e Luxury", "Unique'e"],
            "Aramis": ["Aramis"],
            "Laverne": ["Laverne"],
            "Matiere Premiere": ["Matiere Premiere"],
            "Ramón Béjar": ["Ramón Béjar", "Ramon B"],
            "Vertus": ["Vertus"],
            "House Of Sillage": ["House Of Sillage", "House of Sillage"],
            "Kerosene": ["Kerosene"],
            "Ibraheem AlQurashi": ["Ibraheem AlQurashi", "Ibraheem"],
            "Lorenzo Pazzaglia": ["Lorenzo Pazzaglia", "Pazzaglia"],
            "The 7 Virtues": ["The 7 Virtues"],
            "Chanel": ["Chanel", "CHANEL"],
            "Dior": ["Dior", "DIOR"],
            "Giorgio Armani": ["Armani", "ARMANI"],
            "Paco Rabanne": ["Paco Rabanne", "P.Rabanne", "Rabanne"],
            "Hermès": ["Hermès", "Hermes", "Herms"],
            "Dolce & Gabbana": ["Dolce & Gabbana", "Dolce&Gabbana", "D&G", "D&g"],
            "Gucci": ["Gucci", "GUCCI"],
            "Yves Saint Laurent": ["Yves Saint Laurent", "YSL", "YsL"],
            "Lancôme": ["Lancôme", "Lancome", "Lancôme"],
            "Hugo Boss": ["Hugo Boss", "Boss", "BOSS"],
            "Carolina Herrera": ["Carolina Herrera", "Carolina Hererra", "C.Herrera"],
            "Burberry": ["Burberry", "Buberry"],
            "Lacoste": ["Lacoste"],
            "Guerlain": ["Guerlain"],
            "Givenchy": ["Givenchy"],
            "Versace": ["Versace"],
            "Zara": ["Zara", "ZARA"],
            "Viktor & Rolf": ["Viktor & Rolf", "VICTOR&ROLPH", "Viktor&Rolf"],
            "Escada": ["Escada"],
            "Jean Paul Gaultier": ["Gaultier", "JPG"],
            "Thierry Mugler": ["Thierry Mugler", "Mugler"],
            "Marc Jacobs": ["Marc Jacobs"],
            "Prada": ["Prada"],
            "Dunhill": ["Dunhill"],
            "Cartier": ["Cartier"],
            "Bvlgari": ["Bvlgari", "Bulgari"],
            "Calvin Klein": ["Calvin Klein", "CK"],
            "Chloe": ["Chloe", "Chloé"],
            "Davidoff": ["Davidoff"],
            "Diesel": ["Diesel"],
            "Issey Miyake": ["Issey Miyake", "Issey Myake"],
            "Kenzo": ["Kenzo"],
            "Montblanc": ["Montblanc", "Mont Blanc", "Montblanc"],
            "Roberto Cavalli": ["Roberto Cavalli"],
            "Valentino": ["Valentino"],
            "Clinique": ["Clinique"],
            "Elie Saab": ["Elie Saab"],
            "Zara": ["Zara"],
            "Nivea": ["Nivea"],
            "Jacques Bogart": ["Jacques Bogart"],
            "French Avenue": ["French Avenue"],
        }
        
        for k_brand, keywords in known_brands.items():
            for kw in keywords:
                if kw.lower() in designation.lower():
                    brand = k_brand
                    # Infer category
                    if k_brand in ["Creed", "Maison Francis Kurkdjian", "Montale", "Parfums de Marly", "Xerjoff", "Byredo", "Nasomatto", "Amouage", "Kilian", "Penhaligon's", "Ex Nihilo", "Thomas Kosmala", "BDK Parfums", "Orto Parisi", "Le Labo", "Initio Parfums Prives", "Maison Rebatchi", "Marc-Antoine Barrois", "Kayali", "Jo Malone London", "Roja Dove", "Frederic Malle", "Atelier Cologne", "Escentric Molecules", "Diptyque", "Moresque", "Floraïku", "Giardini Di Toscana", "Juliette Has A Gun", "Boadicea the Victorious", "Gissah", "Stéphane Humbert Lucas 777", "Gritti", "Essential Parfums", "Maison Crivelli", "Kajal", "Anfas", "Fragrance One", "Goldfield & Banks", "Unique'e Luxury", "Laverne", "Matiere Premiere", "Ramón Béjar", "Vertus", "House Of Sillage", "Kerosene", "Ibraheem AlQurashi", "Lorenzo Pazzaglia", "The 7 Virtues", "Vilhelm Parfumerie", "Franck Boclet", "Byron", "Lt Piver"]:
                        category = "Niche"
                    else:
                        category = "Designer"
                    break
            if brand != "Unknown Brand":
                break
                
    # 4. Extract Gender
    gender = "Unisex"
    gender_match = re.search(r'\b([UHF])\b', designation)
    if gender_match:
        g = gender_match.group(1)
        if g == 'H':
            gender = 'Men'
        elif g == 'F':
            gender = 'Women'
        elif g == 'U':
            gender = 'Unisex'
            
    # 5. Extract original name (remove brand, gender, and suffixes)
    original_name = designation
    # Remove brand name keywords
    brands_kw = [
        "Maison Francis Kurkdjian", "Francis Kurkdjian", "F.Kurkdjian", "Maison Francis",
        "Montale", "Louis Vuitton", "Louis Vuion", "Creed", "Parfums de Marly", "de Marly",
        "Xerjoff", "Casamorati", "Tiziana Terenzi", "TizianaTerenzi", "Nishane", "Byredo",
        "Nasomatto", "Nassomato", "Amouage", "Acqua Di Parma", "Acqua di Parma", "Kilian",
        "By Kilian", "Venezia 1920", "Venezia", "Penhaligon's", "Ex Nihilo", "Ex Nihlo",
        "Thomas Kosmala", "BDK Parfums", "BDK", "Orto Parisi", "Bharara", "Le Labo",
        "Initio Parfums Prives", "Initio", "Maison Rebatchi", "Rebatchi", "Marc-Antoine Barrois",
        "Barrois", "Kayali", "Jo Malone London", "Jo Malone", "Roja Dove", "Roja",
        "Rosendo Mateu", "Liquides Imaginaires", "Ariana Grande", "Frederic Malle",
        "Atelier Cologne", "Escentric Molecules", "Diptyque", "Moresque", "Floraïku",
        "Giardini Di Toscana", "Giardini di Toscana", "Juliette Has A Gun", "Boadicea the Victorious",
        "Boadicea", "Gissah", "Stéphane Humbert Lucas 777", "Humbert Lucas", "Gritti",
        "Essential Parfums", "Maison Crivelli", "Maison Criveli", "Kajal", "Anfas", "Coach",
        "Fragrance One", "Goldfield & Banks", "Goldfield", "Unique'e Luxury", "Unique'e",
        "Aramis", "Laverne", "Matiere Premiere", "Ramón Béjar", "Ramon B", "Vertus",
        "House Of Sillage", "House of Sillage", "Kerosene", "Ibraheem AlQurashi", "Ibraheem",
        "Lorenzo Pazzaglia", "Pazzaglia", "The 7 Virtues", "Chanel", "CHANEL", "Dior", "DIOR",
        "Giorgio Armani", "Armani", "ARMANI", "Paco Rabanne", "P.Rabanne", "Rabanne",
        "Hermès", "Hermes", "Herms", "Dolce & Gabbana", "Dolce&Gabbana", "D&G", "D&g",
        "Gucci", "GUCCI", "Yves Saint Laurent", "YSL", "YsL", "Lancôme", "Lancome", "Hugo Boss",
        "Boss", "BOSS", "Carolina Herrera", "Carolina Hererra", "C.Herrera", "Burberry", "Buberry",
        "Lacoste", "Guerlain", "Givenchy", "Versace", "Zara", "ZARA", "Viktor & Rolf",
        "VICTOR&ROLPH", "Viktor&Rolf", "Escada", "Jean Paul Gaultier", "Gaultier", "JPG",
        "Thierry Mugler", "Mugler", "Marc Jacobs", "Prada", "Dunhill", "Cartier", "Bvlgari",
        "Bulgari", "Calvin Klein", "CK", "Chloe", "Chloé", "Davidoff", "Diesel", "Issey Miyake",
        "Issey Myake", "Kenzo", "Montblanc", "Mont Blanc", "Roberto Cavalli", "Valentino",
        "Clinique", "Elie Saab", "Nivea", "Jacques Bogart", "French Avenue", "Al Rehab",
        "Al-Rehab", "AlRehab", "Surrati", "Ajmal", "Banafa", "Arabian Oud", "Swiss Arabian",
        "Shada Oud", "Oriental Oils"
    ]
    
    for kw in brands_kw:
        pattern = r'\b' + re.escape(kw) + r'\b'
        original_name = re.sub(pattern, '', original_name, flags=re.IGNORECASE).strip()
        
    # Remove gender standalone tokens
    original_name = re.sub(r'\b[UHF]\b', '', original_name).strip()
    
    # Suffixes patterns to clean
    suffix_patterns = [
        r'\bTOP\b\s*\+*',
        r'\bTOP\s*X\d+\b',
        r'\bTOP\s*\*?\d+\b',
        r'\bx\d+\b',
        r'\b[A-DTN]\b$',
        r'\bTOP\s*202\d\b',
        r'\b202\d\s*TOP\b',
        r'\bB\s*202\d\b',
        r'\bN\s*202\d\b',
        r'\b202\d\b',
        r'\b202\d\s*x\d+\b',
        r'\bTOP\s*X\d+\b'
    ]
    for pattern in suffix_patterns:
        original_name = re.sub(pattern, '', original_name, flags=re.IGNORECASE).strip()
        
    # Clean up prefixes like % or ~ or *
    original_name = re.sub(r'^[+%~\s*]+', '', original_name).strip()
    
    # Capitalize nicely
    original_name = re.sub(r'\s+', ' ', original_name).strip()
    
    # Suffix Clean up for specific names (like "Absolute", "Intense" etc.) - let's keep them if they are part of the name
    
    # If the name is left empty, fall back to designation
    if not original_name:
        original_name = designation
        
    return brand, original_name, category, gender

def main():
    parsed_items = []
    
    # Parse PDF 1
    current_section = "designer"
    with open(pdf1_path, 'r', encoding='utf-8') as f:
        for line in f:
            if "=== PAGE 7 ===" in line or "=== PAGE 8 ===" in line:
                current_section = "oriental"
            elif "=== PAGE 9 ===" in line:
                current_section = "designer"
            
            parsed = parse_line(line)
            if parsed:
                parsed["section"] = current_section
                parsed_items.append(parsed)
                
    # Parse PDF 2
    current_section = "designer"
    with open(pdf2_path, 'r', encoding='utf-8') as f:
        for line in f:
            # PDF 2 page 15-16 have attars/orientals
            if "=== PAGE 15 ===" in line or "=== PAGE 16 ===" in line:
                current_section = "oriental"
            elif "=== PAGE 17 ===" in line:
                current_section = "niche" # PDF 2 page 17-24 have niche/designer mixed
                
            parsed = parse_line(line)
            if parsed:
                parsed["section"] = current_section
                parsed_items.append(parsed)
                
    print(f"Total raw items parsed: {len(parsed_items)}")
    
    # Deduplicate based on Brand + Original Name + Gender
    unique_fragrances = {}
    
    for item in parsed_items:
        code = item['code']
        designation = item['designation']
        price = item['price']
        section = item['section']
        
        brand, orig_name, category, gender = get_perfume_details(code, designation, section)
        
        # Suffix/grade determination
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
            
        # Unique key based on brand + name + gender
        key_name = re.sub(r'\s+', ' ', orig_name.lower()).strip()
        key = (brand.lower(), key_name, gender)
        
        if key not in unique_fragrances:
            # Check if this name matches another with a slightly different name (fuzzy deduplication)
            # For example, "Aventus" vs "Absolu Aventus" (keep separate, different perfumes)
            # But "Baccarat Rouge 540" vs "Baccarat Rouge  540" should be merged!
            unique_fragrances[key] = {
                "brand": brand,
                "original_name": orig_name,
                "gender": gender,
                "category": category,
                "variants": []
            }
            
        # Add variant
        exists = False
        for v in unique_fragrances[key]["variants"]:
            if v["code"] == code:
                v["price_per_100g"] = min(v["price_per_100g"], price)
                exists = True
                break
        if not exists:
            unique_fragrances[key]["variants"].append({
                "code": code,
                "grade": grade,
                "price_per_100g": price
            })
            
    print(f"Total unique fragrance entities: {len(unique_fragrances)}")
    
    # Save the consolidated output
    output_list = []
    # Assign fragrance ID: P-0001 to P-XXXX
    for idx, (key, item) in enumerate(sorted(unique_fragrances.items(), key=lambda x: (x[0][0], x[0][1]))):
        fragrance_id = f"P-{idx+1:04d}"
        item["fragrance_id"] = fragrance_id
        output_list.append(item)
        
    with open(dataset_output_path, 'w', encoding='utf-8') as f:
        json.dump(output_list, f, indent=2, ensure_ascii=False)
        
    print(f"Saved database to {dataset_output_path}")

if __name__ == "__main__":
    main()
