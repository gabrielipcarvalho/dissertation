# File: News_Fetch/news_fetch.py

import requests
import time
import json
from pprint import pprint
from datetime import datetime, timedelta
import os

# Replace with your credentials
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


def get_stories(params, headers, max_stories=100):
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
                print(f"Fetched {len(stories)} stories. Total story count so far: {len(fetched_stories)}")
            elif response.status_code == 429:
                print("Rate limit reached. Sleeping for 10 seconds.")
                time.sleep(10)
            elif 500 <= response.status_code <= 599:
                print(f"Server error {response.status_code}. Sleeping for 260 seconds.")
                time.sleep(260)
            else:
                pprint(response.text)
                break
        except requests.exceptions.Timeout:
            print("Request timed out. Retrying...")
            continue
        except Exception as e:
            print(e)
            break
    return fetched_stories


def filter_stories(stories):
    filtered_stories = []
    for story in stories:
        # Keep the basic fields
        filtered_story = {
            "author": story.get("author", {}),
            "body": story.get("body", ""),
            "summary": story.get("summary", {}).get("sentences", []),
            "title": story.get("title", ""),
            "source": {
                "domain": story.get("source", {}).get("domain", ""),
                "home_page_url": story.get("source", {}).get("home_page_url", ""),
                "name": story.get("source", {}).get("name", "")
            }
        }

        # Filter the categories
        filtered_categories = [
            {"id": category.get("id", ""), "label": category.get("label", ""), "score": category.get("score", "")}
            for category in story.get("categories", [])
            if category.get("id") == "ay.impact"
        ]

        # Add categories if the filtered list is not empty
        if filtered_categories:
            filtered_story["categories"] = filtered_categories

        filtered_stories.append(filtered_story)

    return filtered_stories


def fetch_and_save_news_for_day(date, counter):
    headers = get_auth_header(username, password, AppID)
    params = {
        'published_at': f'[{date}T00:00:00Z TO {date}T23:59:59Z]',
        'language': 'en',
        'categories': '{{taxonomy:aylien AND id:(ay.biz.dividend OR ay.lifesoc.disater OR ay.fin.sharehld OR ay.fin.reports OR ay.pol.civilun OR ay.biz.regulat OR ay.impact.ops OR ay.impact.ratings OR ay.biz.bankrupt) AND score: [0.8 TO 1]}}',
        'source.name': '("Yahoo Finance" OR "Marketwatch" OR "Investing" OR "Nasdaq" OR "CNBC" OR "StockMarketWire (UK)" OR "Market Screener" OR "Seeking Alpha" OR "Investors.com" OR "The Motley Fool" OR "INO" OR "Money Control" OR "AlphaStreet" OR "Equitymaster" OR "Washingtonpost.com" OR "New York Times, The" OR "Wall Street Journal")',
        'sentiment.title.polarity': '(negative OR neutral OR positive)',
        'sort_by': 'relevance',
        'per_page': 100
    }

    response = requests.get('https://api.aylien.com/v6/news/stories', params=params, headers=headers)
    response.raise_for_status()
    response_json = response.json()

    stories = response_json.get('stories', [])
    filtered_stories = filter_stories(stories)

    # Ensure the directory exists
    os.makedirs('./News_Data', exist_ok=True)

    # Save the filtered stories to a JSON file
    if filtered_stories:
        filename = f"./News_Data/{counter}_{date.replace('-', '_')}.json"
        with open(filename, "w") as file:
            json.dump(filtered_stories, file, indent=4)
        print(f"Filtered stories saved to {filename}")
    else:
        print(f"No stories found for {date}")


if __name__ == '__main__':
    start_date = datetime.strptime("2023-01-02", "%Y-%m-%d")
    end_date = datetime.strptime("2024-07-14", "%Y-%m-%d")
    current_date = start_date
    counter = 1

    while current_date <= end_date:
        date_str = current_date.strftime("%Y-%m-%d")
        fetch_and_save_news_for_day(date_str, counter)
        current_date += timedelta(days=1)
        counter += 1