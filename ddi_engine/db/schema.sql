CREATE TABLE drugs (
id TEXT PRIMARY KEY,
inn_name TEXT NOT NULL,
korean_name TEXT,
drug_class TEXT,
narrow_therapeutic_index BOOLEAN DEFAULT FALSE
);

CREATE TABLE drug_metabolism (
id SERIAL PRIMARY KEY,
drug_id TEXT REFERENCES drugs(id),
cyp_isoenzyme TEXT,
role TEXT CHECK (role IN ('substrate','inhibitor','inducer')),
inhibition_strength TEXT CHECK (inhibition_strength IN ('weak','moderate','strong'))
);

CREATE TABLE drug_risk_flags (
drug_id TEXT PRIMARY KEY REFERENCES drugs(id),
qt_prolongation_risk TEXT CHECK (qt_prolongation_risk IN ('none','low','moderate','high')),
bleeding_risk TEXT CHECK (bleeding_risk IN ('none','low','moderate','high')),
nephrotoxicity TEXT CHECK (nephrotoxicity IN ('none','low','moderate','high')),
hepatotoxicity TEXT CHECK (hepatotoxicity IN ('none','low','moderate','high')),
gi_ulcer_risk TEXT CHECK (gi_ulcer_risk IN ('none','low','moderate','high')),
other_risk TEXT CHECK (other_risk IN ('none','low','moderate','high'))
);

CREATE TABLE drug_elimination (
drug_id TEXT PRIMARY KEY REFERENCES drugs(id),
renal_percent INTEGER,
hepatic_percent INTEGER,
half_life_dog_hr FLOAT
);

CREATE TABLE drug_dosing (
id SERIAL PRIMARY KEY,
drug_id TEXT REFERENCES drugs(id),
species TEXT,
min_mg_per_kg FLOAT,
max_mg_per_kg FLOAT,
interval_hr FLOAT
);