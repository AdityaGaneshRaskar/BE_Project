from fastapi import FastAPI, UploadFile, File
import shutil, os, json, requests
from dotenv import load_dotenv
from backend.stt_service import transcribe_audio  # Your existing Whisper service
from backend.facial_gesture import FacialGestureAnalyzer

# =======================
# 1️⃣ Load Environment
# =======================
load_dotenv()
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

if not GEMINI_API_KEY:
    raise ValueError("❌ GEMINI_API_KEY not found in .env file")

# =======================
# 2️⃣ FastAPI App
# =======================
app = FastAPI(
    title="Extempore Speech Evaluator",
    description="Transcribe speech, get Gemini feedback, and analyze facial gestures",
    version="1.0.0"
)

# =======================
# 3️⃣ Gemini Helper
# =======================
def call_gemini(transcription: str) -> dict:
    url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent"
    headers = {
        "Content-Type": "application/json",
        "x-goog-api-key": GEMINI_API_KEY
    }

    prompt = f"""
    Evaluate the following extempore speech and return ONLY valid JSON
    (no markdown, no extra text) in this format:
    {{
      "Clarity":   {{ "score": <0-10>, "comment": "...", "improvements": ["...","..."] }},
      "Arguments": {{ "score": <0-10>, "comment": "...", "improvements": ["...","..."] }},
      "Grammar":   {{ "score": <0-10>, "comment": "...", "improvements": ["...","..."] }},
      "Delivery":  {{ "score": <0-10>, "comment": "...", "improvements": ["...","..."] }},
      "Overall":   {{ "score": <0-10>, "comment": "...", "improvements": ["...","..."] }}
    }}
    Speech:
    {transcription}
    """
    payload = {"contents": [{"parts": [{"text": prompt}]}]}

    try:
        r = requests.post(url, headers=headers, json=payload, timeout=60)
        r.raise_for_status()
        data = r.json()
        raw_text = data["candidates"][0]["content"]["parts"][0]["text"].strip()

        # Clean formatting
        clean = raw_text
        if clean.lower().startswith("json"):
            clean = clean[4:].strip()
        if clean.startswith("```"):
            clean = clean.replace("```json", "").replace("```", "").strip()

        return json.loads(clean)
    except Exception as e:
        return {"Error": f"Failed to get Gemini feedback: {e}", "raw_response": r.text if 'r' in locals() else None}

# =======================
# 4️⃣ Routes
# =======================
@app.get("/")
def root():
    return {"message": "✅ Backend running with Faster-Whisper + Gemini + Facial Gesture Analyzer"}

@app.post("/analyze")
async def analyze(file: UploadFile = File(...)):
    temp_path = f"temp_{file.filename}"
    try:
        # Save uploaded file
        with open(temp_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        # Close UploadFile to release handle (Windows safe)
        file.file.close()

        # --- Step 1: Transcribe speech ---
        transcription = transcribe_audio(temp_path)

        # --- Step 2: Gemini feedback ---
        feedback = call_gemini(transcription)

        # --- Step 3: Facial gesture analysis ---
        analyzer = FacialGestureAnalyzer()
        gesture_metrics = analyzer.analyze_video(temp_path)

        # --- Step 4: Return combined JSON ---
        return {
            "transcription": transcription,
            "feedback": feedback,
            "gesture_metrics": gesture_metrics
        }

    finally:
        # Cleanup temp file safely on Windows
        try:
            if os.path.exists(temp_path):
                os.remove(temp_path)
        except PermissionError:
            pass
