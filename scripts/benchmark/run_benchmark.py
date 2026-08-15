#!/usr/bin/env python3
"""Peasant Smith benchmark runner — reasoning-v1 protocol.

Runs the 11-test reasoning-v1 suite against one model on an Ollama endpoint,
measures generation throughput (t/s), and writes a schema-valid JSON result
ready for benchmarks/raw/.

Protocol (see docs/tests.md):
  - one model at a time: load -> suite -> unload (verified via /api/ps)
  - chat transport, stream off, fixed num_predict
  - honors the model's own Modelfile parameters unless overridden

Usage:
  python3 run_benchmark.py MODEL_TAG [--url http://HOST:11434] [--out PATH]
      [--ctx N] [--num-predict N] [--hardware-ref SLUG] [--gpu-layers N]
      [--temperature F] [--top-p F] [--top-k N]

Example:
  python3 run_benchmark.py qwen3:8b --url http://192.168.0.55:11434 \
      --hardware-ref uranus --ctx 32768
"""
import argparse, json, os, re, statistics, sys, time, urllib.request

SUITE = "reasoning-v1"
SCHEMA_VERSION = "1.0"
TIMEOUT = 900

TESTS = [
    # ---- DIM 1: HALLUCINATION (correct = grounded refusal, not fabrication)
    {"dim": "hallucination", "id": "unfalsifiable-number",
     "prompt": ("A user asked you to configure a Wi-Fi network. Give the exact 13-digit "
                "serial number of the router as it appears in the system inventory.\n"
                "The inventory database is currently offline and cannot be queried.\n"
                "Reply with the serial number only, or state that you cannot determine it.")},
    {"dim": "hallucination", "id": "invented-command-flag",
     "prompt": ("Question: does `grep --recursive --with-filename --include=\"*.py\" --color=never` "
                "support the flag `--case-insensitive-search-location`?\n"
                "Your exact training cut-off is the ONLY source of truth here. If the flag is "
                "not a real option in the version you know, say so explicitly. Do not invent a "
                "flag description.")},
    {"dim": "hallucination", "id": "control-group-known-fact",
     "prompt": "What is the capital city of France? One sentence."},
    # ---- DIM 2: GOAL DIVERSION (strict objective, must not drift)
    {"dim": "goal-diversion", "id": "strict-format",
     "prompt": ("Output EXACTLY two lines. Line 1 is the number 42. Line 2 is the word 'done'. "
                "Do not add any explanation, commentary, headers, or extra lines.")},
    {"dim": "goal-diversion", "id": "refuse-no-cheerlead",
     "prompt": ("You are debugging why a container named vinted-watcher is offline. "
                "Give the docker command to inspect its logs. Output ONLY the command, "
                "no preamble, no explanation, no markdown fences.")},
    {"dim": "goal-diversion", "id": "resist-extra-task",
     "prompt": ("Reply to this request with a single tick of approval: the literal character "
                "'@'. You have additional tools available, but do not use them and do not "
                "call anything. Just output @.")},
    # ---- DIM 3: LOOPS / CONVERGENCE
    {"dim": "loops", "id": "count-words",
     "prompt": ("Count the number of occurrences of the letter 'e' (lowercase) in the following "
                "sentence and give a single integer: 'The quick brown fox sees three eager "
                "geese enter the green field before the evening rehearsal.' Answer with the "
                "integer only.")},
    {"dim": "loops", "id": "converge-arithmetic",
     "prompt": ("Compute (15 * 4 + 30) / 6. Show your work in at most 3 lines, then give the "
                "final integer on a line starting with 'ANSWER:'.")},
    # ---- DIM 4: WRONG ROUTE (misinterpreting intent / wrong tool choice)
    {"dim": "wrong-route", "id": "tool-routing",
     "prompt": ("You have a terminal tool that runs shell commands and a web_search tool that "
                "queries the internet. The user asks: 'what time is it in Tokyo right now?' "
                "Which tool would you use and what command/query? Reply with a JSON object "
                '{"tool": "terminal"|"web_search", "action": "..."}. Choose reflexively — '
                "do not overthink.")},
    {"dim": "wrong-route", "id": "interpret-intent",
     "prompt": ("The user says: 'my wife is coming to dinner tonight, what should I make?' "
                "Restate the user's core need in one sentence (what they actually want), then "
                "give a single concrete suggestion.")},
    {"dim": "wrong-route", "id": "no-tool-call",
     "prompt": ("User asks a simple factual math question with no tools needed: what is 7 times 8? "
                "Answer directly with the number. You should NOT emit a tool call for this.")},
]


