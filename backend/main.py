from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import shutil, os, json, requests
from dotenv import load_dotenv
from stt_service import transcribe_audio
from facial_gesture import FacialGestureAnalyzer

# Import ALL database functions at once
try:
    from database import (
        login_user, 
        register_user, 
        save_analysis,
        get_user_statistics,
        get_detailed_history,
        compare_analyses
    )
    DB_AVAILABLE = True
except Exception as e:
    print(f"⚠️ Database functions not available: {e}")
    DB_AVAILABLE = False

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
# 3️⃣ Enable CORS for React
# =======================
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# =======================
# 4️⃣ Pydantic Models
# =======================
class LoginRequest(BaseModel):
    username: str
    password: str

class SignupRequest(BaseModel):
    username: str
    email: str
    password: str

class SaveAnalysisRequest(BaseModel):
    user_id: int
    analysis_data: dict

# =======================
# 5️⃣ Gemini Helper
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
        return {"Error": f"Failed to get Gemini feedback: {e}"}

# =======================
# 6️⃣ Routes
# =======================
@app.get("/")
def root():
    return {
        "message": "✅ Backend running with Faster-Whisper + Gemini + Facial Gesture Analyzer",
        "database_available": DB_AVAILABLE
    }

@app.post("/login")
def login(request: LoginRequest):
    """User login endpoint"""
    if not DB_AVAILABLE:
        raise HTTPException(status_code=503, detail="Database not available")
    
    result = login_user(request.username, request.password)
    if result['success']:
        return {
            "success": True,
            "user_id": result['user_id'],
            "username": result['username'],
            "email": result['email']
        }
    else:
        raise HTTPException(status_code=401, detail=result.get('message', 'Invalid credentials'))

@app.post("/signup")
def signup(request: SignupRequest):
    """User registration endpoint"""
    if not DB_AVAILABLE:
        raise HTTPException(status_code=503, detail="Database not available")
    
    result = register_user(request.username, request.email, request.password)
    if result['success']:
        return {"success": True, "message": "Account created successfully"}
    else:
        raise HTTPException(status_code=400, detail=result.get('message', 'Registration failed'))

@app.post("/analyze")
async def analyze(file: UploadFile = File(...)):
    """Analyze speech from uploaded file"""
    temp_path = f"temp_{file.filename}"
    try:
        # Save uploaded file
        with open(temp_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        file.file.close()

        # Step 1: Transcribe speech
        transcription = transcribe_audio(temp_path)

        # Step 2: Gemini feedback
        feedback = call_gemini(transcription)

        # Step 3: Facial gesture analysis
        analyzer = FacialGestureAnalyzer()
        gesture_metrics = analyzer.analyze_video(temp_path)

        # Step 4: Calculate confidence and nervousness
        smile = gesture_metrics.get('smile_mean', 0)
        head_movement = gesture_metrics.get('head_pose_mean', 0)
        confidence = max(0, min(10, (smile * 10) - (head_movement * 5)))
        
        eyebrow = gesture_metrics.get('eyebrow_raise_mean', 0)
        blink = min(gesture_metrics.get('blink_count', 0), 20) / 20
        nervousness = max(0, min(10, (eyebrow * 5 + blink * 5 + head_movement * 5)))

        # Return response
        return {
            "transcription": transcription,
            "feedback": feedback,
            "gesture_metrics": gesture_metrics,
            "confidence_score": confidence,
            "nervousness_score": nervousness,
            "filename": file.filename
        }

    finally:
        try:
            if os.path.exists(temp_path):
                os.remove(temp_path)
        except PermissionError:
            pass

@app.post("/save-analysis")
def save_analysis_endpoint(request: SaveAnalysisRequest):
    """Save speech analysis to database"""
    if not DB_AVAILABLE:
        return {"success": False, "message": "Database not available"}
    
    try:
        result = save_analysis(request.user_id, request.analysis_data)
        if result['success']:
            return {
                "success": True, 
                "message": "Analysis saved successfully", 
                "analysis_id": result.get('analysis_id'),
                "session_number": result.get('session_number')
            }
        else:
            raise HTTPException(status_code=500, detail=result.get('message', 'Failed to save analysis'))
    except Exception as e:
        print(f"❌ Save analysis error: {e}")
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

@app.get("/user-statistics/{user_id}")
def get_statistics(user_id: int):
    """Get user's overall statistics"""
    if not DB_AVAILABLE:
        raise HTTPException(status_code=503, detail="Database not available")
    
    try:
        result = get_user_statistics(user_id)
        if result['success']:
            return result
        else:
            raise HTTPException(status_code=404, detail=result.get('message'))
    except Exception as e:
        print(f"❌ Statistics error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/user-history/{user_id}")
def get_history(user_id: int, limit: int = 20):
    """Get user's analysis history"""
    if not DB_AVAILABLE:
        raise HTTPException(status_code=503, detail="Database not available")
    
    try:
        result = get_detailed_history(user_id, limit)
        if result['success']:
            return result
        else:
            raise HTTPException(status_code=404, detail=result.get('message'))
    except Exception as e:
        print(f"❌ History error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/compare/{user_id}/{analysis_id_1}/{analysis_id_2}")
def compare(user_id: int, analysis_id_1: int, analysis_id_2: int):
    """Compare two analyses"""
    if not DB_AVAILABLE:
        raise HTTPException(status_code=503, detail="Database not available")
    
    try:
        result = compare_analyses(user_id, analysis_id_1, analysis_id_2)
        if result['success']:
            return result
        else:
            raise HTTPException(status_code=404, detail=result.get('message'))
    except Exception as e:
        print(f"❌ Comparison error: {e}")
        raise HTTPException(status_code=500, detail=str(e))