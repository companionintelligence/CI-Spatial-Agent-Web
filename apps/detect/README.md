# Detection sidecar (Grounding DINO)

Open-vocabulary object detection for the companion's perception layer, absorbed
from `CI-Spatial-Agent-Web-2`.

**Optional.** Nothing in the shipping app requires it; without it the companion
simply has no `detect_objects` tool and its spatial memory stays empty. It is
kept as a sidecar rather than folded into the BFF because it is a Python/PyTorch
service with GPU weights — a very different deployment shape from a Hono proxy,
and one most installs will not want.

## Run

```bash
python -m venv .venv && . .venv/bin/activate
pip install -r requirements.txt
python download_weights.py
python start_server.py
```

## Contract

`POST /detect` with a JPEG frame and a prompt; returns labelled boxes with
confidences. The client half lives in `@ci-avatar/agent` (`SpatialMemory`) and
the tool definitions in `ToolRegistry`.
