#!/usr/bin/env python3
"""One-off migration: ingest the Aug 2026 benchmark results into
schema-valid raw JSON records under benchmarks/raw/.

Source data: /home/manoel/benchmarks/*.jsonl (reasoning-v1 suite harness output).
All runs executed on system 'gpu-box-01' (2x RTX 3060 12GB) between 2026-08-09 and 2026-08-11.

Re-run safely: overwrites benchmarks/raw/PS-*.json (idempotent).
"""
import csv, glob, json, os, statistics
from datetime import datetime, timezone

SRC = "/home/manoel/benchmarks"
REPO = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
RAW = os.path.join(REPO, "benchmarks", "raw")
SCHEMA_VERSION = "1.0"

HARDWARE_BASE = {
    "gpu_name": "NVIDIA GeForce RTX 3060",
    "gpu_vendor": "NVIDIA",
    "gpu_architecture": "Ampere",
    "gpu_vram_gb": 12,
    "gpu_count": 2,
    "cpu_name": "Intel Xeon E5-1650 v4",
    "cpu_cores": 6,
    "cpu_threads": 12,
    "system_ram_gb": 128,
    "system_ram_speed_mhz": None,
    "storage_type": "NVMe SSD",
    "operating_system": "Ubuntu 26.04 LTS (kernel 7.0.0-29-generic)",
}
SOFTWARE_OLLAMA = {
    "inference_backend": "Ollama",
    "backend_version": "0.32.8",
    "runtime": "CUDA",
    "driver_version": "610.43.02",
}
SOFTWARE_LLAMACPP = {
    "inference_backend": "llama.cpp (llama-server)",
    "runtime": "CUDA",
    "driver_version": "610.43.02",
    "command_or_configuration": (
        "llama-server -m Ling-3.0-flash-AD-IQ4_XXS-merged.gguf -c 65536 -ncmoe 32 "
        "-ngl 99 --no-mmap -t 8 --tensor-split 5,1 --flash-attn 1"
    ),
}

# model key -> metadata. Nulls are honest: value was not recorded at run time.
META = {
    "Qwen35-Hermes:latest": dict(
        name="Qwen35-Hermes", family="Qwen3.5", quant=None, size=None,
        params=None, active=None,
        note="Ollama import name; quantization not recorded at run time."),
    "Laguna-S-2.1:latest": dict(
        name="Laguna-S-2.1", family="Laguna (InclusionAI)", quant=None, size=None,
        params=2.1e9, active=2.1e9,
        note="Parameter count inferred from model name (S-2.1)."),
    "Laguna-S-2.1-IQ4XS": dict(
        name="Laguna-S-2.1", family="Laguna (InclusionAI)", quant="IQ4_XS", size=None,
        params=2.1e9, active=2.1e9,
        note="UD-IQ4_XS GGUF, shards merged with llama-gguf-split. Parameter count inferred from model name."),
    "LFM2.5-2.6B:latest": dict(
        name="LFM2.5-2.6B", family="LiquidFM (Liquid AI)", quant=None, size=None,
        params=2.6e9, active=2.6e9, note=""),
    "Qwen27B:latest": dict(
        name="Qwen27B", family="Qwen3.8", quant=None, size=18.0,
        params=27e9, active=27e9,
        note="Ollama import predating q27bQ4; quantization not recorded at run time. File size from ollama list."),
    "gemma4-26b-a4b:latest": dict(
        name="gemma4-26b-a4b", family="Gemma 4", quant=None, size=None,
        params=26e9, active=4e9,
        note="MoE; active parameter count inferred from model tag (a4b)."),
    "gemma4-31b:latest": dict(
        name="gemma4-31b", family="Gemma 4", quant=None, size=None,
        params=31e9, active=31e9, note="Dense."),
    "hf.co/unsloth/gemma-4-12b-it-GGUF:UD-Q4_K_XL": dict(
        name="gemma-4-12b-it", family="Gemma 4", quant="UD-Q4_K_XL", size=None,
        params=12e9, active=12e9, note="Unsloth dynamic quant."),
    "hf.co/ornith-ai/Ornith-1.0-9B-GGUF:Q6_K": dict(
        name="Ornith-1.0-9B", family="Ornith (ornith-ai)", quant="Q6_K", size=None,
        params=9e9, active=9e9, note=""),
    "Ling-3.0-Flash-AD-IQ4_XXS": dict(
        name="Ling-3.0-Flash-AD", family="BailingMoe3 (InclusionAI Ling)", quant="IQ4_XXS", size=None,
        params=None, active=None,
        note="MoE; served via dedicated llama-server systemd unit on port 8081."),
    "Muse-Glimmer:latest": dict(
        name="Muse-Glimmer-30B", family="custom fine-tune", quant="UD-Q4_K_XL", size=19.0,
        params=30e9, active=30e9,
        note="Unsloth dynamic quant. Chat transport required (ATEM template)."),
    "hf.co/unsloth/Qwen3.5-122B-A10B-MTP-GGUF:UD-IQ3_XXS": dict(
        name="Qwen3.5-122B-A10B-MTP", family="Qwen3.5", quant="UD-IQ3_XXS", size=None,
        params=122e9, active=10e9,
        note="MoE with MTP (multi-token prediction) draft layers; weights spill to system RAM."),
    "Step3.7-Flash:latest": dict(
        name="Step3.7-Flash", family="Step 3 (StepFun)", quant=None, size=None,
        params=None, active=None,
        note="Quantization not recorded at run time."),
    "q27bQ4:latest": dict(
        name="q27bQ4", family="Qwen3.8", quant="Q4_K_M", size=18.0,
        params=27e9, active=27e9,
        note="Custom Ollama Modelfile: num_ctx 98304, num_gpu 99. File size from ollama list."),
}

