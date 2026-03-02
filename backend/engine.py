import os
import psycopg2
import psycopg2.pool
import json

# Connection pool — shared across all calls in this process
_pool = psycopg2.pool.ThreadedConnectionPool(
    minconn=1,
    maxconn=10,
    host=os.environ.get('DB_HOST', 'localhost'),
    database=os.environ.get('DB_NAME', 'vet_dur'),
    user=os.environ.get('DB_USER', 'postgres'),
    password=os.environ.get('DB_PASSWORD', ''),
    port=os.environ.get('DB_PORT', '5432')
)


def _get_conn():
    return _pool.getconn()


def _put_conn(conn):
    _pool.putconn(conn)


def _fetch_substance(cursor, substance_id):
    """Return core substance attributes needed by the rule engine."""
    cursor.execute(
        """
        SELECT inn_name, drug_class, narrow_therapeutic_index
        FROM substances s
        JOIN pd_risk_flags p ON p.substance_id = s.id
        WHERE s.id = %s
        """,
        (substance_id,)
    )
    row = cursor.fetchone()
    if not row:
        raise ValueError(f"Substance {substance_id} not found")
    return row  # (inn_name, drug_class, narrow_therapeutic_index)


def _fetch_risk_flags(cursor, substance_id):
    """Return PD risk flags from pd_risk_flags."""
    cursor.execute(
        """
        SELECT qt_prolongation, bleeding_risk, nephrotoxicity,
               hepatotoxicity, gi_ulcer_risk, electrolyte_k,
               serotonin_syndrome_risk, mdr1_mutation_risk
        FROM pd_risk_flags
        WHERE substance_id = %s
        """,
        (substance_id,)
    )
    return cursor.fetchone()
    # (qt_prolongation, bleeding_risk, nephrotoxicity, hepatotoxicity,
    #  gi_ulcer_risk, electrolyte_k, serotonin_syndrome_risk, mdr1_mutation_risk)


def _fetch_elimination(cursor, substance_id, species='dog'):
    """Return PK elimination data from pk_parameters (route-independent row)."""
    cursor.execute(
        """
        SELECT renal_elimination_pct, hepatic_elimination_pct, half_life_hr
        FROM pk_parameters
        WHERE substance_id = %s AND species = %s AND route = 'all'
        """,
        (substance_id, species)
    )
    return cursor.fetchone()
    # (renal_elimination_pct, hepatic_elimination_pct, half_life_hr)


def _fetch_cyp_profiles(cursor, substance_id):
    """Return all CYP profile rows for a substance from cyp_profiles."""
    cursor.execute(
        """
        SELECT cyp_isoenzyme, role, inhibition_strength
        FROM cyp_profiles
        WHERE substance_id = %s
        """,
        (substance_id,)
    )
    return cursor.fetchall()
    # [(cyp_isoenzyme, role, inhibition_strength), ...]


# ---------------------------------------------------------------------------
# Severity mappings
# Architecture spec (Section 16): contraindicated=100, major=75, moderate=40,
#                                  minor=15, info=5
# Internal engine scores map to these buckets.
# ---------------------------------------------------------------------------
RISK_LEVELS = {'none': 0, 'low': 1, 'moderate': 2, 'high': 3}
QT_LEVELS   = {'none': 0, 'low': 1, 'moderate': 2, 'high': 3}
BLEED_LEVELS = {'none': 0, 'low': 1, 'moderate': 2, 'high': 3}

SEVERITY_SCORE = {
    'contraindicated': 100,
    'major': 75,
    'moderate': 40,
    'minor': 15,
    'info': 5,
    'none': 0
}


def _score_to_severity(score):
    if score >= 75:
        return 'major'
    if score >= 40:
        return 'moderate'
    if score >= 15:
        return 'minor'
    if score >= 5:
        return 'info'
    return 'none'


