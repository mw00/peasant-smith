#!/usr/bin/env python3
"""Validate Peasant Smith CSV structure and cross-file consistency.

Checks:
  - required columns in data/benchmarks.csv, data/hardware.csv, data/models.csv,
    data/systems.csv
  - every hardware_ref in benchmarks.csv exists in systems.csv
  - VRAM consistency between data/hardware.csv and hardware/gpus/*.yml
"""
import csv, os, re, sys

REPO = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DATA = os.path.join(REPO, "data")

EXPECTED = {
    "benchmarks.csv": ["benchmark_id", "model_name", "quantization", "gpu_name",
                       "gpu_vram_gb", "inference_backend", "result_classification"],
    "hardware.csv": ["gpu_name", "vendor", "architecture", "release_year", "vram_gb"],
    "models.csv": ["model_name", "model_family", "parameter_count_billions"],
    "systems.csv": ["system_slug", "gpu_model", "gpu_count", "cpu_model",
                    "system_ram_gb", "os"],
}

errors = 0


def check_headers(fname, cols):
    global errors
    path = os.path.join(DATA, fname)
    if not os.path.isfile(path):
        print(f"FAIL data/{fname}: file missing")
        errors += 1
        return None
    with open(path, newline="") as f:
        reader = csv.DictReader(f)
        headers = reader.fieldnames or []
        missing = set(cols) - set(headers)
        if missing:
            print(f"FAIL data/{fname}: missing columns {sorted(missing)}")
            errors += 1
            return None
        rows = list(reader)
        print(f"PASS data/{fname} ({len(rows)} rows)")
        return rows


bench = check_headers("benchmarks.csv", EXPECTED["benchmarks.csv"])
check_headers("hardware.csv", EXPECTED["hardware.csv"])
check_headers("models.csv", EXPECTED["models.csv"])
systems = check_headers("systems.csv", EXPECTED["systems.csv"])

# hardware_ref join check (raw JSON -> systems.csv)
if systems is not None:
    slugs = {r["system_slug"] for r in systems}
    import glob, json
    raw_dir = os.path.join(REPO, "benchmarks", "raw")
    bad = 0
    for path in glob.glob(os.path.join(raw_dir, "*.json")):
        rec = json.load(open(path))
        ref = rec.get("hardware_ref")
        if ref and ref not in slugs:
            print(f"FAIL {os.path.basename(path)}: hardware_ref '{ref}' not in systems.csv")
            errors += 1
            bad += 1
    if bad == 0:
        print("PASS hardware_ref join (all raw records reference registered systems)")

# VRAM consistency: hardware.csv vs hardware/gpus/*.yml
hw_csv = os.path.join(DATA, "hardware.csv")
gpus_dir = os.path.join(REPO, "hardware", "gpus")
if os.path.isfile(hw_csv) and os.path.isdir(gpus_dir):
    csv_vram = {}
    with open(hw_csv, newline="") as f:
        for row in csv.DictReader(f):
            csv_vram[row["gpu_name"].lower()] = float(row["vram_gb"])
    for yml in sorted(os.listdir(gpus_dir)):
        if not yml.endswith((".yml", ".yaml")):
            continue
        text = open(os.path.join(gpus_dir, yml)).read()
        m_name = re.search(r"^name:\s*(.+)$", text, re.M)
        m_vram = re.search(r"^vram_gb:\s*([0-9.]+)", text, re.M)
        if not (m_name and m_vram):
            continue
        key = m_name.group(1).strip().lower()
        if key in csv_vram and abs(csv_vram[key] - float(m_vram.group(1))) > 0.01:
            print(f"FAIL VRAM mismatch for '{m_name.group(1)}': "
                  f"csv={csv_vram[key]} yml={m_vram.group(1)}")
            errors += 1
    print("PASS VRAM cross-check hardware.csv vs hardware/gpus/")

if errors:
    print(f"\n{errors} issue(s) found")
    sys.exit(1)
print("\nAll CSV checks passed.")
