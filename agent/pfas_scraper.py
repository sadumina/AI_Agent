import requests
from bs4 import BeautifulSoup

def fetch_pfas_data():
    """Scrape PFAS data from Haycarb website."""
    url = "https://www.haycarb.com/activated-carbon-solutions/water/drinking-water-treatment/pfas-removal/"
    response = requests.get(url)
    soup = BeautifulSoup(response.text, 'html.parser')

    data = []

    # Adjust selector according to the actual HTML table
    table = soup.find('table')
    if table:
        rows = table.find_all('tr')
        for row in rows[1:]:  # Skip header
            cols = row.find_all('td')
            if len(cols) >= 3:
                product = cols[0].text.strip()
                removal = float(cols[1].text.strip().replace('%',''))
                try:
                    price = float(cols[2].text.strip().replace('$',''))
                except:
                    price = 0.0
                data.append({
                    'product': product,
                    'removal_percentage': removal,
                    'tender_price': price
                })
    return data
