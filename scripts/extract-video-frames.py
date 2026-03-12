#!/usr/bin/env python3
"""
Extrai frames de um vídeo, filtrando duplicados e frames borrados.
Salva apenas frames com conteúdo novo em pasta na Downloads.
"""
import os
import sys
from pathlib import Path

try:
    import cv2
    import numpy as np
except ImportError:
    print("Instale as dependências: pip install opencv-python numpy")
    sys.exit(1)


def is_blurry(frame: np.ndarray, threshold: float = 100.0) -> bool:
    """Retorna True se o frame estiver borrado (Laplacian variance baixa)."""
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    laplacian_var = cv2.Laplacian(gray, cv2.CV_64F).var()
    return laplacian_var < threshold


def frames_similar(frame1: np.ndarray, frame2: np.ndarray, max_diff: float = 8.0) -> bool:
    """Retorna True se os frames forem muito similares (diferença média de pixels < max_diff)."""
    small1 = cv2.resize(frame1, (64, 64))
    small2 = cv2.resize(frame2, (64, 64))
    diff = cv2.absdiff(small1, small2)
    mean_diff = np.mean(diff)
    return mean_diff < max_diff


def extract_unique_frames(
    video_path: str,
    output_dir: str,
    blur_threshold: float = 50.0,
    interval_sec: float = 0.8,
    skip_similar: bool = True,
    min_pixel_diff: float = 6.0,
) -> list[str]:
    """
    Extrai frames do vídeo a cada interval_sec segundos.
    - Ignora frames borrados (tenta o próximo)
    - Opcionalmente ignora frames muito similares ao anterior
    """
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        raise ValueError(f"Não foi possível abrir o vídeo: {video_path}")

    fps = cap.get(cv2.CAP_PROP_FPS) or 30
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    duration_sec = total_frames / fps if fps > 0 else 0
    frame_interval = max(1, int(fps * interval_sec))
    print(f"  Vídeo: {duration_sec:.1f}s, {total_frames} frames, {fps:.0f} fps")

    os.makedirs(output_dir, exist_ok=True)

    saved_paths: list[str] = []
    last_saved_frame: np.ndarray | None = None
    frame_count = 0
    saved_count = 0
    next_capture = 0

    while True:
        ret, frame = cap.read()
        if not ret:
            break

        frame_count += 1

        # Só considera frames no intervalo desejado
        if frame_count < next_capture:
            continue

        # Ignora frame borrado (threshold baixo = mais permissivo)
        if blur_threshold > 0 and is_blurry(frame, blur_threshold):
            next_capture = frame_count + max(1, int(fps * 0.2))  # Tenta de novo em 0.2s
            continue

        # Verifica similaridade (evita duplicados)
        if skip_similar and last_saved_frame is not None:
            if frames_similar(frame, last_saved_frame, min_pixel_diff):
                next_capture = frame_count + frame_interval
                continue

        # Salva o frame
        saved_count += 1
        next_capture = frame_count + frame_interval
        name = f"frame_{saved_count:03d}.png"
        out_path = os.path.join(output_dir, name)
        cv2.imwrite(out_path, frame)
        saved_paths.append(out_path)
        last_saved_frame = frame.copy()

    cap.release()
    return saved_paths


def main():
    video_path = r"C:\Users\Felipe\Downloads\WhatsApp Video 2026-03-11 at 14.53.55.mp4"
    output_dir = r"C:\Users\Felipe\Downloads\frames_whatsapp_video"

    if not os.path.isfile(video_path):
        print(f"Vídeo não encontrado: {video_path}")
        sys.exit(1)

    print(f"Processando: {video_path}")
    print(f"Salvando em: {output_dir}")

    paths = extract_unique_frames(
        video_path,
        output_dir,
        blur_threshold=25.0,  # Filtra apenas frames muito borrados
        interval_sec=0.5,
        skip_similar=True,
        min_pixel_diff=5.0,  # Só ignora se diferença média < 5 (quase idêntico)
    )

    print(f"\nConcluído! {len(paths)} frames salvos:")
    for p in paths:
        print(f"  - {os.path.basename(p)}")


if __name__ == "__main__":
    main()