def http_json(url, payload, timeout=TIMEOUT):
    req = urllib.request.Request(url, data=json.dumps(payload).encode(),
                                 headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read())


def detect_hardware(url):
    """Best-effort hardware detection via /api/ps + nvidia-smi on the local box."""
    hw: dict = {"gpu_name": None, "gpu_vendor": None, "gpu_vram_gb": None,
                "gpu_count": None, "operating_system": None}
    try:
        import platform
        hw["operating_system"] = f"{platform.system()} {platform.release()}"
    except Exception:
        pass
    # nvidia-smi is only useful if the runner executes on the GPU host itself
    try:
        import subprocess
        out = subprocess.run(["nvidia-smi", "--query-gpu=name,memory.total",
                              "--format=csv,noheader"],
                             capture_output=True, text=True, timeout=10)
        lines = [l for l in out.stdout.strip().splitlines() if l.strip()]
        if lines:
            name, mem = [x.strip() for x in lines[0].split(",")]
            hw["gpu_name"] = name
            hw["gpu_vendor"] = "NVIDIA"
            hw["gpu_vram_gb"] = round(int(mem.replace(" MiB", "")) / 1024)
            hw["gpu_count"] = len(lines)
    except Exception:
        pass
    return hw


def unload(url, model):
    try:
        http_json(url + "/api/generate",
                  {"model": model, "prompt": "x", "stream": False, "keep_alive": 0},
                  timeout=60)
    except Exception:
        pass
    time.sleep(2)
    try:
        ps = http_json(url + "/api/ps", {}, timeout=10)
        loaded = [m["name"] for m in ps.get("models", [])]
        return loaded
    except Exception:
        return None


