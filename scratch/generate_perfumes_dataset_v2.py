import re
import json

pdf1_path = r"c:\Users\gh\OneDrive\Desktop\supermanager-pro\scratch\pdf1_text.txt"
pdf2_path = r"c:\Users\gh\OneDrive\Desktop\supermanager-pro\scratch\pdf2_text.txt"
dataset_output_path = r"c:\Users\gh\OneDrive\Desktop\supermanager-pro\scratch\perfumes_dataset.json"

# Niche brand mapping ranges
niche_ranges = [
    ("^10[2-9]", "Maison Francis Kurkdjian"),
    ("^110", "Maison Francis Kurkdjian"),
    ("^20[1-9]", "Montale"),
    ("^30[1-9]", "Louis Vuitton"),
    ("^31[0-9]", "Louis Vuitton"),
    ("^32[0-9]", "Louis Vuitton"),
    ("^33[0-9]", "Louis Vuitton"),
    ("^40[1-9]", "Creed"),
    ("^50[1-9]", "Parfums de Marly"),
    ("^51[0-9]", "Parfums de Marly"),
    ("^60[1-9]", "Xerjoff"),
    ("^61[0-9]", "Xerjoff"),
    ("^70[1-9]", "Tiziana Terenzi"),
    ("^80[1-9]", "Nishane"),
    ("^90[1-9]", "Byredo"),
    ("^100", "Nasomatto"),
    ("^110", "Amouage"),
    ("^120", "Acqua Di Parma"),
    ("^130", "Kilian"),
    ("^140", "Venezia 1920"),
    ("^150", "Penhaligon's"),
    ("^160", "Ex Nihilo"),
    ("^170", "Thomas Kosmala"),
    ("^180", "BDK Parfums"),
    ("^190", "Orto Parisi"),
    ("^200", "Bharara"),
    ("^210", "Le Labo"),
    ("^220", "Initio Parfums Prives"),
    ("^230", "Maison Rebatchi"),
    ("^250", "Marc-Antoine Barrois"),
    ("^260", "Kayali"),
    ("^261", "Kayali"),
    ("^270", "Jo Malone London"),
    ("^280", "Roja Dove"),
    ("^290", "Rosendo Mateu"),
    ("^300", "Liquides Imaginaires"),
    ("^310", "Initio Parfums Prives"),
    ("^320", "Ariana Grande"),
    ("^330", "Frederic Malle"),
    ("^350", "Atelier Cologne"),
    ("^360", "Escentric Molecules"),
    ("^370", "Diptyque"),
    ("^380", "Moresque"),
    ("^390", "Floraïku"),
    ("^400", "Giardini Di Toscana"),
    ("^410", "Juliette Has A Gun"),
    ("^420", "Boadicea the Victorious"),
    ("^430", "Gissah"),
    ("^440", "Stéphane Humbert Lucas 777"),
    ("^450", "Gritti"),
    ("^460", "Essential Parfums"),
    ("^470", "Maison Crivelli"),
    ("^480", "Kajal"),
    ("^490", "Anfas"),
    ("^500", "Coach"),
    ("^510", "Fragrance One"),
    ("^520", "Goldfield & Banks"),
    ("^530", "Unique'e Luxury"),
    ("^540", "Aramis"),
    ("^550", "Laverne"),
    ("^560", "Matiere Premiere"),
    ("^570", "Ramón Béjar"),
    ("^580", "Vertus"),
    ("^590", "House Of Sillage"),
    ("^600", "Kerosene"),
    ("^610", "Ibraheem AlQurashi"),
    ("^620", "Maison Martin Margiela"),
    ("^630", "Vilhelm Parfumerie"),
    ("^640", "Lorenzo Pazzaglia"),
    ("^650", "The 7 Virtues"),
]

