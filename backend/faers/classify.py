"""Offline drug-family and therapeutic-area classification for FAERS cohorts.

Drug families use INN stem rules (WHO "Use of stems") plus curated member lists.
Indication areas group MedDRA indication PTs by keyword. Both are heuristic and
transparent: every rule is listed here and can be extended.
"""

from __future__ import annotations

import re
from typing import Dict, List, Optional, Tuple

# (family, [explicit members], [regex suffix/stem patterns])
DRUG_FAMILIES: List[Tuple[str, List[str], List[str]]] = [
    ("Statins (HMG-CoA reductase inhibitors)", [], [r"STATIN$"]),
    ("ACE inhibitors", [], [r"PRIL$"]),
    ("Angiotensin II receptor blockers", [], [r"SARTAN$"]),
    ("Beta blockers", [], [r"OLOL$", r"ALOL$", r"ILOL$"]),
    ("Calcium channel blockers (dihydropyridine)", ["DILTIAZEM", "VERAPAMIL"], [r"DIPINE$"]),
    ("Thiazide & loop diuretics", ["HYDROCHLOROTHIAZIDE", "CHLORTHALIDONE", "INDAPAMIDE", "FUROSEMIDE",
                                   "BUMETANIDE", "TORSEMIDE", "METOLAZONE"], [r"THIAZIDE$"]),
    ("Anticoagulants (DOACs & warfarin)", ["WARFARIN", "DABIGATRAN", "DABIGATRAN ETEXILATE", "HEPARIN"],
     [r"XABAN$", r"PARIN$"]),
    ("Antiplatelets", ["CLOPIDOGREL", "PRASUGREL", "TICAGRELOR", "TICLOPIDINE", "CILOSTAZOL", "DIPYRIDAMOLE"],
     [r"GREL(OR)?$"]),
    ("Proton pump inhibitors", [], [r"PRAZOLE$"]),
    ("H2 antagonists", [], [r"TIDINE$"]),
    ("SGLT2 inhibitors", [], [r"GLIFLOZIN$"]),
    ("DPP-4 inhibitors", [], [r"GLIPTIN$"]),
    ("GLP-1 receptor agonists", ["TIRZEPATIDE"], [r"GLUTIDE$", r"ENATIDE$"]),
    ("Insulins", [], [r"^INSULIN"]),
    ("Sulfonylureas", ["GLIPIZIDE", "GLIMEPIRIDE", "GLYBURIDE", "GLIBENCLAMIDE", "GLICLAZIDE"], []),
    ("Biguanides", ["METFORMIN"], []),
    ("Thiazolidinediones", [], [r"GLITAZONE$"]),
    ("SSRIs", ["FLUOXETINE", "SERTRALINE", "PAROXETINE", "CITALOPRAM", "ESCITALOPRAM", "FLUVOXAMINE"], []),
    ("SNRIs", ["VENLAFAXINE", "DESVENLAFAXINE", "DULOXETINE", "MILNACIPRAN", "LEVOMILNACIPRAN"], []),
    ("Tricyclic antidepressants", ["AMITRIPTYLINE", "NORTRIPTYLINE", "IMIPRAMINE", "DESIPRAMINE",
                                   "CLOMIPRAMINE", "DOXEPIN"], [r"TRIPTYLINE$"]),
    ("Atypical antipsychotics", ["CLOZAPINE", "OLANZAPINE", "QUETIAPINE", "RISPERIDONE", "PALIPERIDONE",
                                 "ARIPIPRAZOLE", "BREXPIPRAZOLE", "CARIPRAZINE", "LURASIDONE", "ZIPRASIDONE",
                                 "ASENAPINE", "ILOPERIDONE", "LUMATEPERONE"], [r"PIPRAZOLE$", r"APINE$"]),
    ("Benzodiazepines", [], [r"AZEPAM$", r"AZOLAM$", r"AZEPATE$"]),
    ("Z-drug hypnotics", ["ZOLPIDEM", "ZALEPLON", "ESZOPICLONE", "ZOPICLONE"], []),
    ("Antiepileptics", ["LEVETIRACETAM", "BRIVARACETAM", "LAMOTRIGINE", "VALPROIC ACID", "DIVALPROEX SODIUM",
                        "CARBAMAZEPINE", "OXCARBAZEPINE", "TOPIRAMATE", "PHENYTOIN", "LACOSAMIDE",
                        "ZONISAMIDE", "CENOBAMATE", "PERAMPANEL"], [r"IRACETAM$"]),
    ("Gabapentinoids", ["GABAPENTIN", "PREGABALIN", "GABAPENTIN ENACARBIL"], []),
    ("Opioids", ["MORPHINE", "OXYCODONE", "HYDROCODONE", "HYDROMORPHONE", "FENTANYL", "TRAMADOL",
                 "TAPENTADOL", "METHADONE", "BUPRENORPHINE", "CODEINE", "OXYMORPHONE", "MEPERIDINE"], []),
    ("NSAIDs", ["IBUPROFEN", "NAPROXEN", "DICLOFENAC", "CELECOXIB", "MELOXICAM", "INDOMETHACIN",
                "KETOROLAC", "ETODOLAC", "NABUMETONE", "PIROXICAM", "ASPIRIN", "ACETYLSALICYLIC ACID"],
     [r"COXIB$", r"PROFEN$"]),
    ("Corticosteroids (systemic)", ["PREDNISONE", "PREDNISOLONE", "METHYLPREDNISOLONE", "DEXAMETHASONE",
                                    "HYDROCORTISONE", "BUDESONIDE", "TRIAMCINOLONE", "BETAMETHASONE"], []),
    ("Fluoroquinolones", [], [r"FLOXACIN$"]),
    ("Tetracyclines", [], [r"CYCLINE$"]),
    ("Macrolides", ["AZITHROMYCIN", "CLARITHROMYCIN", "ERYTHROMYCIN"], [r"THROMYCIN$"]),
    ("Beta-lactams (penicillins/cephalosporins/carbapenems)", [], [r"CILLIN$", r"^CEF", r"^CEPH", r"PENEM$"]),
    ("Azole antifungals", [], [r"CONAZOLE$"]),
    ("Antivirals (nucleoside/protease/integrase)", [], [r"VIR$", r"VIRINE$"]),
    ("Bisphosphonates", [], [r"DRONATE$", r"DRONIC ACID$"]),
    ("TNF inhibitors", ["INFLIXIMAB", "ADALIMUMAB", "ETANERCEPT", "CERTOLIZUMAB PEGOL", "GOLIMUMAB"], []),
    ("JAK inhibitors", [], [r"CITINIB$"]),
    ("Immune checkpoint inhibitors", ["NIVOLUMAB", "PEMBROLIZUMAB", "IPILIMUMAB", "ATEZOLIZUMAB",
                                      "DURVALUMAB", "AVELUMAB", "CEMIPLIMAB", "DOSTARLIMAB", "TREMELIMUMAB"], []),
    ("Tyrosine/protein kinase inhibitors", [], [r"TINIB$", r"FENIB$", r"RAFENIB$", r"[A-Z]+NIB$"]),
    ("Monoclonal antibodies (other)", [], [r"MAB$"]),
    ("Fusion proteins / receptor -cepts", [], [r"CEPT$"]),
    ("PDE5 inhibitors", [], [r"AFIL$"]),
    ("Triptans", [], [r"TRIPTAN$"]),
    ("Antihistamines (H1)", ["CETIRIZINE", "LEVOCETIRIZINE", "LORATADINE", "DESLORATADINE", "FEXOFENADINE",
                             "DIPHENHYDRAMINE", "HYDROXYZINE"], []),
    ("Leukotriene modifiers", [], [r"LUKAST$"]),
    ("Inhaled beta-agonists / antimuscarinics", ["ALBUTEROL", "SALBUTAMOL", "TIOTROPIUM", "IPRATROPIUM"],
     [r"TEROL$", r"ONIUM BROMIDE$"]),
    ("Hormonal contraceptives & estrogens", ["ETHINYL ESTRADIOL", "ESTRADIOL", "LEVONORGESTREL",
                                             "NORETHINDRONE", "DROSPIRENONE", "ETONOGESTREL"], [r"GESTREL$"]),
    ("Antineoplastic cytotoxics", ["CYCLOPHOSPHAMIDE", "CISPLATIN", "CARBOPLATIN", "OXALIPLATIN",
                                   "PACLITAXEL", "DOCETAXEL", "DOXORUBICIN", "FLUOROURACIL", "CAPECITABINE",
                                   "GEMCITABINE", "METHOTREXATE", "VINCRISTINE", "ETOPOSIDE", "IRINOTECAN"],
     [r"PLATIN$", r"TAXEL$", r"RUBICIN$", r"CITABINE$"]),
    ("Vaccines", [], [r"VACCINE"]),
    ("Non-opioid analgesics/antipyretics", ["ACETAMINOPHEN", "PARACETAMOL"], []),
    ("Immunomodulatory imides (IMiDs)", ["LENALIDOMIDE", "POMALIDOMIDE", "THALIDOMIDE"], []),
    ("Conventional DMARDs & immunosuppressants", ["HYDROXYCHLOROQUINE", "SULFASALAZINE", "LEFLUNOMIDE",
                                                 "AZATHIOPRINE", "MYCOPHENOLATE MOFETIL", "MYCOPHENOLIC ACID",
                                                 "TACROLIMUS", "CYCLOSPORINE", "CICLOSPORIN", "SIROLIMUS",
                                                 "EVEROLIMUS"], [r"OLIMUS$"]),
    ("Thyroid hormones", ["LEVOTHYROXINE", "LIOTHYRONINE"], []),
    ("Antiemetics (5-HT3)", [], [r"SETRON$"]),
    ("Dopaminergic antiparkinson agents", ["LEVODOPA", "CARBIDOPA", "PRAMIPEXOLE", "ROPINIROLE",
                                           "ROTIGOTINE", "RASAGILINE", "SELEGILINE"], []),
    ("Stimulants (ADHD)", ["METHYLPHENIDATE", "DEXMETHYLPHENIDATE", "AMPHETAMINE", "DEXTROAMPHETAMINE",
                           "LISDEXAMFETAMINE", "ATOMOXETINE"], []),
    ("Potassium/electrolyte & vitamin supplements", ["POTASSIUM CHLORIDE", "CHOLECALCIFEROL", "VITAMIN D",
                                                     "FOLIC ACID", "CYANOCOBALAMIN", "ERGOCALCIFEROL"], []),
    ("Intravenous immunoglobulin", [], [r"IMMUNE GLOBULIN", r"IMMUNOGLOBULIN"]),
]

