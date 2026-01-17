import requests
import json
import pandas as pd

def fetch_all_modules(acad_year="2025-2026"):
    """
    Fetch all modules from NUSMods moduleInfo.json
    
    Args:
        acad_year (str): Academic year (default: "2025-2026")
    
    Returns:
        list: List of all module data or None if request fails
    """
    url = f"https://api.nusmods.com/v2/{acad_year}/moduleInfo.json"
    headers = {"accept": "application/json"}
    
    try:
        response = requests.get(url, headers=headers)
        response.raise_for_status()
        return response.json()
    except requests.exceptions.RequestException as e:
        print(f"Error fetching module info: {e}")
        return None

def fetch_module_details(module_code, acad_year="2025-2026"):
    """
    Fetch detailed module data from NUSMods API
    
    Args:
        module_code (str): Module code (e.g., "CS3263")
        acad_year (str): Academic year (default: "2025-2026")
    
    Returns:
        dict: Module data or None if request fails
    """
    url = f"https://api.nusmods.com/v2/{acad_year}/modules/{module_code}.json"
    headers = {"accept": "application/json"}
    
    try:
        response = requests.get(url, headers=headers)
        response.raise_for_status()
        return response.json()
    except requests.exceptions.RequestException as e:
        print(f"Error fetching {module_code}: {e}")
        return None

def extract_module_info(module_data):
    """
    Extract required fields from module data
    
    Args:
        module_data (dict): Raw module data from API
    
    Returns:
        dict: Extracted module information
    """
    if not module_data:
        return None
    
    # Check which semesters are offered
    semester_data = module_data.get("semesterData", [])
    sem1_offered = any(sem.get("semester") == 1 for sem in semester_data)
    sem2_offered = any(sem.get("semester") == 2 for sem in semester_data)
    
    return {
        "moduleCode": module_data.get("moduleCode", "NA"),
        "title": module_data.get("title", "NA"),
        "faculty": module_data.get("faculty", "NA"),
        "prerequisite": module_data.get("prerequisite", "NA"),
        "preclusion": module_data.get("preclusion", "NA"),
        "corequisite": module_data.get("corequisite", "NA"),
        "semester1": sem1_offered,
        "semester2": sem2_offered
    }

def process_all_modules(acad_year="2025-2026"):
    """
    Fetch and extract data for all modules from moduleInfo.json
    
    Args:
        acad_year (str): Academic year (default: "2025-2026")
    
    Returns:
        list: List of extracted module information
    """
    print(f"Fetching all modules for {acad_year}...")
    modules = fetch_all_modules(acad_year)
    
    if not modules:
        return []
    
    results = []
    total = len(modules)
    
    for i, module in enumerate(modules, 1):
        module_code = module.get("moduleCode")
        print(f"Processing {module_code} ({i}/{total})...")
        
        # Fetch detailed data for each module
        detailed_data = fetch_module_details(module_code, acad_year)
        extracted = extract_module_info(detailed_data)
        
        if extracted:
            results.append(extracted)
    
    return results

def save_to_csv(data, filename="modules.csv"):
    """
    Save extracted data to CSV file
    
    Args:
        data (list): List of module dictionaries
        filename (str): Output filename
    """
    df = pd.DataFrame(data)
    df.to_csv(filename, index=False)
    print(f"Data saved to {filename}")

def save_to_json(data, filename="modules.json"):
    """
    Save extracted data to JSON file
    
    Args:
        data (list): List of module dictionaries
        filename (str): Output filename
    """
    with open(filename, 'w') as f:
        json.dump(data, f, indent=2)
    print(f"Data saved to {filename}")

# Example usage
if __name__ == "__main__":
    # Fetch all modules from moduleInfo.json and process them
    all_modules = process_all_modules("2025-2026")
    
    # Display summary
    print(f"\nTotal modules processed: {len(all_modules)}")
    
    # Display first few as DataFrame
    if all_modules:
        df = pd.DataFrame(all_modules)
        print("\nFirst 5 modules:")
        print(df.head())
        
        # Save to CSV
        save_to_csv(all_modules, "all_nusmods_data.csv")
        
        # Save to JSON
        save_to_json(all_modules, "all_nusmods_data.json")