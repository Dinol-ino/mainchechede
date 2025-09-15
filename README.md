
EmotionForge v3 - Live webcam with adaptive capture intervals, overlay, and server debounce

Features added:
- Frontend stores a session id and sends it via header X-Session-Id with each snapshot.
- Frontend adapts snapshot frequency: backs off when server queues or detects neutral; speeds up when emotion detected.
- Visual overlay shows live emotion label on top-left of video feed.
- Backend implements debounce per-session: if snapshots arrive faster than MIN_PROCESS_INTERVAL (1.2s),
  it queues the latest frame and schedules processing after DEBOUNCE_MS (1.0s). Returns 202 when queued.
- Backend exposes /get_result/?session=<id> endpoint to fetch last processed result.

Run backend: set GOOGLE_APPLICATION_CREDENTIALS and run uvicorn main:app --reload --port 8000
Run frontend: cd frontend_next && npm install && npm run dev
