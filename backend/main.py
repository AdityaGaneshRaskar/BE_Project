from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel
import shutil, os, json, requests, time
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

class GenerateSpeechRequest(BaseModel):
    topic: str

class CompareSpeeches(BaseModel):
    user_transcript: str
    gemini_speech: str

# =======================
# 5️⃣ Gemini Helper Functions
# =======================
def call_gemini(transcription: str) -> dict:
    """Get feedback on transcribed speech from Gemini"""
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
        print(f"❌ Gemini API Error: {e}")
        return {"Error": f"Failed to get Gemini feedback: {e}"}

def generate_gemini_speech(topic: str) -> dict:
    """Generate a reference speech on a given topic using Gemini"""
    url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent"
    headers = {
        "Content-Type": "application/json",
        "x-goog-api-key": GEMINI_API_KEY
    }

    prompt = f"""Generate a professional, well-structured extempore speech on the following topic. 
    The speech should be approximately 2-3 minutes long (400-600 words).
    
    Structure it as:
    1. Hook/Introduction (grab attention)
    2. Main Body (2-3 key points with examples)
    3. Counterargument acknowledgment
    4. Conclusion (summarize and call to action)
    
    Use clear language, varied sentence structure, and compelling examples.
    Make it engaging and persuasive.
    
    Topic: {topic}
    
    IMPORTANT: Return ONLY the speech text, nothing else."""
    
    payload = {"contents": [{"parts": [{"text": prompt}]}]}

    try:
        r = requests.post(url, headers=headers, json=payload, timeout=60)
        r.raise_for_status()
        data = r.json()
        speech = data["candidates"][0]["content"]["parts"][0]["text"].strip()
        return {"success": True, "speech": speech}
    except Exception as e:
        print(f"❌ Generate Speech Error: {e}")
        return {"success": False, "message": f"Failed to generate speech: {e}"}

def analyze_speech_comparison(user_transcript: str, gemini_speech: str) -> dict:
    """Analyze and compare user's speech with Gemini's speech"""
    url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent"
    headers = {
        "Content-Type": "application/json",
        "x-goog-api-key": GEMINI_API_KEY
    }

    prompt = f"""Analyze and compare these two speeches. Return a JSON response with this exact structure:
    {{
      "word_count_user": <number>,
      "word_count_gemini": <number>,
      "vocabulary_level_user": "<beginner/intermediate/advanced>",
      "vocabulary_level_gemini": "<beginner/intermediate/advanced>",
      "user_key_points": ["point1", "point2", "point3"],
      "gemini_key_points": ["point1", "point2", "point3"],
      "user_strengths": ["strength1", "strength2"],
      "areas_to_improve": ["area1", "area2"],
      "structure_analysis": "Analysis of how well each speech was structured",
      "engagement_level": "How engaging each speech was",
      "recommendations": ["recommendation1", "recommendation2", "recommendation3"]
    }}
    
    USER'S SPEECH:
    {user_transcript}
    
    GEMINI'S SPEECH:
    {gemini_speech}
    
    Return ONLY valid JSON, no markdown or extra text."""
    
    payload = {"contents": [{"parts": [{"text": prompt}]}]}

    try:
        r = requests.post(url, headers=headers, json=payload, timeout=60)
        r.raise_for_status()
        data = r.json()
        raw_text = data["candidates"][0]["content"]["parts"][0]["text"].strip()
        
        # Clean JSON formatting
        clean = raw_text
        if clean.lower().startswith("json"):
            clean = clean[4:].strip()
        if clean.startswith("```"):
            clean = clean.replace("```json", "").replace("```", "").strip()
        
        return {"success": True, "analysis": json.loads(clean)}
    except Exception as e:
        print(f"❌ Speech Comparison Error: {e}")
        return {"success": False, "message": f"Failed to analyze comparison: {e}"}

# =======================
# 6️⃣ API Routes
# =======================