def check_interaction(substance_a_id, substance_b_id, patient_context):
    """
    Run Engine 1 (DDI) rule checks for a pair of substances.

    patient_context keys:
        species         (str)  — 'dog' | 'cat'
        renal_disease   (bool)
        lab_creatinine  (float | None) — mg/dL
        lab_alt         (float | None) — U/L

    Returns:
        {
            "severity": str,
            "score": int,
            "triggered_rules": [{"rule": str, "mechanism": str, "recommendation": str}, ...]
        }
    """
    species = patient_context.get('species', 'dog')
    conn = _get_conn()
    try:
        cursor = conn.cursor()

        # Fetch substance A
        a_name, a_class, a_narrow = _fetch_substance(cursor, substance_a_id)
        a_flags = _fetch_risk_flags(cursor, substance_a_id)
        a_elim  = _fetch_elimination(cursor, substance_a_id, species)
        a_cyp   = _fetch_cyp_profiles(cursor, substance_a_id)

        # Fetch substance B
        b_name, b_class, b_narrow = _fetch_substance(cursor, substance_b_id)
        b_flags = _fetch_risk_flags(cursor, substance_b_id)
        b_elim  = _fetch_elimination(cursor, substance_b_id, species)
        b_cyp   = _fetch_cyp_profiles(cursor, substance_b_id)

        cursor.close()
    finally:
        _put_conn(conn)

    # Unpack risk flags (may be None if row missing)
    if a_flags:
        a_qt, a_bleed, a_neph, a_hep, a_gi, a_elec_k, a_sero, a_mdr1 = a_flags
    else:
        a_qt = a_bleed = a_neph = a_hep = a_gi = 'none'
        a_elec_k = 'none'
        a_sero = a_mdr1 = False

    if b_flags:
        b_qt, b_bleed, b_neph, b_hep, b_gi, b_elec_k, b_sero, b_mdr1 = b_flags
    else:
        b_qt = b_bleed = b_neph = b_hep = b_gi = 'none'
        b_elec_k = 'none'
        b_sero = b_mdr1 = False

    # Unpack elimination (may be None if row missing)
    a_renal = float(a_elim[0]) if a_elim and a_elim[0] is not None else 0.0
    b_renal = float(b_elim[0]) if b_elim and b_elim[0] is not None else 0.0

    triggered = []
    max_score = 0

    # -----------------------------------------------------------------------
    # Rule 1: CYP Inhibition
    # Check A inhibits isoform where B is substrate, and vice versa.
    # Severity escalates if the substrate has a narrow therapeutic index.
    # -----------------------------------------------------------------------
    def _check_cyp_inhibition(inhibitor_cyp, inhibitor_name, substrate_cyp, substrate_name, substrate_narrow):
        for inh_enzyme, inh_role, inh_strength in inhibitor_cyp:
            if inh_role != 'inhibitor' or inh_strength != 'strong':
                continue
            for sub_enzyme, sub_role, _ in substrate_cyp:
                if sub_role == 'substrate' and inh_enzyme == sub_enzyme:
                    sev = 'major' if substrate_narrow else 'moderate'
                    return {
                        'rule': 'CYP_INHIBITION',
                        'severity': sev,
                        'mechanism': (
                            f"{inhibitor_name} strongly inhibits {inh_enzyme}, "
                            f"increasing plasma levels of {substrate_name}."
                        ),
                        'recommendation': "Consider dose reduction or close therapeutic monitoring."
                    }
        return None

    for hit in [
        _check_cyp_inhibition(a_cyp, a_name, b_cyp, b_name, b_narrow),
        _check_cyp_inhibition(b_cyp, b_name, a_cyp, a_name, a_narrow),
    ]:
        if hit:
            score = SEVERITY_SCORE[hit['severity']]
            max_score = max(max_score, score)
            triggered.append(hit)

    # -----------------------------------------------------------------------
    # Rule 2: QT Prolongation Stacking
    # Requires at least one 'high' drug or combined score >= 4 for major alert.
    # -----------------------------------------------------------------------
    a_qt_num = QT_LEVELS.get(a_qt, 0)
    b_qt_num = QT_LEVELS.get(b_qt, 0)
    qt_sum = a_qt_num + b_qt_num
    # Threshold: at least one high (3) + any low/moderate, OR both moderate
    if max(a_qt_num, b_qt_num) >= 3 and qt_sum >= 4:
        sev = 'major'
    elif qt_sum >= 4:
        sev = 'moderate'
    elif qt_sum >= 3:
        sev = 'minor'
    else:
        sev = None

    if sev:
        score = SEVERITY_SCORE[sev]
        max_score = max(max_score, score)
        triggered.append({
            'rule': 'QT_STACKING',
            'severity': sev,
            'mechanism': "Additive QT prolongation risk.",
            'recommendation': "Monitor ECG or avoid combination."
        })

    # -----------------------------------------------------------------------
    # Rule 3: Bleeding / GI Ulcer Stacking
    # -----------------------------------------------------------------------
    a_bleed_num = BLEED_LEVELS.get(a_bleed, 0)
    b_bleed_num = BLEED_LEVELS.get(b_bleed, 0)
    if a_bleed_num >= 2 and b_bleed_num >= 2:
        score = SEVERITY_SCORE['major']
        max_score = max(max_score, score)
        triggered.append({
            'rule': 'BLEEDING_STACKING',
            'severity': 'major',
            'mechanism': "Additive bleeding and/or GI ulceration risk.",
            'recommendation': "Avoid combination or add gastroprotection (e.g. omeprazole)."
        })

    # -----------------------------------------------------------------------
    # Rule 4: Duplicate NSAID
    # -----------------------------------------------------------------------
    if a_class == 'nsaid' and b_class == 'nsaid':
        score = SEVERITY_SCORE['contraindicated']
        max_score = max(max_score, score)
        triggered.append({
            'rule': 'DUPLICATE_NSAID',
            'severity': 'contraindicated',
            'mechanism': "Duplicate NSAID therapy — additive GI, renal, and bleeding risk.",
            'recommendation': "Contraindicated. Use one NSAID only."
        })

    # -----------------------------------------------------------------------
    # Rule 5: Renal Elimination Risk in Renal Disease
    # Fires when both drugs rely heavily on renal elimination (>= 60%) in a
    # patient with confirmed renal disease.
    # -----------------------------------------------------------------------
    if patient_context.get('renal_disease', False) and a_renal >= 0.60 and b_renal >= 0.60:
        score = SEVERITY_SCORE['major']
        max_score = max(max_score, score)
        triggered.append({
            'rule': 'RENAL_ELIMINATION_STACKING',
            'severity': 'major',
            'mechanism': (
                "Both drugs rely heavily on renal elimination in a patient with renal disease."
            ),
            'recommendation': "Consider dose adjustment or alternative therapy."
        })

    # -----------------------------------------------------------------------
    # Rule 6: Nephrotoxic Drug in Renal Patient
    # Catches NSAIDs and other nephrotoxic drugs in renal disease regardless
    # of their elimination route (e.g. carprofen is primarily hepatic but
    # impairs renal prostaglandin-mediated perfusion).
    # -----------------------------------------------------------------------
    lab_creatinine = patient_context.get('lab_creatinine')
    has_renal_concern = patient_context.get('renal_disease', False) or (
        lab_creatinine is not None and lab_creatinine > 1.4  # IRIS Stage 2 dog threshold
    )
    if has_renal_concern:
        for name, neph in [(a_name, a_neph), (b_name, b_neph)]:
            if RISK_LEVELS.get(neph, 0) >= 2:  # moderate or high
                score = SEVERITY_SCORE['major']
                max_score = max(max_score, score)
                triggered.append({
                    'rule': 'NEPHROTOXIC_DRUG_RENAL_PATIENT',
                    'severity': 'major',
                    'mechanism': (
                        f"{name} has {neph} nephrotoxicity risk in a patient with "
                        "renal impairment. Direct renal toxicity or impaired perfusion risk."
                    ),
                    'recommendation': "Avoid nephrotoxic drugs in renal disease. Consider alternatives."
                })

    # -----------------------------------------------------------------------
    # Rule 7: Electrolyte-Mediated DDI
    # Furosemide (or any K-depleting drug) + cardiac glycoside / NTI drug.
    # Hypokalemia sensitises myocardium to digoxin toxicity even without
    # renal disease — this is separate from the renal elimination rule.
    # -----------------------------------------------------------------------
    def _check_electrolyte_ddi(depleting_name, depleting_elec_k, nti_name, nti_flag):
        if depleting_elec_k == 'deplete' and nti_flag:
            return {
                'rule': 'ELECTROLYTE_MEDIATED_DDI',
                'severity': 'major',
                'mechanism': (
                    f"{depleting_name} may cause hypokalemia, increasing toxicity risk of "
                    f"{nti_name} (narrow therapeutic index drug sensitive to electrolyte shifts)."
                ),
                'recommendation': (
                    "Monitor serum potassium. Consider potassium supplementation "
                    "or alternative diuretic."
                )
            }
        return None

    for hit in [
        _check_electrolyte_ddi(a_name, a_elec_k, b_name, b_narrow),
        _check_electrolyte_ddi(b_name, b_elec_k, a_name, a_narrow),
    ]:
        if hit:
            score = SEVERITY_SCORE[hit['severity']]
            max_score = max(max_score, score)
            triggered.append(hit)

    # -----------------------------------------------------------------------
    # Rule 8: Serotonin Syndrome Risk
    # Tramadol, trazodone, MAOIs, SSRIs, mirtazapine — additive serotonergic risk.
    # -----------------------------------------------------------------------
    if a_sero and b_sero:
        score = SEVERITY_SCORE['major']
        max_score = max(max_score, score)
        triggered.append({
            'rule': 'SEROTONIN_SYNDROME',
            'severity': 'major',
            'mechanism': (
                f"Both {a_name} and {b_name} carry serotonin syndrome risk. "
                "Additive serotonergic stimulation may cause hyperthermia, agitation, seizures."
            ),
            'recommendation': "Avoid combination. Use non-serotonergic alternatives where possible."
        })

    severity = _score_to_severity(max_score)
    return {
        "severity": severity,
        "score": max_score,
        "triggered_rules": triggered
    }