def load_results(path):
    txt = open(path).read().strip()
    if not txt:
        return None
    try:
        return json.loads(txt)
    except json.JSONDecodeError:
        out = []
        for line in txt.splitlines():
            line = line.strip()
            if line:
                try:
                    out.append(json.loads(line))
                except json.JSONDecodeError:
                    pass
        return out

def suite_tests(data):
    """Return (model_key, list_of_test_dicts) for single-model result files."""
    if isinstance(data, dict):
        return data.get("model"), data.get("suite", [])
    if isinstance(data, list):
        model = None
        tests = []
        for item in data:
            if isinstance(item, dict):
                if "model" in item and "suite" in item and isinstance(item["suite"], str):
                    model = item["model"]
                elif "id" in item and ("tps" in item or "response" in item):
                    item.setdefault("dim", "realworld")
                    tests.append(item)
        return model, tests
    return None, []

def classify(median_tps):
    if median_tps is None:
        return "failed"
    if median_tps >= 15: return "excellent"
    if median_tps >= 8: return "good"
    if median_tps >= 3: return "usable"
    if median_tps >= 1: return "marginal"
    return "unusable"

def ttft_bonus(ttft):
    if ttft is None: return 0
    if ttft <= 1: return 50
    if ttft <= 3: return 30
    if ttft <= 10: return 10
    return 0

def ctx_bonus(ctx):
    if not ctx: return 0
    if ctx >= 131072: return 30
    if ctx >= 65536: return 20
    if ctx >= 32768: return 10
    return 0

def build_record(bid, model_key, tests, software, run_date, ctx, protocol,
                 extra_notes="", ttft=None):
    meta = META[model_key]
    tps_vals = [t["tps"] for t in tests if isinstance(t.get("tps"), (int, float))]
    completed = sum(1 for t in tests if t.get("response") is not None)
    attempted = len(tests)
    median = statistics.median(tps_vals) if tps_vals else None
    points = 0
    if median is not None:
        points = round(median * 10 + 50 * (completed / attempted if attempted else 0)
                       + ttft_bonus(ttft) + ctx_bonus(ctx))
    rec = {
        "schema_version": SCHEMA_VERSION,
        "benchmark_id": bid,
        "hardware_ref": "gpu-box-01",
        "protocol": protocol,
        "model": {
            "model_name": meta["name"],
            "model_family": meta["family"],
            "parameter_count": meta["params"],
            "active_parameter_count": meta["active"],
            "quantization": meta["quant"],
            "quantization_format": "GGUF",
            "model_file_size_gb": meta["size"],
        },
        "hardware": dict(HARDWARE_BASE),
        "software": dict(software),
        "configuration": {
            "context_size": ctx,
            "offloading_strategy": "multi-gpu-spill",
        },
        "performance": {
            "generation_tokens_per_second": round(median, 2) if median else None,
            "generation_tps_mean": round(statistics.mean(tps_vals), 2) if tps_vals else None,
            "generation_tps_max": round(max(tps_vals), 2) if tps_vals else None,
            "time_to_first_token_seconds": ttft,
            "total_generated_tokens": sum(t.get("tokens", 0) for t in tests) or None,
            "total_runtime_seconds": round(sum(t.get("elapsed_s", 0) for t in tests), 1) or None,
        },
        "tests": {"attempted": attempted, "completed": completed},
        "ps_points": points,
        "result_classification": classify(median),
        "reproducibility": {
            "timestamp": run_date,
            "operator": "peasant-smith",
            "notes": (f"{meta['note']} "
                      f"{extra_notes}").strip(),
        },
    }
    return rec, median

