#!/usr/bin/env python3
"""Simplified benchmark runner for Peasant Smith data collection."""
import datetime, json, os, platform

def collect_hardware_info():
    return {
        "cpu": platform.processor(),
        "platform": platform.system() + " " + platform.release(),
        "python_version": platform.python_version()
    }

if __name__ == "__main__":
    print("Collecting hardware info...")
    info = collect_hardware_info()
    print(json.dumps(info, indent=2))
