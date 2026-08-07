import json
import re
import uuid

dataset_path = r"c:\Users\gh\OneDrive\Desktop\supermanager-pro\scratch\perfumes_dataset.json"
parsed_catalog_path = r"c:\Users\gh\OneDrive\Desktop\supermanager-pro\scratch\parsed_catalog.json"
sql_output_path = r"C:\Users\gh\OneDrive\Desktop\parfumworld\supabase\migrations\20260804000000_mass_seed.sql"

# Note name/ID map based on 20260801200000_seed.sql
scent_notes = {
    # Floral (1-8)
    "rose": ("f1000000-0000-0000-0000-000000000001", "middle"),
    "jasmine": ("f1000000-0000-0000-0000-000000000002", "middle"),
    "jasmin": ("f1000000-0000-0000-0000-000000000002", "middle"),
    "lavender": ("f1000000-0000-0000-0000-000000000003", "top"),
    "lavande": ("f1000000-0000-0000-0000-000000000003", "top"),
    "neroli": ("f1000000-0000-0000-0000-000000000004", "top"),
    "néroli": ("f1000000-0000-0000-0000-000000000004", "top"),
    "ylang-ylang": ("f1000000-0000-0000-0000-000000000005", "middle"),
    "tuberose": ("f1000000-0000-0000-0000-000000000006", "middle"),
    "tubéreuse": ("f1000000-0000-0000-0000-000000000006", "middle"),
    "peony": ("f1000000-0000-0000-0000-000000000007", "middle"),
    "pivoine": ("f1000000-0000-0000-0000-000000000007", "middle"),
    "lily of the valley": ("f1000000-0000-0000-0000-000000000008", "middle"),
    "muguet": ("f1000000-0000-0000-0000-000000000008", "middle"),

    # Woody (9-16)
    "sandalwood": ("f2000000-0000-0000-0000-000000000009", "base"),
    "santal": ("f2000000-0000-0000-0000-000000000009", "base"),
    "cedarwood": ("f2000000-0000-0000-0000-000000000010", "base"),
    "cèdre": ("f2000000-0000-0000-0000-000000000010", "base"),
    "cedar": ("f2000000-0000-0000-0000-000000000010", "base"),
    "patchouli": ("f2000000-0000-0000-0000-000000000011", "base"),
    "vetiver": ("f2000000-0000-0000-0000-000000000012", "base"),
    "vétiver": ("f2000000-0000-0000-0000-000000000012", "base"),
    "oud": ("f2000000-0000-0000-0000-000000000013", "base"),
    "guaiac wood": ("f2000000-0000-0000-0000-000000000014", "base"),
    "gaïac": ("f2000000-0000-0000-0000-000000000014", "base"),
    "cashmere wood": ("f2000000-0000-0000-0000-000000000015", "base"),
    "cachemire": ("f2000000-0000-0000-0000-000000000015", "base"),
    "oakmoss": ("f2000000-0000-0000-0000-000000000016", "base"),
    "mousse de chêne": ("f2000000-0000-0000-0000-000000000016", "base"),

    # Oriental/Ambery (17-24)
    "amber": ("f3000000-0000-0000-0000-000000000017", "base"),
    "ambre": ("f3000000-0000-0000-0000-000000000017", "base"),
    "incense": ("f3000000-0000-0000-0000-000000000018", "base"),
    "encens": ("f3000000-0000-0000-0000-000000000018", "base"),
    "myrrh": ("f3000000-0000-0000-0000-000000000019", "base"),
    "myrrhe": ("f3000000-0000-0000-0000-000000000019", "base"),
    "benzoin": ("f3000000-0000-0000-0000-000000000020", "base"),
    "benjoin": ("f3000000-0000-0000-0000-000000000020", "base"),
    "labdanum": ("f3000000-0000-0000-0000-000000000021", "base"),
    "saffron": ("f3000000-0000-0000-0000-000000000022", "middle"),
    "safran": ("f3000000-0000-0000-0000-000000000022", "middle"),
    "tobacco": ("f3000000-0000-0000-0000-000000000023", "base"),
    "tabac": ("f3000000-0000-0000-0000-000000000023", "base"),
    "spices": ("f3000000-0000-0000-0000-000000000024", "middle"),
    "épices": ("f3000000-0000-0000-0000-000000000024", "middle"),

    # Fresh/Citrus (25-32)
    "bergamot": ("f4000000-0000-0000-0000-000000000025", "top"),
    "bergamote": ("f4000000-0000-0000-0000-000000000025", "top"),
    "lemon": ("f4000000-0000-0000-0000-000000000026", "top"),
    "citron": ("f4000000-0000-0000-0000-000000000026", "top"),
    "grapefruit": ("f4000000-0000-0000-0000-000000000027", "top"),
    "pamplemousse": ("f4000000-0000-0000-0000-000000000027", "top"),
    "mandarin": ("f4000000-0000-0000-0000-000000000028", "top"),
    "mandarine": ("f4000000-0000-0000-0000-000000000028", "top"),
    "lime": ("f4000000-0000-0000-0000-000000000029", "top"),
    "mint": ("f4000000-0000-0000-0000-000000000030", "top"),
    "menthe": ("f4000000-0000-0000-0000-000000000030", "top"),
    "sea notes": ("f4000000-0000-0000-0000-000000000031", "top"),
    "marine": ("f4000000-0000-0000-0000-000000000031", "top"),
    "green tea": ("f4000000-0000-0000-0000-000000000032", "top"),
    "thé vert": ("f4000000-0000-0000-0000-000000000032", "top"),

    # Fruity (33-40)
    "apple": ("f5000000-0000-0000-0000-000000000033", "top"),
    "pomme": ("f5000000-0000-0000-0000-000000000033", "top"),
    "peach": ("f5000000-0000-0000-0000-000000000034", "middle"),
    "pêche": ("f5000000-0000-0000-0000-000000000034", "middle"),
    "pear": ("f5000000-0000-0000-0000-000000000035", "top"),
    "poire": ("f5000000-0000-0000-0000-000000000035", "top"),
    "raspberry": ("f5000000-0000-0000-0000-000000000036", "top"),
    "framboise": ("f5000000-0000-0000-0000-000000000036", "top"),
    "cherry": ("f5000000-0000-0000-0000-000000000037", "middle"),
    "cerise": ("f5000000-0000-0000-0000-000000000037", "middle"),
    "blackcurrant": ("f5000000-0000-0000-0000-000000000038", "top"),
    "cassis": ("f5000000-0000-0000-0000-000000000038", "top"),
    "coconut": ("f5000000-0000-0000-0000-000000000039", "middle"),
    "noix de coco": ("f5000000-0000-0000-0000-000000000039", "middle"),
    "fig": ("f5000000-0000-0000-0000-000000000040", "middle"),
    "figue": ("f5000000-0000-0000-0000-000000000040", "middle"),

    # Gourmand/Sweet (41-48)
    "vanilla": ("f6000000-0000-0000-0000-000000000041", "base"),
    "vanille": ("f6000000-0000-0000-0000-000000000041", "base"),
    "caramel": ("f6000000-0000-0000-0000-000000000042", "base"),
    "chocolate": ("f6000000-0000-0000-0000-000000000043", "base"),
    "chocolat": ("f6000000-0000-0000-0000-000000000043", "base"),
    "honey": ("f6000000-0000-0000-0000-000000000044", "middle"),
    "miel": ("f6000000-0000-0000-0000-000000000044", "middle"),
    "tonka": ("f6000000-0000-0000-0000-000000000045", "base"),
    "almond": ("f6000000-0000-0000-0000-000000000046", "middle"),
    "amande": ("f6000000-0000-0000-0000-000000000046", "middle"),
    "praline": ("f6000000-0000-0000-0000-000000000047", "base"),
    "praliné": ("f6000000-0000-0000-0000-000000000047", "base"),
    "coffee": ("f6000000-0000-0000-0000-000000000048", "middle"),
    "café": ("f6000000-0000-0000-0000-000000000048", "middle"),

    # Spicy/Herbal (49-56)
    "cinnamon": ("f7000000-0000-0000-0000-000000000049", "middle"),
    "cannelle": ("f7000000-0000-0000-0000-000000000049", "middle"),
    "cardamom": ("f7000000-0000-0000-0000-000000000050", "middle"),
    "cardamome": ("f7000000-0000-0000-0000-000000000050", "middle"),
    "pepper": ("f7000000-0000-0000-0000-000000000051", "top"),
    "poivre": ("f7000000-0000-0000-0000-000000000051", "top"),
    "ginger": ("f7000000-0000-0000-0000-000000000052", "top"),
    "gingembre": ("f7000000-0000-0000-0000-000000000052", "top"),
    "basil": ("f7000000-0000-0000-0000-000000000053", "top"),
    "basilic": ("f7000000-0000-0000-0000-000000000053", "top"),
    "rosemary": ("f7000000-0000-0000-0000-000000000054", "top"),
    "romarin": ("f7000000-0000-0000-0000-000000000054", "top"),
    "sage": ("f7000000-0000-0000-0000-000000000055", "middle"),
    "sauge": ("f7000000-0000-0000-0000-000000000055", "middle"),
    "thyme": ("f7000000-0000-0000-0000-000000000056", "top"),
    "thym": ("f7000000-0000-0000-0000-000000000056", "top"),

    # Leather/Musk (57-62)
    "musk": ("f8000000-0000-0000-0000-000000000057", "base"),
    "musc": ("f8000000-0000-0000-0000-000000000057", "base"),
    "leather": ("f8000000-0000-0000-0000-000000000058", "base"),
    "cuir": ("f8000000-0000-0000-0000-000000000058", "base"),
    "suede": ("f8000000-0000-0000-0000-000000000059", "base"),
    "daim": ("f8000000-0000-0000-0000-000000000059", "base"),
    "ambergris": ("f8000000-0000-0000-0000-000000000060", "base"),
    "ambregris": ("f8000000-0000-0000-0000-000000000060", "base"),
    "castoreum": ("f8000000-0000-0000-0000-000000000061", "base"),
    "castoréum": ("f8000000-0000-0000-0000-000000000061", "base"),
    "civet": ("f8000000-0000-0000-0000-000000000062", "base"),
    "civette": ("f8000000-0000-0000-0000-000000000062", "base"),
}

