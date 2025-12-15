import pandas as pd
import psycopg2
from dotenv import load_dotenv
import os
load_dotenv()

conn = psycopg2.connect(
    dbname="arthya",
    user="postgres",
    password=os.getenv("DB_PASSWORD"),
    host="localhost",
    port="5432"
)
print("Database connection established.")

def fetch_data(userId: int) -> pd.DataFrame:
    """Fetch data from PostgreSQL database and return as a pandas DataFrame."""
    query = """
        SELECT 
            (t.date AT TIME ZONE 'America/New_York')::date AS "Date",
            t.category AS "Category",
            t.amount AS "Daily_Income",
            COALESCE(e.amount, 0) AS "Daily_Expenses",
            u.occupation AS "Job_Type"
        FROM transactions t
        LEFT JOIN users u ON u.id = t."userId"
        LEFT JOIN (
            SELECT 
                date::date AS date, 
                SUM(amount) AS amount 
            FROM transactions 
            WHERE type = 'expense' 
            GROUP BY date::date
        ) e ON t.date::date = e.date
        WHERE t.type = 'income' AND t."userId" = %s;
    """
    return pd.read_sql_query(query, conn, params=(userId,))

if __name__ == "__main__":
    df = fetch_data(userId=1)
    print(df) 