# Designer brand mapping ranges
designer_ranges = [
    ("^0?20", "Giorgio Armani"),
    ("^0?21", "Giorgio Armani"),
    ("^0?22", "Giorgio Armani"),
    ("^0?23", "Giorgio Armani"),
    ("^0?24", "Giorgio Armani"),
    ("^0?30", "Paco Rabanne"),
    ("^0?31", "Paco Rabanne"),
    ("^0?32", "Paco Rabanne"),
    ("^0?33", "Paco Rabanne"),
    ("^0?34", "Paco Rabanne"),
    ("^0?35", "Paco Rabanne"),
    ("^0?36", "Paco Rabanne"),
    ("^0?40", "Dior"),
    ("^0?41", "Dior"),
    ("^0?42", "Dior"),
    ("^0?43", "Dior"),
    ("^0?50", "Burberry"),
    ("^0?51", "Burberry"),
    ("^0?60", "Chanel"),
    ("^0?61", "Chanel"),
    ("^0?70", "Lacoste"),
    ("^0?71", "Lacoste"),
    ("^0?80", "Dolce & Gabbana"),
    ("^0?81", "Dolce & Gabbana"),
    ("^0?82", "Dolce & Gabbana"),
    ("^0?83", "Dolce & Gabbana"),
    ("^0?90", "Givenchy"),
    ("^0?91", "Givenchy"),
    ("^100", "Gucci"),
    ("^101", "Gucci"),
    ("^110", "Yves Saint Laurent"),
    ("^111", "Yves Saint Laurent"),
    ("^112", "Yves Saint Laurent"),
    ("^113", "Yves Saint Laurent"),
    ("^120", "Azzaro"),
    ("^121", "Azzaro"),
    ("^130", "Escada"),
    ("^131", "Escada"),
    ("^140", "Hugo Boss"),
    ("^141", "Hugo Boss"),
    ("^142", "Hugo Boss"),
    ("^143", "Hugo Boss"),
    ("^150", "Lancôme"),
    ("^151", "Lancôme"),
    ("^170", "Carolina Herrera"),
    ("^171", "Carolina Herrera"),
    ("^180", "Franck Olivier"),
    ("^181", "Franck Olivier"),
    ("^180", "Franck Olivier"),
    ("^181", "Franck Olivier"),
    ("^190", "Guerlain"),
    ("^191", "Guerlain"),
    ("^200", "Hermès"),
    ("^210", "Jean Paul Gaultier"),
    ("^211", "Jean Paul Gaultier"),
    ("^212", "Jean Paul Gaultier"),
    ("^220", "Zara"),
    ("^221", "Zara"),
    ("^222", "Zara"),
    ("^230", "Cacharel"),
    ("^240", "Britney Spears"),
    ("^250", "Cartier"),
    ("^260", "Cerruti"),
    ("^270", "Davidoff"),
    ("^280", "Diesel"),
    ("^290", "Nina Ricci"),
    ("^300", "Ralph Lauren"),
    ("^310", "Versace"),
    ("^320", "Viktor & Rolf"),
    ("^330", "Avaluxe"),
    ("^340", "Antonio Banderas"),
    ("^350", "Lanvin"),
    ("^360", "Balman"),
    ("^390", "Chloe"),
    ("^400", "Calvin Klein"),
    ("^410", "Jimmy Choo"),
    ("^420", "Issey Miyake"),
    ("^430", "Kenzo"),
    ("^450", "Montblanc"),
    ("^480", "Narciso Rodriguez"),
    ("^500", "Nikos"),
    ("^510", "Roberto Cavalli"),
    ("^520", "Sospiro"),
    ("^530", "Mercedes-Benz"),
    ("^540", "Yves Rocher"),
    ("^550", "Brut"),
    ("^560", "Valentino"),
    ("^570", "Clinique"),
    ("^580", "Tom Ford"),
    ("^590", "Elie Saab"),
    ("^610", "Joop"),
    ("^640", "Nautica"),
    ("^650", "Tommy Hilfiger"),
    ("^660", "Victoria's Secret"),
    ("^680", "Thierry Mugler"),
    ("^690", "Marc Jacobs"),
    ("^720", "Prada"),
    ("^730", "Dunhill"),
    ("^740", "Guy Laroche"),
    ("^750", "Evaflora"),
    ("^760", "Jaguar"),
    ("^770", "Dove"),
    ("^780", "Aqualina"),
    ("^800", "Lolita Lempicka"),
    ("^810", "Zadig & Voltaire"),
    ("^820", "Rochas"),
    ("^830", "Tesori d'Orient"),
    ("^840", "Franck Boclet"),
    ("^850", "Giorgio Monti"),
    ("^860", "Byron"),
    ("^880", "Lt Piver"),
    ("^890", "Chopard"),
    ("^900", "David Beckham"),
    ("^910", "Ted Lapidus"),
    ("^920", "Yves de Sistelle"),
    ("^930", "Ferrari"),
    ("^940", "Jacques Bogart"),
    ("^950", "Armaf"),
    ("^960", "Emmanuel Jane"),
    ("^970", "Moschino"),
    ("^980", "Cristiano Ronaldo"),
]

# Attar specific prefix rules
attar_prefixes = [
    ("^BO_ALMOKHTAR", "Banafa For Oud"),
    ("^BO_AMIR", "Banafa For Oud"),
    ("^BO_EMIRATES", "Banafa For Oud"),
    ("^BO_ISPHAN", "Banafa For Oud"),
    ("^BO_KING", "Banafa For Oud"),
    ("^BO_MILLE", "Banafa For Oud"),
    ("^BO_SHWAL", "Banafa For Oud"),
    ("^BO_SHWL", "Banafa For Oud"),
    ("^BO_Musk", "Shada Oud"),
    ("^BO_BCR", "Banafa For Oud"),
    ("^BO_KHANJAR", "Banafa For Oud"),
    ("^SR-", "Surrati"),
    ("^musk_", "Banafa For Oud"),
    ("^so-", "Shada Oud"),
    ("^CRM-", "Oriental Oils"),
    ("^MKH", "Oriental Oils"),
]

