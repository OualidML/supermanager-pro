import os
import re
import uuid
import json

migrations_dir = r"C:\Users\gh\OneDrive\Desktop\parfumworld\supabase\migrations"
sql_output_path = r"C:\Users\gh\OneDrive\Desktop\parfumworld\supabase\migrations\20260805000000_perfume_alternatives.sql"

def get_perfume_ids():
    # Parse all .sql migrations to build a mapping from name (lowercased) -> id
    name_to_id = {}
    
    # 1. Look in seed.sql
    seed_path = os.path.join(migrations_dir, "20260801200000_seed.sql")
    if os.path.exists(seed_path):
        with open(seed_path, 'r', encoding='utf-8') as f:
            for line in f:
                # e.g. ('a1000000-0000-0000-0000-000000000005', 'b4000000-0000-0000-0000-000000000004', 'Aventus' ...
                match = re.search(r"\('(a1000000-\d+-\d+-\d+-\d+)',\s*'(b\d+-\d+-\d+-\d+-\d+)',\s*'([^']+)'", line)
                if match:
                    p_id = match.group(1)
                    p_name = match.group(3).lower()
                    name_to_id[p_name] = p_id
                    
    # 2. Look in new_fragrances.sql
    new_path = os.path.join(migrations_dir, "20260803300000_new_fragrances.sql")
    if os.path.exists(new_path):
        with open(new_path, 'r', encoding='utf-8') as f:
            for line in f:
                # e.g. ('90000000-0000-0000-0000-000000000011', 'b0000000-0000-0000-0000-000000000006', 'Woody Green Apple' ...
                match = re.search(r"\('(90000000-\d+-\d+-\d+-\d+)',\s*'(b\d+-\d+-\d+-\d+-\d+)',\s*'([^']+)'", line)
                if match:
                    p_id = match.group(1)
                    p_name = match.group(3).lower()
                    name_to_id[p_name] = p_id
                    
    # 3. Look in mass_seed.sql
    mass_path = os.path.join(migrations_dir, "20260804000000_mass_seed.sql")
    if os.path.exists(mass_path):
        with open(mass_path, 'r', encoding='utf-8') as f:
            for line in f:
                # e.g. ('8d9b...', 'b8d9...', '1 Million Royal', 'male'::gender_type, 'edp'::concentration_type, 0, 100 ...
                match = re.search(r"\('([a-f0-9\-]+)',\s*'([a-f0-9\-]+)',\s*'([^']+)',\s*'[^']+'::gender_type", line)
                if match:
                    p_id = match.group(1)
                    p_name = match.group(3).lower()
                    name_to_id[p_name] = p_id
                    
    return name_to_id

