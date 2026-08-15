#!/usr/bin/env python3
"""Validate a single benchmark JSON file against Peasant Smith schema."""
import argparse, json, sys, os
from jsonschema import validate, ValidationError

SCHEMA_PATH = os.path.join(os.path.dirname(__file__), "..", "..", "benchmarks", "schema", "benchmark-schema.json")

def load_schema(path):
    with open(path) as f:
        return json.load(f)

def validate_file(filepath, schema):  
    try:
        with open(filepath) as f:
            data = json.load(f)
    except json.JSONDecodeError as e:
        print(f"FAIL: {filepath} not valid JSON -- {e}")  
        return False
    
    if "example" in data and data.get("example", False):
        print(f"SKIP: {filepath} is marked as example")
        return True
    
    try: 
        validate(instance=data, schema=schema)
    except ValidationError as e:  
        print(f"FAIL {filepath}: {e.message}")
        return False  
    
    print(f"PASS: {filepath}")  
    return True

def main():  
    parser = argparse.ArgumentParser(description="Validate benchmark JSON against schema")  
    parser.add_argument("files", nargs="+", help="JSON files to validate")
    args = parser.parse_args()
    
    schema = load_schema(SCHEMA_PATH)
    failed = 0
    for fpath in args.files:
        if not validate_file(fpath, schema):  
            failed += 1
    
    if failed > 0: 
        print(f"\n{failed} file(s) failed validation")
        sys.exit(1)  
    
    print("\nAll passed!")


if __name__ == "__main__":
    main()
