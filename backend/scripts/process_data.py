import os
import json
import time
import argparse
from typing import List, Dict
from dotenv import load_dotenv
from supabase import create_client, Client
from openai import OpenAI

# Load env variables
script_dir = os.path.dirname(__file__)
load_dotenv(os.path.join(script_dir, '../../.env.local'))
load_dotenv(os.path.join(script_dir, '../../.env'))

# Constants
SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY")
OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    raise ValueError("Missing Supabase credentials")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
client = OpenAI(api_key=OPENAI_API_KEY)

def get_reviews_for_module(module_code: str) -> List[str]:
    """Fetch reviews for a module from Supabase."""
    res = supabase.table("reviews").select("comment").eq("module_code", module_code).limit(20).execute()
    return [r['comment'] for r in res.data if r['comment'] and len(r['comment']) > 20]

def generate_summary(module_code: str, reviews: List[str]) -> Dict:
    """Generate summary and tags using LLM."""
    if not reviews:
        return {"summary": "No reviews available.", "tags": []}

    # Concatenate reviews (truncate to fit context window if needed)
    text_blob = "\n---\n".join(reviews[:15]) 
    
    prompt = f"""
    Analyze the following student reviews for the NUS module {module_code}.
    Generate a detailed summary in Markdown format covering:
    - **Recommended Professors**: specific names mentioned positively.
    - **Workload Analysis**: why it is heavy/light, specific assignments mentioned.
    - **Grading/Scoring**: how people score, bell curve comments.
    - **Pros/Cons**: what is good/bad.
    - **Recommended Semester**: if mentioned (e.g. Sem 1 is better).

    Also extract 5 short tags.

    Return JSON format: 
    {{ 
      "summary": "Detailed markdown string...", 
      "tags": ["tag1", "tag2", "Heavy Workload"] 
    }}
    
    Reviews:
    {text_blob}
    """
    
    try:
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"},
            max_tokens=300
        )
        data = json.loads(response.choices[0].message.content)
        return data
    except Exception as e:
        print(f"Error calling LLM for {module_code}: {e}")
        return {"summary": "Error generating summary.", "tags": []}

def generate_embedding(text: str) -> List[float]:
    """Generate embedding for search."""
    # Ensure text isn't empty
    if not text or len(text.strip()) < 5:
        return []
    try:
        res = client.embeddings.create(input=text, model="text-embedding-3-small")
        return res.data[0].embedding
    except Exception as e:
        print(f"Error generating embedding: {e}")
        return []

def process_single_module(module_code: str, skip_summary: bool = False, skip_embedding: bool = False):
    """Process a single module."""
    print(f"Processing {module_code}...")
    
    # Get Module Data
    mod_res = supabase.table("modules").select("title, description, attributes").eq("module_code", module_code).single().execute()
    if not mod_res.data:
        print(f"Module {module_code} not found.")
        return

    mod = mod_res.data
    attributes = mod.get('attributes') or {}
    
    # 1. Summarize Reviews
    summary_data = {"summary": attributes.get("sentiment_summary", ""), "tags": []}
    
    if not skip_summary:
        reviews = get_reviews_for_module(module_code)
        if reviews:
            summary_data = generate_summary(module_code, reviews)
            print(f"  Generated Summary: {summary_data['summary']}")
            print(f"  Tags: {summary_data['tags']}")
            
            # Update attributes
            attributes['sentiment_summary'] = summary_data['summary']

    # 2. Generate Embedding
    embedding = None
    if not skip_embedding:
        # Combo: Code + Title + Description + Summary + Tags
        search_text = f"{module_code} {mod['title']} {mod['description'] or ''} {summary_data['summary']} {' '.join(summary_data['tags'])}"
        # Truncate
        search_text = search_text[:8000]
        
        embedding = generate_embedding(search_text)
        if embedding:
            print("  Generated Embedding.")

    # 3. Update DB
    update_data = {
        "attributes": attributes,
        "sentiment_tags": summary_data['tags']
    }
    if embedding:
        update_data["embedding"] = embedding
        
    supabase.table("modules").update(update_data).eq("module_code", module_code).execute()
    print(f"  Updated {module_code} successfully.\n")


def main():
    parser = argparse.ArgumentParser(description="Process module reviews and generate embeddings.")
    parser.add_argument("--module", help="Specific module code to process (e.g. CS1010S)")
    parser.add_argument("--limit", type=int, default=10, help="Max modules to process if no specific module")
    parser.add_argument("--skip-summary", action="store_true", help="Skip review summarization")
    parser.add_argument("--skip-embedding", action="store_true", help="Skip embedding generation")
    
    args = parser.parse_args()
    
    if args.module:
        process_single_module(args.module, args.skip_summary, args.skip_embedding)
    else:
        # Process batch (process all modules)
        response = supabase.table("modules").select("module_code").limit(args.limit).execute()
        modules = response.data
        print(f"Batch processing {len(modules)} modules...")
        
        for mod in modules:
            process_single_module(mod['module_code'], args.skip_summary, args.skip_embedding)
            time.sleep(0.5)

if __name__ == "__main__":
    main()
