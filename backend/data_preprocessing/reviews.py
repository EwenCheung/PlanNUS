import requests
import json
import time
import os

API_KEY = 'DsPr3Ch73fQ9220jPS3CBhhB7Gk8BXHIHLgvmgXyqoCN4GYVp7navJ7W6KMP7yKb' # Insert your API key here

epoch = int(time.time())

# Create data directory if it doesn't exist
data_dir = os.path.join(os.path.dirname(__file__), 'backend', 'data')
os.makedirs(data_dir, exist_ok=True)

for endpoint in ['Posts', 'Threads']:
    print(f"\n{'='*50}")
    print(f"Fetching {endpoint} from Disqus API...")
    print(f"{'='*50}")

    params = {
        'api_key': API_KEY,
        'forum': 'nusmods-prod',
        'limit': 100,
    }

    first_write = True  # Flag to indicate if the file is being written for the first time
    item_count = 0
    page_count = 0
    
    output_file_name = os.path.join(data_dir, f'all_{endpoint.lower()}_{epoch}.json')

    with open(output_file_name, 'w') as file:
        file.write('[')  # Start of the JSON array

        has_next = True  # Assume there is at least one page initially
        while has_next:
            response = requests.get(f"https://disqus.com/api/3.0/forums/list{endpoint}.json", params=params)
            data = response.json()
            page_count += 1

            # Each data['response'] is an array; iterate and write each item
            for item in data['response']:
                if not first_write:
                    file.write(',')  # Comma separates items
                json.dump(item, file, indent=4)
                first_write = False
                item_count += 1

            print(f"  Page {page_count}: Fetched {len(data['response'])} items (Total: {item_count})")

            # Check if there is a next page
            has_next = data['cursor']['hasNext']

            # Update cursor to the next one if there is a next page
            if has_next:
                params['cursor'] = data['cursor']['next']
            

        file.write(']')  # End of the JSON array

    print(f"\n✓ {endpoint} saved to '{output_file_name}'")
    print(f"  Total items: {item_count}")


"""

You can! Use the Disqus API: https://disqus.com/api/docs/. Each course is one thread, and each comment is a post (which has a thread attribute, the thread it was posted in).

The endpoint forums/listThreads lets you list all threads, and forums/listPosts lets you list all comments.

Some notes which might be helpful:
- You'll have to create a Disqus account and register an application first (which is instant) to get the appropriate API Keys
- For both listPosts and listThreads sure to include the forum parameter with the value nusmods-prod
- It might be helpful to set limit to 100

Disqus _does_ have a rate limit, but it's 1000 calls per 30 minutes, and if you set limit to 100 you should be able to dump out all course reviews (posts) with ~60 calls, and retrieve the details of every thread with ~250 calls
"""