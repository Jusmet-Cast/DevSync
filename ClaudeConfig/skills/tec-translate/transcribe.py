#!/usr/bin/env python
"""
Transcribe un archivo de audio/video (.mp3, .mp4, .wav, .m4a, etc.) usando
faster-whisper, 100% local -- ningun audio sale de esta maquina. Opcionalmente
diariza (distingue quien habla) con pyannote.audio.

Uso:
    py transcribe.py <archivo_entrada> [carpeta_salida] [modelo] [idioma] [diarizar]

    archivo_entrada  : ruta al .mp4/.mp3/.wav de la reunion
    carpeta_salida   : donde escribir el .txt y el .vtt (default: misma carpeta del archivo)
    modelo           : tiny | base | small | medium | large-v3 (default: small)
                        mas grande = mas preciso y mas lento en CPU.
    idioma           : codigo ISO (es, en, ...) o "auto" para autodeteccion (default: es)
    diarizar         : si | no (default: si). Requiere HF_TOKEN seteado (ver SKILL.md) y
                        pyannote.audio instalado. Si falta cualquiera de los dos, sigue sin
                        diarizar (avisa, no corta la transcripcion).

Salida (en carpeta_salida, mismo nombre base que el archivo de entrada):
    <nombre>.transcript.txt  -- texto plano, un parrafo por segmento, con timestamp
                                 y [HABLANTE_N] si la diarizacion funciono
    <nombre>.transcript.vtt  -- subtitulos formato WebVTT (por si se quiere revisar sincronizado)

NOTA DE COMPATIBILIDAD (23-Oct-2026): la version de PyAV instalada (19.x, la unica con
wheel prebuilt para Python 3.14 al momento de escribir esto) rompio la firma de
`av.open()` que usa internamente `faster_whisper.audio.decode_audio` (sacaron el
parametro `metadata_errors`). Por eso ESTE script decodifica el audio a mano
(`decodificar_audio_ndarray`) y le pasa a faster-whisper un array de numpy ya
decodificado en vez de la ruta del archivo -- `transcribe()` solo llama a su
`decode_audio` interno si NO recibe un `np.ndarray` (ver faster_whisper/transcribe.py).
Si en el futuro se actualiza faster-whisper a una version que ya soporte PyAV 19+, este
workaround se puede sacar y volver a pasar `str(archivo_entrada)` directo.
"""

import os
import sys
import tempfile
import wave
from pathlib import Path

import numpy as np


