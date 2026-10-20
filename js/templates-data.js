// Complete Clinical & Ultrasound Templates Library for Hajra Medical Complex
// Extracted & synchronized with Dr. Akram Clinic latest live version
window.DEFAULT_CLINICAL_TEMPLATES = [
  // ── Findings ──
  {
    id: 'd1',
    cat: 'Findings',
    name: 'Normal Study',
    body: 'Normal study. No significant abnormality detected.'
  },
  {
    id: 'd2',
    cat: 'Findings',
    name: 'Normal Liver',
    body: 'Liver size is normal. Parenchymal echogenicity is normal.\nNo focal lesion seen.'
  },
  {
    id: 'd3',
    cat: 'Findings',
    name: 'Renal Stone',
    body: 'Right kidney: Normal in size.\nStone seen in middle pole.\nLeft kidney: Normal.'
  },

  // ── Diagnosis ──
  {
    id: 'd4',
    cat: 'Diagnosis',
    name: 'UTI',
    body: 'Urinary Tract Infection'
  },
  {
    id: 'd5',
    cat: 'Diagnosis',
    name: 'Hypertension',
    body: 'Essential Hypertension'
  },

  // ── Comments & Advice ──
  {
    id: 'd6',
    cat: 'Comments',
    name: 'Follow-up Advice',
    body: 'Patient advised to follow up after 1 week.\nMaintain adequate hydration and rest.'
  },

  // ── Treatment / Rx ──
  {
    id: 'd7',
    cat: 'Treatment',
    name: 'Paracetamol Course',
    body: 'Tab. Paracetamol 500mg — 1+1+1 x 5 days'
  },
  {
    id: 'opd1',
    cat: 'Treatment',
    name: 'Acute Upper Respiratory Infection (URTI)',
    body: '- Tab. Paracetamol 500mg 1 tab TDS x 5 days\n- Tab. Cetirizine 10mg 1 tab OD at night x 5 days\n- Cap. Amoxicillin 500mg 1 cap TDS x 5 days\n- Syp. Cough 2 tsp TDS\n- Steam inhalation BD'
  },
  {
    id: 'opd2',
    cat: 'Treatment',
    name: 'Acute Gastroenteritis (AGE)',
    body: '- Sachet ORS in 1 Liter water, frequent sips\n- Tab. Ciprofloxacin 500mg 1 tab BD x 5 days\n- Tab. Metronidazole 400mg 1 tab TDS x 5 days\n- Tab. Drotaverine 40mg 1 tab SOS for spasm\n- Cap. Omeprazole 20mg 1 cap BD before meals x 5 days'
  },

  // ── Investigations ──
  {
    id: 'd8',
    cat: 'Investigations',
    name: 'Blood CBC & Organ Profile',
    body: 'Complete Blood Count (CBC)\nLiver Function Test (LFT)\nRenal Function Test (RFT)'
  },
  {
    id: 'd9',
    cat: 'Investigations',
    name: 'Ultrasound Abdomen & Pelvis',
    body: 'Ultrasound Abdomen and Pelvis with KUB'
  },

  // ── Recommendations (All 52 Ultrasound & Clinical Recommendations) ──
  { id: 'r001', cat: 'Recommendations', name: 'Normal abdominal scan', body: 'Normal abdominal scan.' },
  { id: 'r002', cat: 'Recommendations', name: 'Normal pelvic scan', body: 'Normal pelvic scan.' },
  { id: 'r003', cat: 'Recommendations', name: 'Normal abdominal & KUB scan', body: 'Normal abdominal & KUB scan.' },
  { id: 'r004', cat: 'Recommendations', name: 'Normal abdominal & pelvic scan', body: 'Normal abdominal & pelvic scan.' },
  { id: 'r005', cat: 'Recommendations', name: 'Bilateral renal stones', body: 'Bilateral renal stones.' },
  { id: 'r006', cat: 'Recommendations', name: 'Bilateral renal concretions', body: 'Bilateral renal concretions.' },
  { id: 'r007', cat: 'Recommendations', name: 'Bilateral renal cysts', body: 'Bilateral renal cysts.' },
  { id: 'r008', cat: 'Recommendations', name: 'Cholelithiasis induced cholecystitis', body: 'Cholelithiasis induced cholecystitis.' },
  { id: 'r009', cat: 'Recommendations', name: 'Fibroid Uterus', body: 'Fibroid Uterus.' },
  { id: 'r010', cat: 'Recommendations', name: 'Gallstones (Cholelithiasis)', body: 'Gallstones (Cholelithiasis).' },
  { id: 'r011', cat: 'Recommendations', name: 'Hepatomegaly', body: 'Hepatomegaly.' },
  { id: 'r012', cat: 'Recommendations', name: 'Hepatomegaly with liver parenchymal changes', body: 'Hepatomegaly with liver parenchymal changes.' },
  { id: 'r013', cat: 'Recommendations', name: 'Hepatosplenomegaly with liver parenchymal changes', body: 'Hepatosplenomegaly with liver parenchymal changes.' },
  { id: 'r014', cat: 'Recommendations', name: 'Hepatomegaly (fatty / inflammatory changes)', body: 'Hepatomegaly (fatty / inflammatory changes).' },
  { id: 'r015', cat: 'Recommendations', name: 'Left obstructive uropathy', body: 'Left obstructive uropathy.' },
  { id: 'r016', cat: 'Recommendations', name: 'Left renal stone & hydronephroureter', body: 'Left renal stone & hydronephroureter.' },
  { id: 'r017', cat: 'Recommendations', name: 'Left renal stone', body: 'Left renal stone.' },
  { id: 'r018', cat: 'Recommendations', name: 'Left renal stones', body: 'Left renal stones.' },
  { id: 'r019', cat: 'Recommendations', name: 'Left renal concretion', body: 'Left renal concretion.' },
  { id: 'r020', cat: 'Recommendations', name: 'Left renal cyst', body: 'Left renal cyst.' },
  { id: 'r021', cat: 'Recommendations', name: 'Left ureteric stone and hydronephroureter', body: 'Left ureteric stone and hydronephroureter.' },
  { id: 'r022', cat: 'Recommendations', name: 'Left adnexal cyst', body: 'Left adnexal cyst.' },
  { id: 'r023', cat: 'Recommendations', name: 'Liver parenchymal disease', body: 'Liver parenchymal disease.' },
  { id: 'r024', cat: 'Recommendations', name: 'Multifibroid Uterus', body: 'Multifibroid Uterus.' },
  { id: 'r025', cat: 'Recommendations', name: 'Right obstructive uropathy', body: 'Right obstructive uropathy.' },
  { id: 'r026', cat: 'Recommendations', name: 'Right renal stone & hydronephroureter', body: 'Right renal stone & hydronephroureter.' },
  { id: 'r027', cat: 'Recommendations', name: 'Right renal stone', body: 'Right renal stone.' },
  { id: 'r028', cat: 'Recommendations', name: 'Right renal stones', body: 'Right renal stones.' },
  { id: 'r029', cat: 'Recommendations', name: 'Right renal concretion', body: 'Right renal concretion.' },
  { id: 'r030', cat: 'Recommendations', name: 'Right ureteric stone and hydronephroureter', body: 'Right ureteric stone and hydronephroureter.' },
  { id: 'r031', cat: 'Recommendations', name: 'Right adnexal cyst', body: 'Right adnexal cyst.' },
  { id: 'r032', cat: 'Recommendations', name: 'Rule out Appendicitis', body: 'Rule out Appendicitis.' },
  { id: 'r033', cat: 'Recommendations', name: 'Splenomegaly', body: 'Splenomegaly.' },
  { id: 'r034', cat: 'Recommendations', name: 'Clinically Gastritis/Muscular pain', body: 'Clinically Gastritis/Muscular pain.' },
  { id: 'r035', cat: 'Recommendations', name: 'Clinically Gastritis/musculoskeletal pain', body: 'Clinically Gastritis/musculoskeletal pain.' },
  { id: 'r036', cat: 'Recommendations', name: 'Clinically Gastritis', body: 'Clinically Gastritis.' },
  { id: 'r037', cat: 'Recommendations', name: 'Clinically Musculoskeletal pain', body: 'Clinically Musculoskeletal pain.' },
  { id: 'r038', cat: 'Recommendations', name: 'Clinically backache', body: 'Clinically backache.' },
  { id: 'r039', cat: 'Recommendations', name: 'Clinically low backache', body: 'Clinically low backache.' },
  { id: 'r040', cat: 'Recommendations', name: 'Clinically Enteritis', body: 'Clinically Enteritis.' },
  { id: 'r041', cat: 'Recommendations', name: 'Clinically Appendicitis', body: 'Clinically Appendicitis.' },
  { id: 'r042', cat: 'Recommendations', name: 'Clinically muscular pain', body: 'Clinically muscular pain.' },
  { id: 'r043', cat: 'Recommendations', name: 'Clinically intestinal colic', body: 'Clinically intestinal colic.' },
  { id: 'r044', cat: 'Recommendations', name: 'Clinically UTI', body: 'Clinically UTI.' },
  { id: 'r045', cat: 'Recommendations', name: 'Clinically Enterocolitis', body: 'Clinically Enterocolitis.' },
  { id: 'r046', cat: 'Recommendations', name: 'Clinically Bronchitis', body: 'Clinically Bronchitis.' },
  { id: 'r047', cat: 'Recommendations', name: 'Epigastric hernia, Hernial rent is', body: 'Epigastric hernia, Hernial rent is [size].' },
  { id: 'r048', cat: 'Recommendations', name: 'Umbilical hernia, Hernial rent is', body: 'Umbilical hernia, Hernial rent is [size].' },
  { id: 'r049', cat: 'Recommendations', name: 'Clinically BPH', body: 'Clinically BPH (Benign Prostatic Hyperplasia).' }
];