_COMPILED = [(fam, set(members), [re.compile(p) for p in pats]) for fam, members, pats in DRUG_FAMILIES]

_SALT_RE = re.compile(
    r"\b(HYDROCHLORIDE|HCL|SODIUM|POTASSIUM|CALCIUM|MAGNESIUM|MESYLATE|MALEATE|TARTRATE|SUCCINATE|"
    r"FUMARATE|CITRATE|ACETATE|SULFATE|SULPHATE|BESYLATE|BROMIDE|PHOSPHATE|DIHYDRATE|MONOHYDRATE|"
    r"HYDRATE|HYCLATE|TROMETHAMINE|DISODIUM|ER|XR|XL|SR|CR|DR|ODT|TABLETS?|CAPSULES?|INJECTION|ORAL)\b"
)
_DOSE_RE = re.compile(r"\d+(\.\d+)?\s*(MG|MCG|G|ML|IU|UNITS?|%)\b.*$")


def normalize_drug(drugname: Optional[str], prod_ai: Optional[str] = None) -> str:
    """Prefer active ingredient; strip doses, salts and formulation words."""
    name = (prod_ai or "").strip() or (drugname or "").strip()
    name = name.upper().replace("\\", " ").replace("/", " / ")
    name = _DOSE_RE.sub("", name)
    name = re.sub(r"[\(\)\[\]\.,;:\"']", " ", name)
    name = _SALT_RE.sub(" ", name)
    return re.sub(r"\s+", " ", name).strip()


