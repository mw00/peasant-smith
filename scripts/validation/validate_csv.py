#!/usr/bin/env python3
"""Validate benchmark CSV structure and detect issues."""
import csv, os, sys

BASE_DIR = "/home/manoel/peasant-smith"
DATA_DIR = os.path.join(BASE_DIR, "data")

EXPECTED_BENCH_COLS = ["benchmark_id","model_name","quantization","gpu_name","gpu_vram_gb"]
EXPECTED_HW_COLS   = ["gpu_name","vendor","architecture","release_year","vram_gb"]  
EXPECTED_MODEL_COLS= ["model_name","model_family","parameter_count_billions"]

errors = 0

def check_csv(filepath, expected_cols):
    global errors
    if not os.path.isfile(filepath):   
        return
    try:
        with open(filepath, newline="") as f:
            reader = csv.DictReader(f)
            headers = reader.fieldnames or []
            missing = set(expected_cols) - set(headers)
            if missing:
                print(f"FAIL {filepath}: missing columns {missing}")
                errors += 1
            else:
                print(f"PASS {filepath} (headers check ok)")
    except Exception as e:
        print(f"ERROR {filepath}: {e}")
        errors += 1

check_csv(os.path.join(DATA_DIR, "benchmarks.csv"), EXPECTED_BENCH_COLS) 
check_csv(os.path.join(DATA_DIR, "hardware.csv"), EXPECTED_HW_COLS)  
check_csv(os.path.join(DATA_DIR, "models.csv"), EXPECTED_MODEL_COLS)  

if errors:
    print(f"\n{errors} issue(s) found")
    sys.exit(1)

print("\nAll CSV checks passed.")