# Pre-defined note structures for popular best-sellers (lookup table)
bestseller_note_profiles = {
    "baccarat rouge 540": {
        "top": ["saffron", "jasmine"],
        "middle": ["ambergris"],
        "base": ["cedarwood"]
    },
    "aventus": {
        "top": ["apple", "bergamot", "lemon"],
        "middle": ["patchouli", "jasmine", "rose"],
        "base": ["musk", "oakmoss", "ambergris"]
    },
    "sauvage": {
        "top": ["bergamot", "pepper"],
        "middle": ["lavender", "vetiver", "patchouli"],
        "base": ["cedarwood", "ambergris"]
    },
    "bleu de chanel": {
        "top": ["grapefruit", "lemon", "mint", "pepper"],
        "middle": ["ginger", "jasmine"],
        "base": ["cedarwood", "sandalwood", "patchouli", "incense"]
    },
    "lost cherry": {
        "top": ["cherry", "almond"],
        "middle": ["rose", "jasmine"],
        "base": ["vanilla", "tonka"]
    },
    "tobacco vanille": {
        "top": ["tobacco", "spices"],
        "middle": ["cacao", "tonka"],
        "base": ["vanilla"]
    },
    "oud wood": {
        "top": ["cardamom", "saffron"],
        "middle": ["sandalwood", "vetiver"],
        "base": ["oud", "amber", "vanilla"]
    },
    "reflection man": {
        "top": ["neroli", "rosemary"],
        "middle": ["jasmine", "ylang-ylang"],
        "base": ["sandalwood", "cedarwood", "vetiver"]
    },
    "interlude man": {
        "top": ["bergamot", "spices"],
        "middle": ["incense", "amber", "myrrh"],
        "base": ["leather", "oud", "patchouli", "sandalwood"]
    },
    "good girl": {
        "top": ["almond", "coffee", "bergamot", "lemon"],
        "middle": ["jasmine", "tuberose", "rose"],
        "base": ["tonka", "vanilla", "cacao", "sandalwood", "praline"]
    },
    "black opium": {
        "top": ["pear", "pepper"],
        "middle": ["coffee", "jasmine", "almond"],
        "base": ["vanilla", "patchouli", "cedarwood"]
    },
    "coco mademoiselle": {
        "top": ["mandarin", "bergamot"],
        "middle": ["rose", "jasmine"],
        "base": ["patchouli", "musk", "vanilla", "vetiver"]
    },
    "la vie est belle": {
        "top": ["blackcurrant", "pear"],
        "middle": ["jasmine", "peony"],
        "base": ["praline", "vanilla", "patchouli", "tonka"]
    },
    "flowerbomb": {
        "top": ["green tea", "bergamot"],
        "middle": ["jasmine", "rose", "peony"],
        "base": ["patchouli", "musk"]
    },
    "bombshell": {
        "top": ["grapefruit", "pear"],
        "middle": ["peony", "jasmine", "orchid"],
        "base": ["musk", "cedarwood"]
    },
    "delina": {
        "top": ["bergamot", "pear"],
        "middle": ["rose", "peony"],
        "base": ["vanilla", "musk", "cashmere wood", "cedarwood"]
    },
    "light blue": {
        "top": ["lemon", "apple", "cedarwood"],
        "middle": ["jasmine", "rose"],
        "base": ["cedarwood", "amber", "musk"]
    },
    "black afgano": {
        "top": ["green tea"], # green notes
        "middle": ["coffee", "tobacco"],
        "base": ["incense", "oud"]
    },
    "kirke": {
        "top": ["peach", "pear", "raspberry"],
        "middle": ["lily of the valley"],
        "base": ["musk", "sandalwood", "vanilla", "patchouli"]
    },
    "musk tahara": {
        "top": ["rose", "lily of the valley"],
        "middle": ["jasmine", "white floral"],
        "base": ["musk", "sandalwood"]
    },
    "oud bouquet": {
        "top": ["saffron"],
        "middle": ["rose"],
        "base": ["oud", "praline", "vanilla"]
    },
    "rose d'arabie": {
        "top": ["saffron"],
        "middle": ["rose"],
        "base": ["oud", "patchouli", "amber"]
    },
    "musk noir": {
        "top": ["plum"],
        "middle": ["musk", "rose"],
        "base": ["suede"]
    },
}

