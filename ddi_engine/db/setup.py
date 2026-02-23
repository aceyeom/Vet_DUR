import psycopg2
import json
import os

# Database connection
conn = psycopg2.connect(
    host="localhost",
    database="vet_dur",
    user="postgres",
    password="password",
    port="5432"
)
cursor = conn.cursor()

# Drop tables if exist
tables = ['drug_dosing', 'drug_elimination', 'drug_risk_flags', 'drug_metabolism', 'drugs']
for table in tables:
    cursor.execute(f"DROP TABLE IF EXISTS {table} CASCADE")

# Create tables from schema
with open('db/schema.sql', 'r') as f:
    schema = f.read()
cursor.execute(schema)

# Load data from JSON
data_path = os.path.join(os.path.dirname(__file__), '..', 'data', 'drugs.json')
with open(data_path, 'r') as f:
    drugs = json.load(f)

for drug in drugs:
    # Insert drug
    cursor.execute("INSERT INTO drugs VALUES (%s, %s, %s, %s, %s)", (
        drug['id'], drug['inn_name'], drug['korean_name'], drug['drug_class'], drug['narrow_therapeutic_index']
    ))

    # Insert metabolism
    for metab in drug['metabolism']:
        cursor.execute("INSERT INTO drug_metabolism (drug_id, cyp_isoenzyme, role, inhibition_strength) VALUES (%s, %s, %s, %s)", (
            drug['id'], metab['cyp_isoenzyme'], metab['role'], metab['inhibition_strength']
        ))

    # Insert risk flags
    rf = drug['risk_flags']
    cursor.execute("INSERT INTO drug_risk_flags VALUES (%s, %s, %s, %s, %s, %s, %s)", (
        drug['id'], rf['qt_prolongation_risk'], rf['bleeding_risk'], rf['nephrotoxicity'],
        rf['hepatotoxicity'], rf['gi_ulcer_risk'], rf['other_risk']
    ))

    # Insert elimination
    elim = drug['elimination']
    cursor.execute("INSERT INTO drug_elimination VALUES (%s, %s, %s, %s)", (
        drug['id'], elim['renal_percent'], elim['hepatic_percent'], elim['half_life_dog_hr']
    ))

    # Insert dosing
    for dose in drug['dosing']:
        cursor.execute("INSERT INTO drug_dosing (drug_id, species, min_mg_per_kg, max_mg_per_kg, interval_hr) VALUES (%s, %s, %s, %s, %s)", (
            drug['id'], dose['species'], dose['min_mg_per_kg'], dose['max_mg_per_kg'], dose['interval_hr']
        ))

conn.commit()
cursor.close()
conn.close()

print("Database setup complete.")