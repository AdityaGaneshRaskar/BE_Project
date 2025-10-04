from faster_whisper import WhisperModel

# Load the model once when the service starts.
# Using a small model like "base" is good for CPU inference.
# For higher accuracy on a machine with a GPU, you might use "medium" or "large".
try:
    model = WhisperModel("base", device="cpu", compute_type="int8")
except Exception as e:
    print(f"Error loading Whisper model: {e}")
    # You might want to handle this more gracefully, but for now, we'll let it raise
    raise

def transcribe_audio(file_path: str) -> str:
    """
    Transcribes an audio file using the pre-loaded Whisper model.
    Returns the transcribed text as a single string.
    """
    try:
        segments, info = model.transcribe(file_path, beam_size=5)
        
        # Concatenate all segment texts into a single string
        transcribed_text = " ".join(segment.text for segment in segments)
        
        print(f"Detected language '{info.language}' with probability {info.language_probability}")
        print("Transcription successful.")
        
        return transcribed_text.strip()
    except Exception as e:
        print(f"Error during audio transcription: {e}")
        return ""
