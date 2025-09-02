import matplotlib.pyplot as plt
from pfas_db import get_monthly_data
import pandas as pd
import os

os.makedirs("data", exist_ok=True)

def plot_monthly_trends(month=None, year=None):
    """Generate monthly trend chart."""
    rows = get_monthly_data(month, year)
    if not rows:
        return "No data available"

    df = pd.DataFrame(rows, columns=['date','product','removal','price'])
    df['date'] = pd.to_datetime(df['date'])

    # Average removal per product
    avg_removal = df.groupby('product')['removal'].mean()
    avg_removal.plot(kind='bar', title='Monthly PFAS Removal %')
    plt.ylabel('Removal %')
    plt.tight_layout()
    chart_path = 'data/monthly_trends.png'
    plt.savefig(chart_path)
    plt.close()
    return chart_path