def main():
    os.makedirs(RAW, exist_ok=True)
    written, csv_rows = [], []

    def emit(rec, median):
        path = os.path.join(RAW, f"{rec['benchmark_id']}.json")
        with open(path, "w") as f:
            json.dump(rec, f, indent=2)
        written.append(path)
        perf = rec["performance"]
        csv_rows.append({
            "benchmark_id": rec["benchmark_id"],
            "model_name": rec["model"]["model_name"],
            "model_family": rec["model"]["model_family"],
            "quantization": rec["model"]["quantization"] or "unknown",
            "gpu_name": "NVIDIA GeForce RTX 3060",
            "gpu_count": 2,
            "gpu_vram_gb": 24,
            "inference_backend": rec["software"]["inference_backend"],
            "context_size": rec["configuration"]["context_size"] or "",
            "generation_tps_median": perf["generation_tokens_per_second"] or "",
            "generation_tps_max": perf["generation_tps_max"] or "",
            "tests_completed": f"{rec['tests']['completed']}/{rec['tests']['attempted']}",
            "total_runtime_seconds": perf["total_runtime_seconds"] or "",
            "result_classification": rec["result_classification"],
            "ps_points": rec["ps_points"],
            "run_date": rec["reproducibility"]["timestamp"][:10],
            "example": "false",
        })

    def mtime_date(path):
        return datetime.fromtimestamp(os.path.getmtime(path), tz=timezone.utc)\
                       .strftime("%Y-%m-%dT%H:%M:%SZ")

    # --- single-model suite files -------------------------------------------
    single = {
        "results_qwen35_hermes.jsonl": ("PS-0001", None, ""),
        "results_opt_qwen35hermes.jsonl": ("PS-0002", None, "Optimized sampling params (temp 0.5, top_p 0.85, top_k 40, min_p 0.05)."),
        "results_laguna_s21.jsonl": ("PS-0003", None, ""),
        "results_opt_laguna.jsonl": ("PS-0004", None, "Optimized sampling params."),
        "results_laguna_iq4xs.jsonl": ("PS-0005", "Laguna-S-2.1-IQ4XS", "IQ4_XS merged-shard build."),
        "results_lfm25_26b.jsonl": ("PS-0006", None, ""),
        "results_opt_lfm.jsonl": ("PS-0007", None, "Optimized sampling params (temp 0.1)."),
        "results_qwen27b.jsonl": ("PS-0008", None, ""),
        "results_opt_qwen27b.jsonl": ("PS-0009", None, "Optimized sampling params."),
        "results_g26_opt.jsonl": ("PS-0010", None, "Optimized sampling params."),
        "results_g31_rec.jsonl": ("PS-0011", None, "ctx 65536. Companion optimized run aborted (empty output file) - see docs/tests.md failure modes."),
        "results_gemma4_12b.jsonl": ("PS-0012", None, ""),
        "results_opt_gemma4.jsonl": ("PS-0013", None, "Optimized sampling params."),
        "results_ornith_9b.jsonl": ("PS-0014", None, ""),
        "results_opt_ornith.jsonl": ("PS-0015", None, "Optimized sampling params."),
        "results_ling.jsonl": ("PS-0016", None, "Dedicated llama-server, tensor-split 5,1, flash attention on."),
        "results_ling_realworld.jsonl": ("PS-0017", "Ling-3.0-Flash-AD-IQ4_XXS", "Real-world code tasks variant."),
        "results_muse_glimmer.jsonl": ("PS-0018", None, "Chat transport (ATEM template requirement)."),
        "results_mtp_card.jsonl": ("PS-0019", None, "MTP draft layers enabled."),
        "results_mtp_opt.jsonl": ("PS-0020", None, "MTP with tuned draft parameters."),
        "results_step37_flash.jsonl": ("PS-0021", None, ""),
        "results_opt_step37.jsonl": ("PS-0022", None, "Optimized sampling params."),
    }
    for fname, (bid, forced_key, notes) in single.items():
        path = os.path.join(SRC, fname)
        data = load_results(path)
        if data is None:
            print(f"SKIP {fname}: empty")
            continue
        model_key, tests = suite_tests(data)
        model_key = forced_key or model_key
        tests = [t for t in tests if isinstance(t, dict) and "id" in t]
        if not tests or not model_key:
            print(f"SKIP {fname}: no suite tests found")
            continue
        ctx = 65536 if "g31" in fname or "ling" in fname else None
        software = SOFTWARE_LLAMACPP if "ling" in fname else SOFTWARE_OLLAMA
        rec, median = build_record(bid, model_key, tests, software,
                                   mtime_date(path), ctx, "reasoning-v1", notes)
        emit(rec, median)

    # --- fleet run (each model tested in one session) ----------------------
    fleet = load_results(os.path.join(SRC, "fleet_results.jsonl"))
    if isinstance(fleet, dict):
        for i, (model_key, obj) in enumerate(fleet.items()):
            tests = [t for t in obj.get("suite", [])
                     if isinstance(t, dict) and "dim" in t and "id" in t]
            if not tests or model_key not in META:
                continue
            bid = f"PS-00{23 + i}"
            rec, median = build_record(
                bid, model_key, tests, SOFTWARE_OLLAMA,
                mtime_date(os.path.join(SRC, "fleet_results.jsonl")), None,
                "reasoning-v1", "Fleet session: all models benchmarked sequentially in one run.")
            emit(rec, median)

    # --- q27bQ4 context sweep ------------------------------------------------
    sweep = json.load(open(os.path.join(SRC, "ctx_sweep_results.json")))
    tps = [r["wall_tps"] for r in sweep]
    max_ctx = max(r["ctx"] for r in sweep)
    rec, _ = build_record(
        "PS-0030", "q27bQ4:latest",
        [{"dim": "context-sweep", "id": f"ctx-{r['ctx']}", "tps": r["wall_tps"],
          "tokens": r["tokens"], "elapsed_s": r["wall_s"], "response": "ok"} for r in sweep],
        SOFTWARE_OLLAMA, mtime_date(os.path.join(SRC, "ctx_sweep_results.json")),
        max_ctx, "context-sweep",
        f"Generation speed held {min(tps):.1f}-{max(tps):.1f} t/s from 8k to {max_ctx//1024}k context: "
        "flat scaling, no degradation at long context.")
    emit(rec, statistics.median(tps))

    # --- q27bQ4 KV retention -------------------------------------------------
    kv = json.load(open(os.path.join(SRC, "kv_retention_results.json")))
    rec, _ = build_record(
        "PS-0031", "q27bQ4:latest",
        [{"dim": "kv-retention", "id": f"needle-{r['target_tokens']}", "tps": r["tps"],
          "tokens": r["tokens_evaluated"], "elapsed_s": r["wall_s"],
          "response": r["answer"]} for r in kv],
        SOFTWARE_OLLAMA, mtime_date(os.path.join(SRC, "kv_retention_results.json")),
        131072, "kv-retention",
        "Needle retrieval at 60k and 120k tokens: both OK. Perfect recall at 120k context.")
    emit(rec, statistics.median([r["tps"] for r in kv]))

    # --- CSV -----------------------------------------------------------------
    csv_path = os.path.join(REPO, "data", "benchmarks.csv")
    # keep example rows — read from git HEAD (robust if the working file was
    # already rewritten by a previous partial run)
    import subprocess
    examples = []
    try:
        orig = subprocess.run(["git", "-C", REPO, "show", "HEAD:data/benchmarks.csv"],
                              capture_output=True, text=True, check=True).stdout
        for row in csv.DictReader(orig.splitlines()):
            if row.get("example") == "true":
                examples.append(row)
    except Exception:
        pass
    fieldnames = ["benchmark_id", "model_name", "model_family", "quantization",
                  "gpu_name", "gpu_count", "gpu_vram_gb", "inference_backend",
                  "context_size", "generation_tps_median", "generation_tps_max",
                  "tests_completed", "total_runtime_seconds", "result_classification",
                  "ps_points", "run_date", "example"]
    fixed_examples = []
    for row in examples:
        row = {k: row.get(k, "") for k in fieldnames}
        fixed_examples.append(row)
    examples = fixed_examples
    with open(csv_path, "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=fieldnames)
        w.writeheader()
        w.writerows(csv_rows)
        w.writerows(examples)

    print(f"wrote {len(written)} raw records -> {RAW}")
    print(f"csv rows: {len(csv_rows)} real + {len(examples)} examples")

if __name__ == "__main__":
    main()
