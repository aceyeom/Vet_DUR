import psycopg2
import json

def check_interaction(drugA_id, drugB_id, patient_context):
    # Database connection
    conn = psycopg2.connect(
        host="localhost",
        database="vet_dur",
        user="postgres",
        password="password",
        port="5432"
    )
    cursor = conn.cursor()

    # Get drug A attributes
    cursor.execute("SELECT inn_name, drug_class, narrow_therapeutic_index FROM drugs WHERE id = %s", (drugA_id,))
    a_row = cursor.fetchone()
    if not a_row:
        raise ValueError(f"Drug {drugA_id} not found")
    a_name, a_class, a_narrow = a_row

    cursor.execute("SELECT qt_prolongation_risk, bleeding_risk, nephrotoxicity, hepatotoxicity, gi_ulcer_risk, other_risk FROM drug_risk_flags WHERE drug_id = %s", (drugA_id,))
    a_qt, a_bleed, a_neph, a_hep, a_gi, a_other = cursor.fetchone()

    cursor.execute("SELECT renal_percent, hepatic_percent, half_life_dog_hr FROM drug_elimination WHERE drug_id = %s", (drugA_id,))
    a_renal, a_hep_elim, a_half = cursor.fetchone()

    cursor.execute("SELECT cyp_isoenzyme, role, inhibition_strength FROM drug_metabolism WHERE drug_id = %s", (drugA_id,))
    a_metab = cursor.fetchall()

    # Get drug B attributes
    cursor.execute("SELECT inn_name, drug_class, narrow_therapeutic_index FROM drugs WHERE id = %s", (drugB_id,))
    b_row = cursor.fetchone()
    if not b_row:
        raise ValueError(f"Drug {drugB_id} not found")
    b_name, b_class, b_narrow = b_row

    cursor.execute("SELECT qt_prolongation_risk, bleeding_risk, nephrotoxicity, hepatotoxicity, gi_ulcer_risk, other_risk FROM drug_risk_flags WHERE drug_id = %s", (drugB_id,))
    b_qt, b_bleed, b_neph, b_hep, b_gi, b_other = cursor.fetchone()

    cursor.execute("SELECT renal_percent, hepatic_percent, half_life_dog_hr FROM drug_elimination WHERE drug_id = %s", (drugB_id,))
    b_renal, b_hep_elim, b_half = cursor.fetchone()

    cursor.execute("SELECT cyp_isoenzyme, role, inhibition_strength FROM drug_metabolism WHERE drug_id = %s", (drugB_id,))
    b_metab = cursor.fetchall()

    cursor.close()
    conn.close()

    # Severity mappings
    severity_levels = {'none': 0, 'low': 2, 'moderate': 5, 'high': 8}
    qt_levels = {'none': 0, 'low': 1, 'moderate': 2, 'high': 3}
    bleed_levels = {'none': 0, 'low': 1, 'moderate': 2, 'high': 3}

    def get_severity(score):
        if score >= 8:
            return 'high'
        elif score >= 5:
            return 'moderate'
        elif score >= 2:
            return 'low'
        else:
            return 'none'

    triggered = []
    max_score = 0

    # Rule 1: CYP Inhibition (check both directions)
    for drug1_metab, drug1_name, drug1_narrow, drug2_metab, drug2_name in [(a_metab, a_name, a_narrow, b_metab, b_name), (b_metab, b_name, b_narrow, a_metab, a_name)]:
        for enzyme, role, strength in drug1_metab:
            if role == 'inhibitor' and strength == 'strong':
                for enz2, rol2, str2 in drug2_metab:
                    if rol2 == 'substrate' and enzyme == enz2:
                        sev = 'high' if drug1_narrow else 'moderate'  # Wait, no: if the substrate drug has narrow
                        # In the loop, drug1 is inhibitor, drug2 is substrate, so if drug2_narrow
                        # In the tuple, for first: drug1=a (inhib), drug2=b (sub), so if b_narrow
                        # For second: drug1=b (inhib), drug2=a (sub), so if a_narrow
                        # Yes, in the code: sev = 'high' if drug2_narrow else 'moderate'  # since drug2 is the substrate
                        # But in the tuple, for first: drug2_name = b_name, but drug2_narrow not passed.
                        # Mistake.
                        # I need to pass the narrow for the substrate.
                        # So, better to separate.

    # Better way:
    # Check A inhibitor, B substrate
    for a_enzyme, a_role, a_strength in a_metab:
        if a_role == 'inhibitor' and a_strength == 'strong':
            for b_enzyme, b_role, b_strength in b_metab:
                if b_role == 'substrate' and a_enzyme == b_enzyme:
                    sev = 'high' if b_narrow else 'moderate'
                    score = severity_levels[sev]
                    max_score = max(max_score, score)
                    triggered.append({
                        'rule': 'CYP_INHIBITION',
                        'mechanism': f"{a_name} inhibits CYP{a_enzyme}, increasing levels of {b_name}.",
                        'recommendation': "Consider dose reduction or close monitoring."
                    })

    # Check B inhibitor, A substrate
    for b_enzyme, b_role, b_strength in b_metab:
        if b_role == 'inhibitor' and b_strength == 'strong':
            for a_enzyme, a_role, a_strength in a_metab:
                if a_role == 'substrate' and b_enzyme == a_enzyme:
                    sev = 'high' if a_narrow else 'moderate'
                    score = severity_levels[sev]
                    max_score = max(max_score, score)
                    triggered.append({
                        'rule': 'CYP_INHIBITION',
                        'mechanism': f"{b_name} inhibits CYP{b_enzyme}, increasing levels of {a_name}.",
                        'recommendation': "Consider dose reduction or close monitoring."
                    })

    # Rule 2: QT Stacking
    a_qt_num = qt_levels[a_qt]
    b_qt_num = qt_levels[b_qt]
    sum_qt = a_qt_num + b_qt_num
    if sum_qt >= 4:
        sev = 'high'
    elif sum_qt >= 3:
        sev = 'moderate'
    else:
        sev = None
    if sev:
        score = severity_levels[sev]
        max_score = max(max_score, score)
        triggered.append({
            'rule': 'QT_STACKING',
            'mechanism': "Additive QT prolongation risk.",
            'recommendation': "Monitor ECG or avoid combination."
        })

    # Rule 3: Bleeding Stacking
    a_bleed_num = bleed_levels[a_bleed]
    b_bleed_num = bleed_levels[b_bleed]
    if a_bleed_num >= 2 and b_bleed_num >= 2:
        sev = 'high'
        score = severity_levels[sev]
        max_score = max(max_score, score)
        triggered.append({
            'rule': 'BLEEDING_STACKING',
            'mechanism': "Additive bleeding/GI ulcer risk.",
            'recommendation': "Avoid combination or add gastroprotection."
        })

    # Rule 4: Duplicate NSAID
    if a_class == 'nsaid' and b_class == 'nsaid':
        sev = 'high'
        score = severity_levels[sev]
        max_score = max(max_score, score)
        triggered.append({
            'rule': 'DUPLICATE_NSAID',
            'mechanism': "Duplicate NSAID therapy.",
            'recommendation': "Avoid concurrent NSAID use."
        })

    # Rule 5: Renal Risk in Renal Disease
    if patient_context.get('renal_disease', False) and a_renal >= 60 and b_renal >= 60:
        sev = 'high'
        score = severity_levels[sev]
        max_score = max(max_score, score)
        triggered.append({
            'rule': 'RENAL_RISK_RENAL_DISEASE',
            'mechanism': "Both drugs rely heavily on renal elimination in a patient with renal disease.",
            'recommendation': "Consider dose adjustment or alternative therapy."
        })

    severity = get_severity(max_score)
    return {
        "severity": severity,
        "score": max_score,
        "triggered_rules": triggered
    }

# Test cases
if __name__ == "__main__":
    # Ketoconazole + Prednisolone
    result = check_interaction('D2', 'D3', {"species": "dog", "renal_disease": False})
    print("Ketoconazole + Prednisolone:")
    print(json.dumps(result, indent=2))

    # Carprofen + Prednisolone
    result = check_interaction('D4', 'D3', {"species": "dog", "renal_disease": False})
    print("\nCarprofen + Prednisolone:")
    print(json.dumps(result, indent=2))

    # Furosemide + Digoxin with renal_disease=True
    result = check_interaction('D5', 'D6', {"species": "dog", "renal_disease": True})
    print("\nFurosemide + Digoxin (renal disease):")
    print(json.dumps(result, indent=2))

    # Carprofen + Carprofen
    result = check_interaction('D4', 'D4', {"species": "dog", "renal_disease": False})
    print("\nCarprofen + Carprofen:")
    print(json.dumps(result, indent=2))