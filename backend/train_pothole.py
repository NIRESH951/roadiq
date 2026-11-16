# RoadIQ: train ONE model for crack (0) + pothole (1). Run: python train_pothole.py
# Keeps the old model as models/roadiq-crack-only.pt; writes real validation scores to models/roadiq.metrics.json
import json
import os
import random
import shutil
import urllib.request
import zipfile
from pathlib import Path

POTHOLE_URL = "https://github.com/jaygala24/pothole-detection/releases/download/v1.0.0/Pothole.Dataset.IVCNZ.zip"
EPOCHS = int(os.getenv("EPOCHS", "12"))
FRACTION = float(os.getenv("FRACTION", "1.0"))  # share of training photos used per epoch (1.0 = all)
IMGSZ = 416


def build_pothole_split(root: Path) -> Path:
    pot = root / "pothole"
    if (pot / "images" / "val").is_dir() and any((pot / "labels" / "val").glob("*.txt")):
        return pot
    zip_path = root / "pothole.zip"
    if not zip_path.is_file() or zip_path.stat().st_size < 100_000_000:
        print("Downloading pothole photos (about 175 MB)...")
        urllib.request.urlretrieve(POTHOLE_URL, zip_path)
    raw = root / "pothole_raw"
    shutil.rmtree(raw, ignore_errors=True)
    with zipfile.ZipFile(zip_path) as z:
        z.extractall(raw)
    images = sorted(raw.rglob("*.jpg"))
    random.Random(0).shuffle(images)
    n_val = max(1, len(images) // 10)  # 10% held out for honest validation
    shutil.rmtree(pot, ignore_errors=True)
    for i, img in enumerate(images):
        split = "val" if i < n_val else "train"
        (pot / "images" / split).mkdir(parents=True, exist_ok=True)
        (pot / "labels" / split).mkdir(parents=True, exist_ok=True)
        shutil.copy2(img, pot / "images" / split / img.name)
        rows = []
        label = img.with_suffix(".txt")
        if label.is_file():
            for line in label.read_text().splitlines():
                parts = line.split()
                if len(parts) == 5:
                    rows.append(" ".join(["1"] + parts[1:]))  # class 1 = pothole
        (pot / "labels" / split / f"{img.stem}.txt").write_text("\n".join(rows) + ("\n" if rows else ""))
    shutil.rmtree(raw, ignore_errors=True)
    print(f"Pothole photos ready: {len(images) - n_val} train, {n_val} val")
    return pot


def main() -> None:
    from ultralytics import YOLO
    from ultralytics.data.utils import check_det_dataset
    from ultralytics.utils import SETTINGS

    here = Path(__file__).resolve().parent
    root = Path(SETTINGS["datasets_dir"])
    root.mkdir(parents=True, exist_ok=True)

    crack = check_det_dataset("crack-seg.yaml")
    print("Crack photos:", crack["train"])
    pot = build_pothole_split(root)

    data = here / "roadiq-damage.yaml"
    data.write_text(
        "train: " + json.dumps([str(crack["train"]), (pot / "images" / "train").as_posix()]) + "\n"
        "val: " + json.dumps([str(crack["val"]), (pot / "images" / "val").as_posix()]) + "\n"
        "names:\n  0: crack\n  1: pothole\n",
        encoding="utf-8",
    )

    model = YOLO("yolo11n.pt")
    model.train(data=str(data), epochs=EPOCHS, imgsz=IMGSZ, batch=16, device="cpu", fraction=FRACTION,
                project=str(here / "runs" / "detect"), name="roadiq-damage", exist_ok=True, plots=False)
    best = Path(model.trainer.best)

    models = here / "models"
    models.mkdir(exist_ok=True)
    target = models / "roadiq.pt"
    backup = models / "roadiq-crack-only.pt"
    if target.is_file() and not backup.is_file():
        shutil.copy2(target, backup)
    shutil.copy2(best, target)

    final = YOLO(str(target))
    m = final.val(data=str(data), imgsz=IMGSZ, batch=16, device="cpu", plots=False)
    per_class = {final.names[int(c)]: round(float(ap), 3) for c, ap in zip(m.box.ap_class_index, m.box.ap50)}
    metrics = {
        "task": "detect",
        "classes": ["crack", "pothole"],
        "datasets": "Ultralytics crack-seg + Pothole Dataset (Gala et al., IVCNZ 2020)",
        "epochs": EPOCHS,
        "imgsz": IMGSZ,
        "split": "held-out validation images (crack-seg val + 10% of pothole photos)",
        "box_map50": round(float(m.box.map50), 3),
        "box_map50_95": round(float(m.box.map), 3),
        "precision": round(float(m.box.mp), 3),
        "recall": round(float(m.box.mr), 3),
        "map50_per_class": per_class,
    }
    (models / "roadiq.metrics.json").write_text(json.dumps(metrics, indent=2), encoding="utf-8")
    final.export(format="onnx", imgsz=IMGSZ)
    print("\nDONE. New model: models\\roadiq.pt (+ roadiq.onnx)")
    print(json.dumps(metrics, indent=2))
    print("Now restart the RoadIQ server (Ctrl+C, then the uvicorn command again).")


if __name__ == "__main__":
    main()
