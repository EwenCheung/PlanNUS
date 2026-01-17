
import os
from app.supabase_client import get_supabase

def check_sep_data():
    supabase = get_supabase()
    try:
        res = supabase.table("exchange_modules").select("count", count="exact").execute()
        print(f"Exchange modules count: {res.count}")
        
        # Sample data
        res = supabase.table("exchange_modules").select("*").limit(1).execute()
        if res.data:
            print("Sample data:", res.data[0])
        else:
            print("No data found in exchange_modules")
            
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    check_sep_data()