def main():
    name_to_id = get_perfume_ids()
    print(f"Loaded {len(name_to_id)} perfume IDs.")
    
    # We define alternatives for popular anchor perfumes:
    # Aventus, Sauvage, Baccarat Rouge 540, 1 Million Royal, Libre, Black Opium
    anchors = {
        "aventus": [
            {
                "brand": "Armaf",
                "name": "Club de Nuit Intense Man",
                "confidence": 95,
                "notes": {
                    "top_notes": ["Lemon", "Pineapple", "Bergamot", "Blackcurrant", "Apple"],
                    "middle_notes": ["Birch", "Jasmine", "Rose"],
                    "base_notes": ["Musk", "Ambergris", "Patchouli", "Vanilla"]
                },
                "image_url": "https://fimgs.net/images/perfume/m.27656.jpg",
                "pitch": "The most famous Bestseller clone of Creed Aventus with unmatched fresh-smoky sillage."
            },
            {
                "brand": "Montblanc",
                "name": "Explorer",
                "confidence": 90,
                "notes": {
                    "top_notes": ["Bergamot", "Pink Pepper", "Clary Sage"],
                    "middle_notes": ["Haitian Vetiver", "Leather"],
                    "base_notes": ["Ambroxan", "Akigalawood", "Patchouli", "Cacao"]
                },
                "image_url": "https://fimgs.net/images/perfume/m.52002.jpg",
                "pitch": "A clean, modern, and smoother designer alternative with high vetiver and ambroxan."
            },
            {
                "brand": "Lattafa",
                "name": "Al Dur Al Maknoon Silver",
                "confidence": 82,
                "notes": {
                    "top_notes": ["Pineapple", "Bergamot", "Apple"],
                    "middle_notes": ["Birch", "Jasmine"],
                    "base_notes": ["Leather", "Musk", "Oakmoss", "Patchouli"]
                },
                "image_url": "https://fimgs.net/images/perfume/m.25890.jpg",
                "pitch": "An affordable smoky birch and apple alternative with a strong woody foundation."
            }
        ],
        "sauvage": [
            {
                "brand": "Lattafa",
                "name": "Asad",
                "confidence": 92,
                "notes": {
                    "top_notes": ["Black Pepper", "Pineapple", "Tobacco"],
                    "middle_notes": ["Coffee", "Patchouli", "Iris"],
                    "base_notes": ["Amber", "Vanilla", "Dry Wood", "Benzoin"]
                },
                "image_url": "https://fimgs.net/images/perfume/m.70585.jpg",
                "pitch": "An exceptional clone of Sauvage Elixir featuring rich black pepper, coffee, and vanilla."
            },
            {
                "brand": "Prada",
                "name": "Luna Rossa Carbon",
                "confidence": 88,
                "notes": {
                    "top_notes": ["Bergamot", "Pepper"],
                    "middle_notes": ["Lavender", "Coal", "Soil tincture", "Watery Notes"],
                    "base_notes": ["Ambroxan", "Patchouli"]
                },
                "image_url": "https://fimgs.net/images/perfume/m.44030.jpg",
                "pitch": "A metallic, clean, and smoother designer alternative with lavender and ambroxan."
            }
        ],
        "baccarat rouge 540": [
            {
                "brand": "Lattafa",
                "name": "Ana Abiyedh Rouge",
                "confidence": 94,
                "notes": {
                    "top_notes": ["Nashi Pear", "Kumquat", "Bergamot"],
                    "middle_notes": ["Geranium", "Caramel", "Corriander"],
                    "base_notes": ["Ambergris", "Saffron", "Oakmoss", "Musk"]
                },
                "image_url": "https://fimgs.net/images/perfume/m.63060.jpg",
                "pitch": "An exceptional, sweet amber-saffron twin with identical cotton-candy projection."
            },
            {
                "brand": "Club de Nuit",
                "name": "Untold",
                "confidence": 93,
                "notes": {
                    "top_notes": ["Saffron", "Jasmine"],
                    "middle_notes": ["Amberwood", "Ambergris"],
                    "base_notes": ["Fir Resin", "Cedar"]
                },
                "image_url": "https://fimgs.net/images/perfume/m.77123.jpg",
                "pitch": "A highly projected clone with identical sweet saffron, ambergris, and cedarwood base."
            },
            {
                "brand": "Ariana Grande",
                "name": "Cloud",
                "confidence": 88,
                "notes": {
                    "top_notes": ["Lavender", "Pear", "Bergamot"],
                    "middle_notes": ["Whipped Cream", "Praline", "Coconut", "Vanilla orchid"],
                    "base_notes": ["Musk", "Woody Notes"]
                },
                "image_url": "https://fimgs.net/images/perfume/m.50384.jpg",
                "pitch": "A popular sweet, airy alternative featuring whipped cream, praline, and coconut."
            }
        ],
        "libre": [
            {
                "brand": "Zara",
                "name": "Golden Decade",
                "confidence": 92,
                "notes": {
                    "top_notes": ["Mandarin Orange"],
                    "middle_notes": ["Jasmine", "Orange Blossom", "Lavender"],
                    "base_notes": ["Vanilla", "Amber", "Musk"]
                },
                "image_url": "https://fimgs.net/images/perfume/m.70320.jpg",
                "pitch": "A beautiful designer clone focusing on lavender, orange blossom, and warm vanilla."
            }
        ],
        "black opium": [
            {
                "brand": "Zara",
                "name": "Gardenia",
                "confidence": 90,
                "notes": {
                    "top_notes": ["Peach", "Raspberry"],
                    "middle_notes": ["Gardenia", "Jasmine", "Coffee"],
                    "base_notes": ["Vanilla", "Patchouli", "Musk"]
                },
                "image_url": "https://fimgs.net/images/perfume/m.49121.jpg",
                "pitch": "A beautiful, rich alternative focusing on orange blossom, coffee, and vanilla."
            }
        ],
        "1 million royal": [
            {
                "brand": "Lattafa",
                "name": "Asad",
                "confidence": 80,
                "notes": {
                    "top_notes": ["Black Pepper", "Pineapple", "Tobacco"],
                    "middle_notes": ["Coffee", "Patchouli", "Iris"],
                    "base_notes": ["Amber", "Vanilla", "Dry Wood", "Benzoin"]
                },
                "image_url": "https://fimgs.net/images/perfume/m.70585.jpg",
                "pitch": "A warm spicy alternative featuring sweet vanilla and warm amber dry down."
            }
        ]
    }
    
    # Generate database migration script
    sql_lines = [
        "-- Migration: Create perfume_alternatives table and seed data",
        "",
        "CREATE TABLE IF NOT EXISTS perfume_alternatives (",
        "    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),",
        "    perfume_id uuid REFERENCES perfumes(id) ON DELETE CASCADE,",
        "    brand text NOT NULL,",
        "    name text NOT NULL,",
        "    match_confidence integer NOT NULL CHECK (match_confidence BETWEEN 0 AND 100),",
        "    notes jsonb NOT NULL,",
        "    image_url text,",
        "    shop_owner_pitch text,",
        "    is_uploaded boolean DEFAULT false NOT NULL,",
        "    created_at timestamp with time zone DEFAULT now() NOT NULL,",
        "    CONSTRAINT uniq_perfume_alt UNIQUE (perfume_id, brand, name)",
        ");",
        "",
        "ALTER TABLE perfume_alternatives ENABLE ROW LEVEL SECURITY;",
        "",
        "CREATE POLICY \"Allow public read perfume_alternatives\" ON perfume_alternatives",
        "    FOR SELECT USING (true);",
        "",
        "CREATE POLICY \"Allow admin write perfume_alternatives\" ON perfume_alternatives",
        "    FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());",
        "",
        "-- Seed alternatives for popular anchor perfumes",
    ]
    
    for anchor_name, alts in anchors.items():
        # Find matching perfume id
        anchor_id = None
        for k, v in name_to_id.items():
            if anchor_name in k:
                anchor_id = v
                break
                
        if anchor_id:
            print(f"Mapping alternatives for {anchor_name} (ID: {anchor_id})")
            for alt in alts:
                alt_brand = alt["brand"].replace("'", "''")
                alt_name = alt["name"].replace("'", "''")
                alt_pitch = alt["pitch"].replace("'", "''")
                alt_notes_json = json.dumps(alt["notes"])
                alt_image = alt["image_url"]
                
                # Check if the alternative is pre-seeded in the database
                # if the name is in name_to_id, then is_uploaded is true!
                is_uploaded = "false"
                for k, v in name_to_id.items():
                    if alt_name.lower() in k and alt_brand.lower() in k:
                        is_uploaded = "true"
                        break
                        
                sql_lines.append(
                    f"INSERT INTO perfume_alternatives (perfume_id, brand, name, match_confidence, notes, image_url, shop_owner_pitch, is_uploaded) "
                    f"VALUES ('{anchor_id}', '{alt_brand}', '{alt_name}', {alt['confidence']}, '{alt_notes_json}'::jsonb, '{alt_image}', '{alt_pitch}', {is_uploaded}) "
                    f"ON CONFLICT (perfume_id, brand, name) DO NOTHING;"
                )
        else:
            print(f"Anchor perfume '{anchor_name}' not found in database migrations!")
            
    with open(sql_output_path, 'w', encoding='utf-8') as f:
        f.write("\n".join(sql_lines))
        
    print(f"Saved seed migration to {sql_output_path}")

if __name__ == "__main__":
    main()
