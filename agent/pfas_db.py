import sqlite3
from datetime import datetime
import os

# Ensure data folder exists
os.makedirs("data", exist_ok=True)
DB_PATH = "data/pfas_data.db"

def init_db():
    """Initialize the SQLite database."""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS PFAS_Data (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            date TEXT,
            product_name TEXT,
            removal_percentage REAL,
            tender_price REAL
        )
    ''')
    conn.commit()
    conn.close()

def insert_pfas_data(data):
    """Insert PFAS data into database."""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    today = datetime.today().strftime('%Y-%m-%d')
    for d in data:
        cursor.execute('''
            INSERT INTO PFAS_Data (date, product_name, removal_percentage, tender_price)
            VALUES (?, ?, ?, ?)
        ''', (today, d['product'], d['removal_percentage'], d['tender_price']))
    conn.commit()
    conn.close()

def get_monthly_data(month=None, year=None):
    """Retrieve monthly PFAS data."""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    query = "SELECT date, product_name, removal_percentage, tender_price FROM PFAS_Data"
    if month and year:
        query += f" WHERE strftime('%Y', date)='{year}' AND strftime('%m', date)='{month:02d}'"
    cursor.execute(query)
    rows = cursor.fetchall()
    conn.close()
    return rows
