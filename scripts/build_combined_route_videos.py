#!/usr/bin/env python3
import argparse
import csv
import json
import math
import shutil
import subprocess
import tempfile
from fractions import Fraction
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
VIDEOS_DIR = ROOT / "dist" / "videos"
DEFAULT_ROUTES_FILE = VIDEOS_DIR / "routes.txt"
OUTPUT_DIR = VIDEOS_DIR / "combined"
MANIFEST_PATH = VIDEOS_DIR / "combined-manifest.json"


def run(cmd):
    subprocess.run(cmd, check=True)


def ffprobe_json(path: Path):
    result = subprocess.run(
        [
            "ffprobe",
            "-v",
            "error",
            "-print_format",
            "json",
            "-show_streams",
            "-show_format",
            str(path),
        ],
        check=True,
        capture_output=True,
        text=True,
    )
    return json.loads(result.stdout)


def ceil_even(value: int) -> int:
    return value if value % 2 == 0 else value + 1


def fps_to_float(value: str) -> float:
    if not value or value == "0/0":
        return 0.0
    return float(Fraction(value))


def load_route_names(args_routes):
    if args_routes:
        return [route.replace(".csv", "") for route in args_routes]

    routes = []
    for line in DEFAULT_ROUTES_FILE.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        routes.append(line.replace(".csv", ""))
    return routes


def load_segments(csv_name: str):
    csv_path = VIDEOS_DIR / f"{csv_name}.csv"
    segments = []
    with csv_path.open(newline="") as handle:
        reader = csv.reader(handle)
        for row in reader:
            if not row:
                continue
            file_name = row[0].strip()
            if not file_name or file_name.startswith("#"):
                continue
            multiplier = 1.0
            if len(row) > 1:
                try:
                    multiplier = float(row[1].strip())
                except ValueError:
                    multiplier = 1.0
            segments.append(
                {
                    "file": file_name,
                    "path": VIDEOS_DIR / file_name,
                    "multiplier": multiplier,
                }
            )
    return segments


def analyze_segments(segments):
    max_width = 0
    max_height = 0
    max_fps = 0.0

    for segment in segments:
        info = ffprobe_json(segment["path"])
        video_stream = next(stream for stream in info["streams"] if stream.get("codec_type") == "video")
        duration = float(info["format"]["duration"])
        segment["duration"] = duration
        segment["codec_name"] = video_stream.get("codec_name")
        segment["width"] = int(video_stream["width"])
        segment["height"] = int(video_stream["height"])
        segment["fps"] = fps_to_float(video_stream.get("avg_frame_rate") or video_stream.get("r_frame_rate") or "0/0")
        max_width = max(max_width, segment["width"])
        max_height = max(max_height, segment["height"])
        max_fps = max(max_fps, segment["fps"])

    return {
        "width": ceil_even(max_width),
        "height": ceil_even(max_height),
        "fps": max(1, int(math.ceil(max_fps))),
    }


def normalize_segment(input_path: Path, output_path: Path, width: int, height: int, fps: int):
    vf = (
        f"fps={fps},"
        f"scale={width}:{height}:force_original_aspect_ratio=decrease,"
        f"pad={width}:{height}:(ow-iw)/2:(oh-ih)/2:color=black,"
        "format=yuv420p"
    )
    run(
        [
            "ffmpeg",
            "-y",
            "-v",
            "error",
            "-i",
            str(input_path),
            "-an",
            "-vf",
            vf,
            "-c:v",
            "libx264",
            "-preset",
            "veryfast",
            "-crf",
            "18",
            "-movflags",
            "+faststart",
            str(output_path),
        ]
    )


def concat_segments(list_path: Path, output_path: Path):
    run(
        [
            "ffmpeg",
            "-y",
            "-v",
            "error",
            "-f",
            "concat",
            "-safe",
            "0",
            "-i",
            str(list_path),
            "-c",
            "copy",
            "-movflags",
            "+faststart",
            str(output_path),
        ]
    )


def build_route(csv_name: str):
    segments = load_segments(csv_name)
    if not segments:
        raise RuntimeError(f"No segments found in {csv_name}.csv")

    profile = analyze_segments(segments)
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    output_path = OUTPUT_DIR / f"{csv_name.replace(' ', '_')}.mp4"

    with tempfile.TemporaryDirectory(prefix=f"auuki_{csv_name.replace(' ', '_')}_") as temp_dir_name:
        temp_dir = Path(temp_dir_name)
        concat_list = temp_dir / "concat.txt"
        normalized_paths = []

        for index, segment in enumerate(segments):
            normalized_path = temp_dir / f"{index:04d}.mp4"
            normalize_segment(
                segment["path"],
                normalized_path,
                profile["width"],
                profile["height"],
                profile["fps"],
            )
            normalized_paths.append(normalized_path)

        concat_list.write_text(
            "".join(f"file '{path.as_posix()}'\n" for path in normalized_paths)
        )
        concat_segments(concat_list, output_path)

    return {
        "src": f"combined/{output_path.name}",
        "width": profile["width"],
        "height": profile["height"],
        "fps": profile["fps"],
        "segments": [
            {
                "src": segment["file"],
                "multiplier": segment["multiplier"],
                "duration": segment["duration"],
            }
            for segment in segments
        ],
    }


def main():
    parser = argparse.ArgumentParser(description="Build combined route MP4s from route CSV manifests.")
    parser.add_argument("routes", nargs="*", help="Route CSV base names. Defaults to routes.txt entries.")
    parser.add_argument("--clean", action="store_true", help="Delete existing combined outputs before rebuilding.")
    args = parser.parse_args()

    if args.clean and OUTPUT_DIR.exists():
        shutil.rmtree(OUTPUT_DIR)
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    manifest = {}
    for route_name in load_route_names(args.routes):
        manifest[route_name] = build_route(route_name)

    MANIFEST_PATH.write_text(json.dumps(manifest, indent=2) + "\n")
    print(f"Wrote {MANIFEST_PATH}")


if __name__ == "__main__":
    main()