def formatear_timestamp_vtt(segundos: float) -> str:
    horas = int(segundos // 3600)
    minutos = int((segundos % 3600) // 60)
    segs = segundos % 60
    return f"{horas:02d}:{minutos:02d}:{segs:06.3f}"


def decodificar_audio_ndarray(ruta_entrada: Path, sampling_rate: int = 16000) -> np.ndarray:
    """Decodifica cualquier contenedor de audio/video a un array float32 mono,
    normalizado a [-1, 1], al sampling_rate pedido. Usa PyAV directo (sin el
    kwarg `metadata_errors` que la version instalada ya no soporta -- ver nota
    de compatibilidad arriba del archivo)."""
    import av

    contenedor = av.open(str(ruta_entrada), mode="r")
    stream_audio = contenedor.streams.audio[0]
    resampler = av.AudioResampler(format="s16", layout="mono", rate=sampling_rate)

    partes = []
    for frame in contenedor.decode(stream_audio):
        for frame_resampleado in resampler.resample(frame):
            partes.append(frame_resampleado.to_ndarray())

    contenedor.close()

    if not partes:
        return np.zeros(0, dtype=np.float32)

    audio_s16 = np.concatenate([p.reshape(-1) for p in partes])
    return audio_s16.astype(np.float32) / 32768.0


def guardar_wav(audio: np.ndarray, ruta_wav: Path, sampling_rate: int = 16000) -> None:
    """Escribe un array float32 [-1, 1] como WAV PCM 16-bit mono -- formato que
    pyannote.audio puede leer sin depender del mismo PyAV roto."""
    audio_s16 = np.clip(audio * 32768.0, -32768, 32767).astype(np.int16)
    with wave.open(str(ruta_wav), "wb") as wav_out:
        wav_out.setnchannels(1)
        wav_out.setsampwidth(2)
        wav_out.setframerate(sampling_rate)
        wav_out.writeframes(audio_s16.tobytes())


def diarizar_audio(ruta_wav: Path):
    """Devuelve una lista de (inicio, fin, etiqueta_hablante) o None si no se
    pudo diarizar (falta HF_TOKEN, falta pyannote, o el modelo no se pudo
    descargar/cargar). Nunca lanza -- la transcripcion tiene que seguir andando
    aunque la diarizacion falle."""
    token = os.environ.get("HF_TOKEN")
    if not token:
        print(
            "AVISO: no hay HF_TOKEN seteado -- se transcribe SIN distinguir quien habla. "
            "Ver SKILL.md seccion 'Diarizacion' para configurarlo.",
            file=sys.stderr,
        )
        return None

    try:
        from pyannote.audio import Pipeline
    except ImportError:
        print(
            "AVISO: pyannote.audio no esta instalado -- se transcribe SIN distinguir quien habla.",
            file=sys.stderr,
        )
        return None

    try:
        print("Cargando pipeline de diarizacion (pyannote, primera vez descarga el modelo)...", file=sys.stderr)
        # pyannote.audio >= 3.x renombro use_auth_token -> token.
        pipeline = Pipeline.from_pretrained("pyannote/speaker-diarization-3.1", token=token)

        print("Diarizando (quien habla cuando) -- puede tardar varios minutos en CPU...", file=sys.stderr)
        diarizacion = pipeline(str(ruta_wav))

        segmentos = []
        for turno, _, hablante in diarizacion.itertracks(yield_label=True):
            segmentos.append((turno.start, turno.end, hablante))
        return segmentos
    except Exception as ex:
        print(f"AVISO: fallo la diarizacion ({ex}) -- se transcribe SIN distinguir quien habla.", file=sys.stderr)
        return None


def resolver_hablante(inicio: float, fin: float, segmentos_hablantes):
    """Para un segmento de Whisper [inicio, fin], busca que hablante de la
    diarizacion se solapa mas en el tiempo con ese rango."""
    mejor_hablante = None
    mejor_solapamiento = 0.0
    for s_inicio, s_fin, etiqueta in segmentos_hablantes:
        solapamiento = min(fin, s_fin) - max(inicio, s_inicio)
        if solapamiento > mejor_solapamiento:
            mejor_solapamiento = solapamiento
            mejor_hablante = etiqueta
    return mejor_hablante


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)

    archivo_entrada = Path(sys.argv[1]).resolve()
    if not archivo_entrada.exists():
        print(f"ERROR: no existe el archivo '{archivo_entrada}'")
        sys.exit(1)

    carpeta_salida = Path(sys.argv[2]).resolve() if len(sys.argv) > 2 else archivo_entrada.parent
    modelo = sys.argv[3] if len(sys.argv) > 3 else "small"
    idioma = sys.argv[4] if len(sys.argv) > 4 else "es"
    idioma = None if idioma.lower() == "auto" else idioma
    diarizar = (sys.argv[5] if len(sys.argv) > 5 else "si").lower() not in ("no", "false", "0")

    carpeta_salida.mkdir(parents=True, exist_ok=True)

    print(f"Decodificando audio de '{archivo_entrada.name}'...", file=sys.stderr)
    audio_ndarray = decodificar_audio_ndarray(archivo_entrada)

    segmentos_hablantes = None
    ruta_wav_temporal = None
    if diarizar:
        ruta_wav_temporal = Path(tempfile.gettempdir()) / f"{archivo_entrada.stem}_tectranslate_audio.wav"
        guardar_wav(audio_ndarray, ruta_wav_temporal)
        segmentos_hablantes = diarizar_audio(ruta_wav_temporal)

    from faster_whisper import WhisperModel

    print(f"Cargando modelo '{modelo}' (CPU, int8)...", file=sys.stderr)
    model = WhisperModel(modelo, device="cpu", compute_type="int8")

    print(f"Transcribiendo '{archivo_entrada.name}'...", file=sys.stderr)
    segments, info = model.transcribe(
        audio_ndarray,
        language=idioma,
        vad_filter=True,  # recorta silencios largos -- mas rapido y menos alucinaciones
    )

    print(
        f"Idioma detectado: {info.language} (confianza {info.language_probability:.2f})",
        file=sys.stderr,
    )

    nombre_base = archivo_entrada.stem
    ruta_txt = carpeta_salida / f"{nombre_base}.transcript.txt"
    ruta_vtt = carpeta_salida / f"{nombre_base}.transcript.vtt"

    with open(ruta_txt, "w", encoding="utf-8") as f_txt, open(
        ruta_vtt, "w", encoding="utf-8"
    ) as f_vtt:
        f_vtt.write("WEBVTT\n\n")

        for segmento in segments:
            minutos = int(segmento.start // 60)
            segs = int(segmento.start % 60)
            texto = segmento.text.strip()

            etiqueta_hablante = (
                resolver_hablante(segmento.start, segmento.end, segmentos_hablantes)
                if segmentos_hablantes
                else None
            )
            prefijo = f"[{etiqueta_hablante}] " if etiqueta_hablante else ""

            f_txt.write(f"[{minutos:02d}:{segs:02d}] {prefijo}{texto}\n")

            inicio_vtt = formatear_timestamp_vtt(segmento.start)
            fin_vtt = formatear_timestamp_vtt(segmento.end)
            f_vtt.write(f"{inicio_vtt} --> {fin_vtt}\n{prefijo}{texto}\n\n")

            print(f"[{minutos:02d}:{segs:02d}] {prefijo}{texto}")

    if ruta_wav_temporal is not None and ruta_wav_temporal.exists():
        ruta_wav_temporal.unlink()

    print(f"\nListo. Transcript: {ruta_txt}", file=sys.stderr)
    print(f"Subtitulos VTT: {ruta_vtt}", file=sys.stderr)
    if diarizar and segmentos_hablantes is None:
        print(
            "NOTA: se pidio diarizacion pero no se pudo -- revisa los avisos de arriba (HF_TOKEN / pyannote).",
            file=sys.stderr,
        )


if __name__ == "__main__":
    main()