# ---------------------------------------------------------------------------
# Test cases
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    # These IDs must exist in the substances table.
    # Update with real UUIDs after seeding the database.
    KETOCONAZOLE_ID = os.environ.get('TEST_ID_KETOCONAZOLE', 'ketoconazole-uuid')
    PREDNISOLONE_ID = os.environ.get('TEST_ID_PREDNISOLONE', 'prednisolone-uuid')
    CARPROFEN_ID    = os.environ.get('TEST_ID_CARPROFEN',    'carprofen-uuid')
    FUROSEMIDE_ID   = os.environ.get('TEST_ID_FUROSEMIDE',   'furosemide-uuid')
    DIGOXIN_ID      = os.environ.get('TEST_ID_DIGOXIN',      'digoxin-uuid')

    test_cases = [
        ("Ketoconazole + Prednisolone",     KETOCONAZOLE_ID, PREDNISOLONE_ID, {"species": "dog", "renal_disease": False}),
        ("Carprofen + Prednisolone",         CARPROFEN_ID,    PREDNISOLONE_ID, {"species": "dog", "renal_disease": False}),
        ("Furosemide + Digoxin (renal Dx)",  FUROSEMIDE_ID,   DIGOXIN_ID,      {"species": "dog", "renal_disease": True}),
        ("Furosemide + Digoxin (normal)",    FUROSEMIDE_ID,   DIGOXIN_ID,      {"species": "dog", "renal_disease": False}),
        ("Carprofen + Carprofen",            CARPROFEN_ID,    CARPROFEN_ID,    {"species": "dog", "renal_disease": False}),
    ]

    for label, id_a, id_b, ctx in test_cases:
        try:
            result = check_interaction(id_a, id_b, ctx)
            print(f"\n{label}:")
            print(json.dumps(result, indent=2))
        except Exception as e:
            print(f"\n{label}: ERROR — {e}")
