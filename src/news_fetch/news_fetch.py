# File: src/news_fetch/news_fetch.py

import requests
import time
import json
from pprint import pprint
from datetime import datetime, timedelta
import os
from dotenv import load_dotenv
from tqdm import tqdm

# Load environment variables
load_dotenv(dotenv_path='../../config/.env')

username = os.getenv("USERNAME")
password = os.getenv("PASSWORD")
AppID = os.getenv("APP_ID")


def get_auth_header(username, password, appid):
    # Generate the authorization header for making requests to the Aylien API.
    token_response = requests.post(
        'https://api.aylien.com/v1/oauth/token',
        auth=(username, password),
        data={'grant_type': 'password'}
    )
    token_response.raise_for_status()
    token = token_response.json()['access_token']
    headers = {
        'Authorization': f'Bearer {token}',
        'AppId': appid
    }
    return headers


def get_stories(params, headers, max_stories=20):
    # Fetch stories from the Aylien News API using the provided parameters and headers.
    fetched_stories = []
    stories = None

    while stories is None or len(stories) > 0:
        try:
            response = requests.get('https://api.aylien.com/v6/news/stories', params=params, headers=headers,
                                    timeout=30)
            if response.status_code == 200:
                response_json = response.json()
                stories = response_json.get('stories', [])
                fetched_stories.extend(stories)
                if len(fetched_stories) >= max_stories:
                    fetched_stories = fetched_stories[:max_stories]
                    break
                if 'next_page_cursor' in response_json:
                    params['cursor'] = response_json['next_page_cursor']
                else:
                    break
                tqdm.write(f"Fetched {len(stories)} stories. Total story count so far: {len(fetched_stories)}")
            elif response.status_code == 429:
                tqdm.write("Rate limit reached. Sleeping for 10 seconds.")
                time.sleep(10)
            elif 500 <= response.status_code <= 599:
                tqdm.write(f"Server error {response.status_code}. Sleeping for 260 seconds.")
                time.sleep(260)
            else:
                tqdm.write(response.text)
                break
        except requests.exceptions.Timeout:
            tqdm.write("Request timed out. Retrying...")
            continue
        except Exception as e:
            tqdm.write(str(e))
            break
    return fetched_stories


def filter_stories(stories):
    filtered_stories = []
    for story in stories:
        # Filter the categories with score 1 in ay.econ or ay.fin
        filtered_categories = [
            {"id": category.get("id", ""), "label": category.get("label", ""), "score": category.get("score", "")}
            for category in story.get("categories", [])
            if category.get("score") == 1 and category.get("id") in ["ay.econ", "ay.fin"]
        ]

        # Add the story if it has at least one category with a score of 1 in ay.econ or ay.fin
        if filtered_categories:
            filtered_story = {
                "author": story.get("author", {}),
                "body": story.get("body", ""),
                "summary": story.get("summary", {}).get("sentences", []),
                "title": story.get("title", ""),
                "source": {
                    "domain": story.get("source", {}).get("domain", ""),
                    "home_page_url": story.get("source", {}).get("home_page_url", ""),
                    "name": story.get("source", {}).get("name", "")
                },
                "categories": filtered_categories
            }
            filtered_stories.append(filtered_story)

    return filtered_stories


def fetch_and_save_news_for_day(date, counter):
    headers = get_auth_header(username, password, AppID)
    params = {
        'published_at': f'[{date}T00:00:00Z TO {date}T23:59:59Z]',
        'language': 'en',
        'categories': '{{taxonomy:aylien AND id:(ay.econ OR ay.fin)}}',
        'source.name': '("The New York Times" OR "The Washington Post" OR "Wall Street Journal" OR "USA Today" OR '
                       '"Los Angeles Times" OR "The Los Angeles Times" OR "Chicago Tribune" OR "The Chicago Tribune" '
                       'OR "New York Post" OR "Boston Globe" OR "The Boston Globe" OR "Star Tribune" OR "Newsday"' 
                       'OR "The Economist" OR "The Financial Times" OR "The Guardian" OR "The Times UK")',
        'sentiment.title.polarity': '(negative OR neutral OR positive)',
        'sort_by': 'relevance',
        'per_page': 100
    }

    # Fetch stories with a limit of 20 per day
    stories = get_stories(params, headers, max_stories=20)
    filtered_stories = filter_stories(stories)

    # Ensure the directory exists
    os.makedirs('../../data/news', exist_ok=True)

    # Save the filtered stories to a JSON file
    if filtered_stories:
        filename = f"../../data/news/{counter}_{date.replace('-', '_')}.json"
        with open(filename, "w") as file:
            json.dump(filtered_stories, file, indent=4)
        tqdm.write(f"Filtered stories saved to {filename}")
    else:
        tqdm.write(f"No stories found for {date}")


if __name__ == '__main__':
    start_date = datetime.strptime("2023-01-01", "%Y-%m-%d")
    end_date = datetime.strptime("2023-12-31", "%Y-%m-%d")
    total_days = (end_date - start_date).days + 1  # Calculate total number of days to process
    counter = 1

    with tqdm(total=total_days, desc="Progress", unit="day", ncols=100) as pbar:
        current_date = start_date
        while current_date <= end_date:
            date_str = current_date.strftime("%Y-%m-%d")
            fetch_and_save_news_for_day(date_str, counter)
            current_date += timedelta(days=1)
            counter += 1
            pbar.update(1)  # Update the progress bar