def enrich_perfume_notes(perfume_name, brand_name, category, gender):
    name_clean = perfume_name.lower()
    brand_clean = brand_name.lower()
    
    # 1. Look for bestseller match
    for k, profile in bestseller_note_profiles.items():
        if k in name_clean:
            return profile
            
    # 2. Extract notes via keyword matching in the name
    top_notes = []
    middle_notes = []
    base_notes = []
    
    extracted_notes = []
    for note_kw, (note_id, layer) in scent_notes.items():
        if note_kw in name_clean:
            extracted_notes.append((note_kw, layer))
            
    if extracted_notes:
        for note_kw, layer in extracted_notes:
            if layer == "top":
                top_notes.append(note_kw)
            elif layer == "middle":
                middle_notes.append(note_kw)
            elif layer == "base":
                base_notes.append(note_kw)
                
    # 3. Add default layer-appropriate notes if empty
    if category == "Oriental/Attar":
        if not base_notes:
            base_notes.append("oud" if "oud" in name_clean or "wood" in name_clean else "amber")
            base_notes.append("musk")
        if not middle_notes:
            middle_notes.append("rose" if "rose" in name_clean or "ward" in name_clean else "spices")
        if not top_notes:
            top_notes.append("saffron")
    else:
        # Designer/Niche defaults based on gender
        if gender == "male":
            if not top_notes:
                top_notes.append("bergamot")
                if "sport" in name_clean or "fresh" in name_clean:
                    top_notes.append("mint")
                else:
                    top_notes.append("pepper")
            if not middle_notes:
                middle_notes.append("lavender")
            if not base_notes:
                base_notes.append("cedarwood")
                base_notes.append("vetiver" if "vetiver" in name_clean else "patchouli")
        elif gender == "female":
            if not top_notes:
                top_notes.append("pear" if "fruity" in name_clean else "mandarin")
            if not middle_notes:
                middle_notes.append("rose")
                middle_notes.append("jasmine")
            if not base_notes:
                base_notes.append("vanilla")
                base_notes.append("musk")
        else: # Unisex
            if not top_notes:
                top_notes.append("bergamot")
            if not middle_notes:
                middle_notes.append("jasmine")
            if not base_notes:
                base_notes.append("sandalwood")
                base_notes.append("amber")
                
    # Ensure lists are unique and not too large (max 3 per layer)
    top_notes = list(set(top_notes))[:3]
    middle_notes = list(set(middle_notes))[:3]
    base_notes = list(set(base_notes))[:3]
    
    return {
        "top": top_notes,
        "middle": middle_notes,
        "base": base_notes
    }