@app.get("/")
def root():
    """Health check endpoint"""
    return {
        "message": "✅ Backend running with Faster-Whisper + Gemini + Facial Gesture Analyzer",
        "database_available": DB_AVAILABLE,
        "version": "1.0.0"
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
    """Analyze speech from uploaded video/audio file"""
    temp_path = f"temp_{file.filename}"
    saved_video_path = None
    
    try:
        # Save uploaded file temporarily
        with open(temp_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        file.file.close()

        # Create uploads directory if it doesn't exist
        uploads_dir = "uploads"
        if not os.path.exists(uploads_dir):
            os.makedirs(uploads_dir)

        # Save video permanently with unique name
        timestamp = int(time.time())
        file_extension = os.path.splitext(file.filename)[1]
        unique_filename = f"{timestamp}_{file.filename}"
        saved_video_path = os.path.join(uploads_dir, unique_filename)
        
        # Copy to permanent location
        shutil.copy2(temp_path, saved_video_path)
        
        # Get file info
        file_size = os.path.getsize(temp_path)

        # Step 1: Transcribe speech
        print("📝 Transcribing audio...")
        transcription = transcribe_audio(temp_path)

        # Step 2: Gemini feedback
        print("🤖 Getting Gemini feedback...")
        feedback = call_gemini(transcription)

        # Step 3: Facial gesture analysis
        print("😊 Analyzing facial gestures...")
        analyzer = FacialGestureAnalyzer()
        gesture_metrics = analyzer.analyze_video(temp_path)

        # Step 4: Calculate confidence and nervousness
        smile = gesture_metrics.get('smile_mean', 0)
        head_movement = gesture_metrics.get('head_pose_mean', 0)
        confidence = max(0, min(10, (smile * 10) - (head_movement * 5)))
        
        eyebrow = gesture_metrics.get('eyebrow_raise_mean', 0)
        blink = min(gesture_metrics.get('blink_count', 0), 20) / 20
        nervousness = max(0, min(10, (eyebrow * 5 + blink * 5 + head_movement * 5)))

        print("✅ Analysis complete!")
        
        # Return response with video path
        return {
            "transcription": transcription,
            "feedback": feedback,
            "gesture_metrics": gesture_metrics,
            "confidence_score": round(confidence, 2),
            "nervousness_score": round(nervousness, 2),
            "filename": file.filename,
            "video_path": saved_video_path,
            "file_size": file_size,
            "file_duration": gesture_metrics.get('duration', 0)
        }

    except Exception as e:
        print(f"❌ Analysis error: {e}")
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")
    
    finally:
        # Cleanup temp file only
        try:
            if os.path.exists(temp_path):
                os.remove(temp_path)
        except PermissionError:
            pass

@app.post("/save-analysis")
def save_analysis_endpoint(request: SaveAnalysisRequest):
    """Save speech analysis to database"""
    if not DB_AVAILABLE:
        raise HTTPException(status_code=503, detail="Database not available")
    
    try:
        # Ensure analysis_data has all required fields with defaults
        analysis_data = request.analysis_data.copy()
        
        # Add topic if not present (empty string as default)
        if 'topic' not in analysis_data:
            analysis_data['topic'] = ''
        
        print(f"💾 Saving analysis for user {request.user_id}...")
        result = save_analysis(request.user_id, analysis_data)
        
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
        print(f"❌ Save analysis error: 500: {e}")
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")

@app.get("/uploads/{filename}")
async def get_video(filename: str):
    """Serve uploaded video files"""
    file_path = os.path.join("uploads", filename)
    if os.path.exists(file_path):
        return FileResponse(file_path)
    else:
        raise HTTPException(status_code=404, detail="Video not found")

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

@app.post("/generate-gemini-speech")
def generate_speech(request: GenerateSpeechRequest):
    """Generate a reference speech on a given topic"""
    try:
        result = generate_gemini_speech(request.topic)
        if result['success']:
            return result
        else:
            raise HTTPException(status_code=500, detail=result.get('message'))
    except Exception as e:
        print(f"❌ Generate speech error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/compare-speeches")
def compare_speeches(request: CompareSpeeches):
    """Compare user's speech with Gemini's speech"""
    try:
        result = analyze_speech_comparison(request.user_transcript, request.gemini_speech)
        if result['success']:
            return result
        else:
            raise HTTPException(status_code=500, detail=result.get('message'))
    except Exception as e:
        print(f"❌ Compare speeches error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# =======================
# 7️⃣ Run the app
# =======================
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)