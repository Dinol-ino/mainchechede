from fastapi import FastAPI, UploadFile, Form, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from google.cloud import vision
import google.generativeai as genai
import threading
import time
import os
from typing import Dict

# ---------------------------
# Setup FastAPI
# ---------------------------
app = FastAPI()
app.add_middleware(
    CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"]
)

# ---------------------------
# Google Cloud Clients
# ---------------------------
vision_client = vision.ImageAnnotatorClient()

# Configure Gemini (make sure GOOGLE_API_KEY is set in env)
genai.configure(api_key=os.environ.get("GOOGLE_API_KEY"))
chat_model = genai.GenerativeModel("models/gemini-2.5-flash")

# ---------------------------
# Session Buffers
# ---------------------------
SESSIONS: Dict[str, Dict] = {}
MIN_PROCESS_INTERVAL = 1.2
DEBOUNCE_MS = 1.0
LOCK = threading.Lock()

# ---------------------------
# Helper: Choose dominant emotion
# ---------------------------
def choose_emotion_from_face(face):
    scores = {
        "joy": face.joy_likelihood,
        "sorrow": face.sorrow_likelihood,
        "anger": face.anger_likelihood,
        "surprise": face.surprise_likelihood
    }
    dominant = max(scores, key=lambda k: scores[k])
    return dominant

# ---------------------------
# Helper: Process a session image
# ---------------------------
def process_session(session_id: str):
    with LOCK:
        session = SESSIONS.get(session_id)
        if not session or not session.get("pending_image"):
            return
        image_bytes = session.pop("pending_image")
    try:
        image = vision.Image(content=image_bytes)
        response = vision_client.face_detection(image=image)
        faces = response.face_annotations
        if len(faces) == 0:
            emotion = "neutral"
        else:
            emotion = choose_emotion_from_face(faces[0])
    except Exception:
        emotion = "neutral"   # fallback instead of "error"
    result = {"emotion": emotion, "chatbot_response": ""}
    with LOCK:
        SESSIONS.setdefault(session_id, {})["last_result"] = result
        SESSIONS[session_id]["last_time"] = time.time()

# ---------------------------
# Endpoint: Analyze Emotion
# ---------------------------
@app.post("/analyze_emotion/")
async def analyze_emotion(request: Request, file: UploadFile = None, message: str = Form("")):
    session_id = request.headers.get("X-Session-Id") or request.query_params.get("session") or "default"
    contents = await file.read()
    now = time.time()

    with LOCK:
        session = SESSIONS.setdefault(session_id, {"last_time": 0, "last_result": None, "pending_image": None, "timer": None})
        last_time = session.get("last_time", 0)
        time_since = now - last_time

        if time_since < MIN_PROCESS_INTERVAL:
            session["pending_image"] = contents
            if session.get("timer"):
                try:
                    session["timer"].cancel()
                except Exception:
                    pass
            t = threading.Timer(DEBOUNCE_MS, process_session, args=(session_id,))
            session["timer"] = t
            t.start()
            raise HTTPException(status_code=202, detail="queued")
        else:
            session["pending_image"] = None
            session["timer"] = None
            session["last_time"] = now

    # Process immediately
    try:
        image = vision.Image(content=contents)
        response = vision_client.face_detection(image=image)
        faces = response.face_annotations
        if len(faces) == 0:
            emotion = "neutral"
        else:
            emotion = choose_emotion_from_face(faces[0])
    except Exception:
        emotion = "neutral"

    # Generate chatbot response (Gemini)
    chatbot_response = ""
    if message:
        try:
            if emotion in ["neutral", "unknown"]:
                prompt = f"The user said: '{message}'. Reply empathetically as a supportive chatbot."
            else:
                prompt = f"The user feels {emotion}. They said: '{message}'. Reply empathetically as a supportive chatbot."
            completion = chat_model.generate_content(prompt)
            chatbot_response = completion.text
        except Exception as e:
            chatbot_response = f"(chatbot error: {str(e)})"

    result = {"emotion": emotion, "chatbot_response": chatbot_response}
    with LOCK:
        SESSIONS.setdefault(session_id, {})["last_result"] = result
        SESSIONS[session_id]["last_time"] = time.time()
    return result

# ---------------------------
# Endpoint: Get Last Result
# ---------------------------
@app.get("/get_result/")
async def get_result(session: str = "default"):
    with LOCK:
        session_data = SESSIONS.get(session)
        if not session_data or not session_data.get("last_result"):
            return {"status": "none"}
        return {"status": "ok", "result": session_data["last_result"]}