def main():
    # Load consolidated raw data
    with open(dataset_path, 'r', encoding='utf-8') as f:
        perfumes = json.load(f)
        
    print(f"Loaded {len(perfumes)} perfumes for note enrichment.")
    
    enriched_perfumes = []
    
    # Track brands to seed them first
    unique_brands = {}
    
    for item in perfumes:
        brand = item["brand"]
        original_name = item["original_name"]
        gender = item["gender"].lower() # male, female, unisex
        category = item["category"]
        variants = item["variants"]
        
        # Normalize gender value for SQL
        if gender == "men":
            gender_sql = "male"
        elif gender == "women":
            gender_sql = "female"
        else:
            gender_sql = "unisex"
            
        # Get brand UUID
        brand_key = brand.lower()
        if brand_key not in unique_brands:
            # Check if this is a pre-seeded brand to keep its UUID
            pre_seeded_brands = {
                "chanel": "b1000000-0000-0000-0000-000000000001",
                "dior": "b2000000-0000-0000-0000-000000000002",
                "tom ford": "b3000000-0000-0000-0000-000000000003",
                "creed": "b4000000-0000-0000-0000-000000000004",
                "amouage": "b5000000-0000-0000-0000-000000000005"
            }
            if brand_key in pre_seeded_brands:
                b_uuid = pre_seeded_brands[brand_key]
            else:
                b_uuid = str(uuid.uuid5(uuid.NAMESPACE_DNS, f"brand:{brand_key}"))
            unique_brands[brand_key] = {
                "id": b_uuid,
                "name": brand
            }
            
        b_uuid = unique_brands[brand_key]["id"]
        
        # Deterministic perfume UUID
        perfume_key = f"perfume:{brand_key}:{original_name.lower()}:{gender_sql}"
        p_uuid = str(uuid.uuid5(uuid.NAMESPACE_DNS, perfume_key))
        
        # Enrich notes
        profile = enrich_perfume_notes(original_name, brand, category, gender_sql)
        
        # Map note names to IDs
        mapped_notes = []
        for layer in ["top", "middle", "base"]:
            for note_name in profile[layer]:
                if note_name in scent_notes:
                    note_id, default_layer = scent_notes[note_name]
                    # Use the specified layer from profile, or fallback to note default
                    mapped_notes.append({
                        "note_id": note_id,
                        "note_name": note_name,
                        "layer": layer
                    })
                    
        enriched_perfumes.append({
            "id": p_uuid,
            "brand_id": b_uuid,
            "brand": brand,
            "name": original_name,
            "gender": gender_sql,
            "concentration": "edp",
            "price": 0, # NOT NULL defaulted to 0
            "volume_ml": 100,
            "category": category,
            "variants": variants,
            "notes": mapped_notes
        })
        
    print(f"Enriched {len(enriched_perfumes)} perfumes.")
    
    # Save parsed_catalog.json
    with open(parsed_catalog_path, 'w', encoding='utf-8') as f:
        json.dump(enriched_perfumes, f, indent=2, ensure_ascii=False)
    print(f"Saved {parsed_catalog_path} successfully.")
    
    # Generate SQL file
    print("Generating SQL migration file...")
    sql_lines = [
        "-- Migration to seed massive fragrance catalog",
        "-- Generated automatically by enrich_and_seed.py",
        "",
        "-- 1. Populate Brands",
    ]
    
    # Insert brands
    for b_key, b_info in sorted(unique_brands.items()):
        name_esc = b_info["name"].replace("'", "''")
        sql_lines.append(f"INSERT INTO brands (id, name, country) VALUES ('{b_info['id']}', '{name_esc}', 'France') ON CONFLICT (id) DO NOTHING;")
        
    sql_lines.append("")
    sql_lines.append("-- 2. Populate Perfumes")
    
    # Insert perfumes in chunks to prevent huge queries
    chunk_size = 50
    for i in range(0, len(enriched_perfumes), chunk_size):
        chunk = enriched_perfumes[i:i+chunk_size]
        values = []
        for p in chunk:
            name_esc = p["name"].replace("'", "''")
            is_dupe = "NULL"
            
            # Formulate descriptions in ar, fr, en
            desc_ar = f"عطر مستوحى من {name_esc} بتوليفة عطرية غنية."
            desc_fr = f"Un parfum inspiré de {name_esc} avec des notes raffinées."
            desc_en = f"A signature fragrance inspired by {name_esc}."
            
            desc_ar_esc = desc_ar.replace("'", "''")
            desc_fr_esc = desc_fr.replace("'", "''")
            desc_en_esc = desc_en.replace("'", "''")
            
            # Suffix variants in stock as a text summary in description or store it (since no variants column exists)
            variants_desc = " | ".join([f"{v['code']} ({v['grade']}): {v['price_per_100g']} DA" for v in p["variants"]])
            desc_ar_esc += f" المتغيرات المتوفرة: {variants_desc}"
            desc_en_esc += f" Available variants: {variants_desc}"
            
            val = f"('{p['id']}', '{p['brand_id']}', '{name_esc}', '{p['gender']}'::gender_type, '{p['concentration']}'::concentration_type, 0, 100, '{p['category']}', true, {is_dupe}, '{desc_ar_esc}', '{desc_fr_esc}', '{desc_en_esc}')"
            values.append(val)
            
        sql_lines.append("INSERT INTO perfumes (id, brand_id, name, gender, concentration, price, volume_ml, family, in_stock, is_dupe_of, description_ar, description_fr, description_en) VALUES")
        sql_lines.append(",\n".join(values))
        sql_lines.append("ON CONFLICT (id) DO NOTHING;")
        sql_lines.append("")
        
    sql_lines.append("-- 3. Populate Perfume Notes")
    
    # Insert perfume notes in chunks
    perfume_notes_entries = []
    for p in enriched_perfumes:
        for n in p["notes"]:
            entry = f"('{p['id']}', '{n['note_id']}', '{n['layer']}'::note_layer)"
            perfume_notes_entries.append(entry)
            
    for i in range(0, len(perfume_notes_entries), chunk_size * 2):
        chunk = perfume_notes_entries[i:i+chunk_size*2]
        sql_lines.append("INSERT INTO perfume_notes (perfume_id, note_id, layer) VALUES")
        sql_lines.append(",\n".join(chunk))
        sql_lines.append("ON CONFLICT (perfume_id, note_id) DO NOTHING;")
        sql_lines.append("")
        
    with open(sql_output_path, 'w', encoding='utf-8') as f:
        f.write("\n".join(sql_lines))
        
    print(f"Generated SQL seed file at {sql_output_path}")

if __name__ == "__main__":
    main()