def clean_designation(name):
    name = re.sub(r'^[+%~\s*#]+', '', name)
    name = re.sub(r'[%\s*#~]+$', '', name)
    name = re.sub(r'\s+', ' ', name).strip()
    return name

def parse_line(line):
    line = line.strip()
    if not line:
        return None
    if line.startswith("==") or line.startswith("===") or "Code" in line or "Désignation" in line or "Prix" in line or "Designer Parfums" in line or "Niche Parfums" in line:
        return None
    tokens = line.split()
    if len(tokens) < 3:
        return None
    code = tokens[0]
    price_str = tokens[-1]
    price_match = re.search(r'\d+', price_str)
    if price_match:
        price = int(price_match.group(0))
    else:
        return None
    designation = " ".join(tokens[1:-1])
    designation = clean_designation(designation)
    return {"code": code, "designation": designation, "price": price}

def get_perfume_details(code, designation, section):
    clean_c = re.sub(r'^[+%~]+', '', code)
    
    brand = "Unknown Brand"
    category = "Designer"
    
    # 1. Check if code starts with special attar prefixes
    is_attar_prefix = False
    for pat, br in attar_prefixes:
        if re.match(pat, clean_c):
            brand = br
            category = "Oriental/Attar"
            is_attar_prefix = True
            break

    # 2. Check if code matches global ranges (non-overlapping ranges)
    global_brands = [
        ("^52", "Sospiro", "Niche"),
        ("^53", "Unique'e Luxury", "Niche"),
        ("^55", "Laverne", "Niche"),
        ("^56", "Matiere Premiere", "Niche"),
        ("^57", "Ramón Béjar", "Niche"),
        ("^58", "Tom Ford", "Designer"),
        ("^59", "Elie Saab", "Designer"),
        ("^61", "Joop", "Designer"),
        ("^62", "Maison Martin Margiela", "Designer"),
        ("^63", "Vilhelm Parfumerie", "Niche"),
        ("^64", "Lorenzo Pazzaglia", "Niche"),
        ("^65", "The 7 Virtues", "Niche"),
        ("^66", "Victoria's Secret", "Designer"),
        ("^68", "Thierry Mugler", "Designer"),
        ("^69", "Marc Jacobs", "Designer"),
        ("^72", "Prada", "Designer"),
        ("^73", "Dunhill", "Designer"),
        ("^74", "Guy Laroche", "Designer"),
        ("^75", "Evaflora", "Designer"),
        ("^76", "Jaguar", "Designer"),
        ("^77", "Dove", "Designer"),
        ("^78", "Aqualina", "Designer"),
        ("^80", "Lolita Lempicka", "Designer"),
        ("^81", "Zadig & Voltaire", "Designer"),
        ("^82", "Rochas", "Designer"),
        ("^83", "Tesori d'Orient", "Designer"),
        ("^84", "Franck Boclet", "Niche"),
        ("^85", "Giorgio Monti", "Designer"),
        ("^86", "Byron", "Niche"),
        ("^88", "Lt Piver", "Niche"),
        ("^89", "Chopard", "Designer"),
        ("^90", "David Beckham", "Designer"),
        ("^91", "Ted Lapidus", "Designer"),
        ("^92", "Yves de Sistelle", "Designer"),
        ("^93", "Ferrari", "Designer"),
        ("^94", "Jacques Bogart", "Designer"),
        ("^95", "Armaf", "Designer"),
        ("^96", "Emmanuel Jane", "Designer"),
        ("^97", "Moschino", "Designer"),
        ("^98", "Cristiano Ronaldo", "Designer"),
    ]
    if brand == "Unknown Brand":
        num_match = re.match(r'^\d+', clean_c.lstrip('0'))
        if num_match:
            num_val = num_match.group(0)
            if len(num_val) >= 4:
                for pat, br, cat in global_brands:
                    if re.match(pat, num_val):
                        brand = br
                        category = cat
                        break
            
    # 3. If it's the oriental section, force Oriental/Attar category
    if section == "oriental" or category == "Oriental/Attar":
        category = "Oriental/Attar"
        # Parse brand keywords from the name
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
                
    # 4. If standard niche/designer ranges, match by prefix in their respective section
    if brand == "Unknown Brand":
        if section == "niche":
            category = "Niche"
            for pat, br in niche_ranges:
                if re.match(pat, clean_c):
                    brand = br
                    break
        elif section == "designer":
            category = "Designer"
            for pat, br in designer_ranges:
                if re.match(pat, clean_c):
                    brand = br
                    break
                    
    # 5. Fallback search of keywords
    if brand == "Unknown Brand":
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
            "Montblanc": ["Montblanc", "Mont text", "Montblanc"],
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
                    if k_brand in ["Creed", "Maison Francis Kurkdjian", "Montale", "Parfums de Marly", "Xerjoff", "Byredo", "Nasomatto", "Amouage", "Kilian", "Penhaligon's", "Ex Nihilo", "Thomas Kosmala", "BDK Parfums", "Orto Parisi", "Le Labo", "Initio Parfums Prives", "Maison Rebatchi", "Marc-Antoine Barrois", "Kayali", "Jo Malone London", "Roja Dove", "Frederic Malle", "Atelier Cologne", "Escentric Molecules", "Diptyque", "Moresque", "Floraïku", "Giardini Di Toscana", "Juliette Has A Gun", "Boadicea the Victorious", "Gissah", "Stéphane Humbert Lucas 777", "Gritti", "Essential Parfums", "Maison Crivelli", "Kajal", "Anfas", "Fragrance One", "Goldfield & Banks", "Unique'e Luxury", "Laverne", "Matiere Premiere", "Ramón Béjar", "Vertus", "House Of Sillage", "Kerosene", "Ibraheem AlQurashi", "Lorenzo Pazzaglia", "The 7 Virtues", "Vilhelm Parfumerie", "Franck Boclet", "Byron", "Lt Piver"]:
                        category = "Niche"
                    else:
                        category = "Designer"
                    break
            if brand != "Unknown Brand":
                break
                
    # 5. Extract Gender
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
            
    # 6. Extract original name (remove brand, gender, and suffixes)
    original_name = designation
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
        "Al-Rehab", "AlRehab", "Surrati", "Ajmal", "Banafa For Oud", "Banafa", "Arabian Oud",
        "Swiss Arabian", "Shada Oud", "Oriental Oils"
    ]
    for kw in brands_kw:
        pattern = r'\b' + re.escape(kw) + r'\b'
        original_name = re.sub(pattern, '', original_name, flags=re.IGNORECASE).strip()
        
    original_name = re.sub(r'\b[UHF]\b', '', original_name).strip()
    
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
        
    original_name = re.sub(r'^[+%~\s*]+', '', original_name).strip()
    original_name = re.sub(r'\s+', ' ', original_name).strip()
    
    if not original_name:
        original_name = designation
        
    return brand, original_name, category, gender

