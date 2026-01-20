import os
import json
import sys
from dotenv import load_dotenv
from supabase import create_client, Client

# Add parent directory to path to allow importing if needed (though not strictly necessary for this script)
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

load_dotenv()

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    print("Error: SUPABASE_URL and SUPABASE_KEY must be set in .env")
    print("Please ensure you have configured your environment variables.")
    sys.exit(1)

try:
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
except Exception as e:
    print(f"Error connecting to Supabase: {e}")
    sys.exit(1)

INPUT_FILE = os.path.join(os.path.dirname(__file__), '../seeds/public_data.json')

def seed_table(table_name, rows):
    if not rows:
        print(f"No data found for table '{table_name}', skipping.")
        return

    print(f"Seeding table '{table_name}' with {len(rows)} rows...")
    
    # Supabase bulk insert limit is usually generous, but batching is safer
    BATCH_SIZE = 100
    total_inserted = 0
    
    for i in range(0, len(rows), BATCH_SIZE):
        batch = rows[i:i + BATCH_SIZE]
        try:
            # upsert=True allows re-running the script without errors on duplicate PKs
            supabase.table(table_name).upsert(batch).execute()
            total_inserted += len(batch)
            print(f"  Processed {total_inserted}/{len(rows)}...")
        except Exception as e:
            print(f"  Error inserting batch into {table_name}: {e}")
            # Continue to next batch even if one fails
            continue

    print(f"Finished seeding '{table_name}'.")

def main():
    if not os.path.exists(INPUT_FILE):
        print(f"Error: Seed file not found at {INPUT_FILE}")
        sys.exit(1)
        
    print(f"Reading data from {INPUT_FILE}...")
    try:
        with open(INPUT_FILE, 'r') as f:
            data = json.load(f)
    except json.JSONDecodeError as e:
        print(f"Error decoding JSON: {e}")
        sys.exit(1)
        
    # Define the order of seeding to respect foreign key constraints
    # 1. Modules (referenced by offerings, reviews)
    # 2. Independent tables or those dependent on modules
    seed_order = [
         "modules", 
         "module_offerings", 
         "reviews", 
         "degree_requirements", 
         "exchange_modules"
    ]
    
    for table in seed_order:
        if table in data:
            seed_table(table, data[table])
        else:
            print(f"Note: Table '{table}' not present in seed file.")
            
    print("\n✅ Seeding complete! Your database is now populated with the public data.")

if __name__ == "__main__":
    main()