def classify_drug(norm_name: str) -> str:
    if not norm_name:
        return "Unclassified"
    # Combination products: classify on the first ingredient that matches
    for part in [p.strip() for p in re.split(r" / |\bAND\b|,|\+", norm_name) if p.strip()]:
        for fam, members, pats in _COMPILED:
            if part in members or any(p.search(part) for p in pats):
                return fam
    return "Unclassified"


INDICATION_AREAS: List[Tuple[str, List[str]]] = [
    ("Oncology", ["NEOPLASM", "CANCER", "CARCINOMA", "LYMPHOMA", "LEUKAEMIA", "LEUKEMIA", "MYELOMA",
                  "MELANOMA", "SARCOMA", "GLIOBLASTOMA", "METASTA", "TUMOUR", "TUMOR", "MYELODYSPLAS"]),
    ("Diabetes & metabolic", ["DIABETES", "GLUCOSE", "HYPERGLYCAEMIA", "OBESITY", "WEIGHT", "INSULIN"]),
    ("Cardiovascular", ["HYPERTENSION", "BLOOD PRESSURE", "ATRIAL", "HEART FAILURE", "CARDIAC", "ANGINA",
                        "MYOCARDIAL", "ARRHYTHMIA", "CORONARY", "CHOLESTEROL", "LIPID", "HYPERLIPID",
                        "THROMBOSIS", "EMBOLISM", "STROKE", "ANTICOAGULANT"]),
    ("Psychiatry", ["DEPRESSION", "DEPRESSIVE", "ANXIETY", "SCHIZOPHRENIA", "BIPOLAR", "PSYCHOTIC",
                    "ATTENTION DEFICIT", "INSOMNIA", "PANIC", "OBSESSIVE", "MOOD"]),
    ("Neurology", ["EPILEPSY", "SEIZURE", "CONVULSION", "MULTIPLE SCLEROSIS", "PARKINSON", "MIGRAINE",
                   "ALZHEIMER", "DEMENTIA", "NEUROPATH", "RESTLESS LEGS"]),
    ("Pain & analgesia", ["PAIN", "ANALGESI", "ARTHRALGIA", "BACK PAIN", "FIBROMYALGIA"]),
    ("Rheumatology & immunology", ["RHEUMATOID", "PSORIATIC", "ANKYLOSING", "LUPUS", "ARTHRITIS",
                                   "VASCULITIS", "GOUT", "SJOGREN"]),
    ("Dermatology", ["PSORIASIS", "DERMATITIS", "ECZEMA", "ACNE", "URTICARIA", "HIDRADENITIS"]),
    ("Gastroenterology", ["CROHN", "COLITIS", "GASTROOESOPHAGEAL", "REFLUX", "ULCER", "DYSPEPSIA",
                          "IRRITABLE BOWEL", "CONSTIPATION", "NAUSEA"]),
    ("Respiratory", ["ASTHMA", "CHRONIC OBSTRUCTIVE", "COPD", "PULMONARY", "BRONCH", "CYSTIC FIBROSIS"]),
    ("Infectious disease", ["INFECTION", "HIV", "HEPATITIS", "PNEUMONIA", "SEPSIS", "COVID", "INFLUENZA",
                            "TUBERCULOSIS", "BACTERIAL", "FUNGAL", "VIRAL", "PROPHYLAXIS"]),
    ("Haematology", ["ANAEMIA", "ANEMIA", "NEUTROPENIA", "THROMBOCYTOPENIA", "HAEMOPHILIA", "SICKLE"]),
    ("Endocrine & bone", ["OSTEOPOROSIS", "HYPOTHYROID", "THYROID", "MENOPAUS", "HORMONE", "TESTOSTERONE"]),
    ("Reproductive & urology", ["CONTRACEPTION", "INFERTILITY", "ERECTILE", "PROSTAT", "OVERACTIVE BLADDER",
                                "URINARY"]),
    ("Ophthalmology", ["MACULAR", "GLAUCOMA", "RETINO", "OCULAR", "UVEITIS"]),
    ("Transplant", ["TRANSPLANT", "REJECTION"]),
    ("Vaccination / immunisation", ["IMMUNISATION", "IMMUNIZATION", "VACCINATION"]),
]

UNINFORMATIVE_INDICATIONS = {"PRODUCT USED FOR UNKNOWN INDICATION", "DRUG USE FOR UNKNOWN INDICATION",
                             "UNKNOWN", ""}


def classify_indication(pt: Optional[str]) -> str:
    p = (pt or "").upper().strip()
    if p in UNINFORMATIVE_INDICATIONS:
        return "Unknown indication"
    for area, keys in INDICATION_AREAS:
        if any(k in p for k in keys):
            return area
    return "Other"


def family_names() -> List[str]:
    return [f for f, _, _ in DRUG_FAMILIES] + ["Unclassified"]


def area_names() -> List[str]:
    return [a for a, _ in INDICATION_AREAS] + ["Other", "Unknown indication"]


def classification_rules() -> Dict[str, object]:
    return {
        "drug_families": [{"family": f, "members": m, "patterns": p} for f, m, p in DRUG_FAMILIES],
        "indication_areas": [{"area": a, "keywords": k} for a, k in INDICATION_AREAS],
    }