def main():
    parsed_items = []
    
    # Parse PDF 1
    current_page = 1
    with open(pdf1_path, 'r', encoding='utf-8') as f:
        for line in f:
            page_match = re.match(r'^===\s*PAGE\s*(\d+)\s*===', line)
            if page_match:
                current_page = int(page_match.group(1))
                continue
                
            # Determine section based on page index
            if current_page <= 6:
                section = "niche"
            elif 7 <= current_page <= 8:
                section = "oriental"
            else:
                section = "designer"
                
            parsed = parse_line(line)
            if parsed:
                parsed["section"] = section
                parsed_items.append(parsed)
                
    # Parse PDF 2
    current_page = 1
    with open(pdf2_path, 'r', encoding='utf-8') as f:
        for line in f:
            page_match = re.match(r'^===\s*PAGE\s*(\d+)\s*===', line)
            if page_match:
                current_page = int(page_match.group(1))
                continue
                
            # Determine section based on page index
            if current_page <= 14:
                section = "designer"
            elif 15 <= current_page <= 16:
                section = "oriental"
            else:
                section = "niche"
                
            parsed = parse_line(line)
            if parsed:
                parsed["section"] = section
                parsed_items.append(parsed)
                
    print(f"Total raw items parsed: {len(parsed_items)}")
    
    unique_fragrances = {}
    
    for item in parsed_items:
        code = item['code']
        designation = item['designation']
        price = item['price']
        section = item['section']
        
        brand, orig_name, category, gender = get_perfume_details(code, designation, section)
        
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
            
        key_name = re.sub(r'\s+', ' ', orig_name.lower()).strip()
        key = (brand.lower(), key_name, gender)
        
        if key not in unique_fragrances:
            unique_fragrances[key] = {
                "brand": brand,
                "original_name": orig_name,
                "gender": gender,
                "category": category,
                "variants": []
            }
            
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
    
    # Save the output
    output_list = []
    for idx, (key, item) in enumerate(sorted(unique_fragrances.items(), key=lambda x: (x[0][0], x[0][1], x[0][2]))):
        fragrance_id = f"P-{idx+1:04d}"
        item["fragrance_id"] = fragrance_id
        output_list.append(item)
        
    with open(dataset_output_path, 'w', encoding='utf-8') as f:
        json.dump(output_list, f, indent=2, ensure_ascii=False)
        
    print(f"Saved database to {dataset_output_path}")

if __name__ == "__main__":
    main()
