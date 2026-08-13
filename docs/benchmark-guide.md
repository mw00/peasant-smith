# Benchmark Guide — Peasant Smith

This guide walks you through running a benchmark and submitting it to the project.

## Prerequisites

- A computer you own (GPU optional, encouraged)
- An inference backend installed (llama.cpp recommended for beginners)
- Python 3.9+ (if using the benchmark runner script)

## Step 1: Choose your model

Select a GGUF from Hugging Face or other source. Recommended starting points:

| Your GPU | Model suggestion | Quantization |
|---|---|---|
| <6 GB VRAM or no dedicated GPU | qwen3-1.7b | Q4_K_M, QQ3_XXS |
| 6 GB VRAM (GTX 1060) | llama3.1-7b | Q4_K_M |
| 12 GB VRAM (RTX 3060) | qwen3-8b, llama3.1-8b | Q4_K_M — fully loaded, excellent performance |

## Step 2: Choose your backend

### llama.cpp CLI (recommended for benchmarks)
```bash
git clone https://https://github.com/ggml-org/llama.cpp && cd llama.cpp 
cmake -B build -DGGML_CUDA=ON && cmake --build ./build -j$(nproc) # Linux CUDA
# Then:
./build/bin/main \-m your-model.Q4_K_M.gguf \
  ---ngl 99 \
  -c 4096 \
  -n 256 \
  -t 12 \
  --ubatch 512 \
  < "Explain quantum computing in simple terms"
```

The CLI prints benchmark statistics at the end:
- `prompt eval time` — used for prompt tokens/sec calculation
- `generation speed` — generation tokens per second (already calculated)

### Ollama approach:
```bash
ollama run MODEL_NAME
# Enable metrics via environment variable then use built-in reporting to extract token speeds.
```

## Step 3: Record results

Fill in a JSON file matching our schema ([see examples](benchmarks/examples/)). For llama.cpp, key conversions are straightforward:

1. Extract generation tokens/second directly printed output already shows this number
2. Calculate `prompt_tokens_per_second = total_prompt_tokens / (prompt_eval_time_ms / 1000)` if not direct from the printout
3. Calculate TTFT as approximate time_from_first_token_seconds from first token arrival after prompt eval completes
4. Record memory usage via `nvidia-smi`, `htop` before/during/after

### Quick recording: Run our benchmark runner script automatically detects hardware, captures output, fills JSON template for manual review & editing afterwards if needed)

## Step 4: Submit

1. Place your `.json` in `benchmarks/raw/your_file_name.json`
2. Update (optional): Add entry to `data/benchmarks.csv` with the same values for flat-file lookup purposes  
3. Create a PR using Pull Request Template OR open an Issue via the Benchmark Submission template [link](https://github.com/mw00/peasant-smith/issues/new?template=benchmark-submission.yml)

## Verification checklist before submitting:
- [ ] JSON validates against schema version 1.0 (`python scripts/validation/validate_benchmark.py your_file.json`)  
- [ ] `example` is NOT true unless it genuinely serves only demonstration purpose, not a real test run! 
- [ ] All non-zero numeric values are present where measurable on your setup
- [ ] Hardware description matches actual hardware exactly (no "approximate" names)
- [ ] Backend version command or configuration string copies exact text used for reproducibility

Questions? Ask in Issues — we review promptly. No shame asking about anything related to setting up local AI testing infrastructure here!