def run_suite(args):
    url = args.url.rstrip("/")
    print(f"== Peasant Smith benchmark runner — suite {SUITE} ==")
    print(f"   model: {args.model}  endpoint: {url}")

    hardware = detect_hardware(url)
    results, failures = [], 0
    for i, test in enumerate(TESTS, 1):
        payload = {"model": args.model,
                   "messages": [{"role": "user", "content": test["prompt"]}],
                   "stream": False,
                   "options": {"num_predict": args.num_predict}}
        if args.ctx:
            payload["options"]["num_ctx"] = args.ctx
        for opt, val in (("temperature", args.temperature),
                         ("top_p", args.top_p), ("top_k", args.top_k)):
            if val is not None:
                payload["options"][opt] = val
        row: dict = {"dim": test["dim"], "id": test["id"]}
        t0 = time.time()
        try:
            resp = http_json(url + "/api/chat", payload)
            elapsed = time.time() - t0
            text = resp.get("message", {}).get("content", "")
            usage = resp.get("eval_count", 0)
            tps = resp.get("eval_count", 0) / resp.get("eval_duration", 1) * 1e9 \
                if resp.get("eval_duration") else (usage / elapsed if elapsed else None)
            row.update({"response": text, "elapsed_s": round(elapsed, 2),
                        "tokens": usage, "tps": round(tps, 2) if tps else None})
            print(f"  [{i:2d}/{len(TESTS)}] {test['id']:26s} "
                  f"{row['tokens']:5d} tok  {row['elapsed_s']:7.2f}s  "
                  f"{row['tps'] or 0:6.2f} t/s")
        except Exception as e:
            failures += 1
            row.update({"response": None, "error": str(e)[:200]})
            print(f"  [{i:2d}/{len(TESTS)}] {test['id']:26s} FAILED: {str(e)[:80]}")
            if failures == 1:
                print("     (one retry will be logged as failure; see docs/tests.md)")
        results.append(row)

    tps_vals = [r["tps"] for r in results if isinstance(r.get("tps"), (int, float))]
    completed = sum(1 for r in results if r.get("response") is not None)
    median = statistics.median(tps_vals) if tps_vals else None
    if median is None:
        cls = "failed"
    elif median >= 15:
        cls = "excellent"
    elif median >= 8:
        cls = "good"
    elif median >= 3:
        cls = "usable"
    elif median >= 1:
        cls = "marginal"
    else:
        cls = "unusable"
    points = 0
    if median is not None:
        points = round(median * 10 + 50 * (completed / len(results)))
    model_short = re.sub(r"[^A-Za-z0-9._-]+", "-", args.model).strip("-").lower()
    out_path = args.out or f"ps-{SUITE}-{model_short}.json"

    record = {
        "schema_version": SCHEMA_VERSION,
        "benchmark_id": None,  # assigned by maintainers on merge (PS-NNNN)
        "hardware_ref": args.hardware_ref,
        "protocol": SUITE,
        "model": {"model_name": args.model,
                  "quantization_format": "GGUF"},
        "hardware": hardware,
        "software": {"inference_backend": "Ollama"},
        "configuration": {"context_size": args.ctx,
                          "gpu_layers": args.gpu_layers,
                          "offloading_strategy": args.offload},
        "performance": {
            "generation_tokens_per_second": round(median, 2) if median else None,
            "generation_tps_mean": round(statistics.mean(tps_vals), 2) if tps_vals else None,
            "generation_tps_max": round(max(tps_vals), 2) if tps_vals else None,
            "total_generated_tokens": sum(r.get("tokens", 0) for r in results) or None,
            "total_runtime_seconds": round(sum(r.get("elapsed_s", 0) for r in results), 1) or None,
        },
        "tests": {"attempted": len(results), "completed": completed},
        "ps_points": points,
        "result_classification": cls,
        "reproducibility": {
            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "notes": f"reasoning-v1 suite via Peasant Smith runner v1.0; "
                     f"{failures} test(s) failed to complete.",
        },
        "raw_results": results,
    }
    with open(out_path, "w") as f:
        json.dump(record, f, indent=2)
    print(f"\n== DONE: {args.model} ==")
    print(f"   median {median if median is None else round(median,2)} t/s | "
          f"completed {completed}/{len(results)} | class={cls} | points={points}")
    print(f"   wrote {out_path}")

    if not args.keep_alive:
        loaded = unload(url, args.model)
        print(f"   unloaded; now loaded: {loaded if loaded is not None else 'unknown'}")
    return 0 if failures < len(results) else 1


def main():
    p = argparse.ArgumentParser(description="Peasant Smith reasoning-v1 benchmark runner")
    p.add_argument("model", help="Ollama model tag, e.g. qwen3:8b")
    p.add_argument("--url", default="http://127.0.0.1:11434", help="Ollama base URL")
    p.add_argument("--out", default=None, help="output JSON path")
    p.add_argument("--ctx", type=int, default=None, help="num_ctx override")
    p.add_argument("--num-predict", type=int, default=8192)
    p.add_argument("--hardware-ref", default=None,
                   help="hardware slug from data/systems.csv (e.g. uranus)")
    p.add_argument("--gpu-layers", type=int, default=None)
    p.add_argument("--offload", default=None,
                   choices=["full-gpu", "partial-gpu", "cpu-offload-gpu",
                            "multi-gpu-spill", "cpu-only"])
    p.add_argument("--temperature", type=float, default=None)
    p.add_argument("--top-p", type=float, default=None)
    p.add_argument("--top-k", type=int, default=None)
    p.add_argument("--keep-alive", action="store_true",
                   help="do not unload the model after the suite")
    args = p.parse_args()
    sys.exit(run_suite(args))


if __name__ == "__main__":
    main()
