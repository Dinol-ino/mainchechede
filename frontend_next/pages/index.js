import { useState, useRef, useEffect } from "react";
import Head from "next/head";
import dynamic from "next/dynamic";
import ChatUI from "../components/ChatUI";
import { v4 as uuidv4 } from "uuid";

const ThreeScene = dynamic(() => import("../components/ThreeScene"), { ssr:false });

function getSessionId(){ if(typeof window==="undefined") return "default"; let id = localStorage.getItem("ef_session_id"); if(!id){ id = uuidv4(); localStorage.setItem("ef_session_id", id); } return id; }

export default function Home(){
  const [messages, setMessages] = useState([]); // {id, role:'user'|'ai', text}
  const [emotion, setEmotion] = useState("");
  const [live, setLive] = useState(false);
  const [processing, setProcessing] = useState(false);
  const videoRef = useRef();
  const canvasRef = useRef();
  const intervalRef = useRef();
  const sessionIdRef = useRef(getSessionId());
  const captureIntervalRef = useRef(1500); // ms

  useEffect(()=>{ return ()=>{ stopLive(); } }, []);

  const startCamera = async ()=>{
    try{
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 }, audio: false });
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
    }catch(e){ alert("Error accessing camera: " + e.message); }
  };

  const stopCamera = ()=>{
    const stream = videoRef.current?.srcObject;
    if(stream) stream.getTracks().forEach(t=>t.stop());
    if(videoRef.current) videoRef.current.srcObject = null;
  };

  const sendMessage = async (text)=>{
    const userMsg = { id: uuidv4(), role: "user", text };
    setMessages(prev => [...prev, userMsg]);
    await captureAndSend(text);
  };

  const captureAndSend = async (userText) => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if(!video || video.readyState < 2){ alert("Camera not ready"); return; }
    setProcessing(true);
    const ctx = canvas.getContext("2d");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise(resolve=>canvas.toBlob(resolve, "image/jpeg", 0.7));
    if(!blob) { setProcessing(false); return; }
    const fd = new FormData();
    fd.append("file", blob, "frame.jpg");
    fd.append("message", userText || "");

    try{
      const res = await fetch("http://localhost:8000/analyze_emotion/", {
        method:"POST", body: fd, headers: {"X-Session-Id": sessionIdRef.current}
      });
      if(res.status === 202){
        const poll = async ()=>{
          const r2 = await fetch(`http://localhost:8000/get_result/?session=${sessionIdRef.current}`);
          const d2 = await r2.json();
          if(d2.status === "ok"){
            handleResult(d2.result, userText);
          } else {
            setTimeout(poll, 700);
          }
        };
        poll();
      } else if(res.ok){
        const data = await res.json();
        handleResult(data, userText);
      } else {
        const txt = await res.text();
        console.error("server error", res.status, txt);
        setMessages(prev => [...prev, { id: uuidv4(), role: "ai", text: "Error: server returned " + res.status }]);
      }
    }catch(e){
      console.error("send error", e);
      setMessages(prev => [...prev, { id: uuidv4(), role: "ai", text: "Network error: " + e.message }]);
    } finally {
      setProcessing(false);
    }
  };

  const handleResult = (data, userText) => {
    const em = data.emotion || "neutral";
    setEmotion(em);
    const aiText = data.chatbot_response || (userText ? `Thanks for saying: ${userText}` : "I see you.");
    setMessages(prev => [...prev, { id: uuidv4(), role: "ai", text: aiText }]);
    if(em === "neutral") captureIntervalRef.current = 4000;
    else captureIntervalRef.current = 1500;
  };

  const startLive = async ()=>{
    await startCamera();
    setLive(true);
    intervalRef.current = setInterval(async ()=>{ if(!processing) await captureAndSend(""); }, captureIntervalRef.current);
    intervalRef.adjust = setInterval(()=>{
      if(intervalRef.current){ clearInterval(intervalRef.current); intervalRef.current = setInterval(async ()=>{ if(!processing) await captureAndSend(""); }, captureIntervalRef.current); }
    }, 1000);
  };

  const stopLive = ()=>{
    setLive(false);
    if(intervalRef.current){ clearInterval(intervalRef.current); intervalRef.current = null; }
    if(intervalRef.adjust){ clearInterval(intervalRef.adjust); intervalRef.adjust = null; }
    stopCamera();
  };

  return (
    <div className="app-grid">
      <Head><title>EmotionForge — Chat & AR</title></Head>

      <div className="left-panel">
        <div className="header"><h2>EmotionForge</h2><p className="sub">Emotion-aware Chatbot</p></div>
        <ChatUI messages={messages} onSend={sendMessage} processing={processing} />
      </div>

      <div className="right-panel">
        <div className="cam-card">
          <div className="cam-top">
            <video ref={videoRef} className="video" autoPlay muted playsInline />
            <div className={`badge ${emotion}`}>{processing ? "Processing..." : (emotion || "—")}</div>
          </div>
          <div className="cam-controls">
            {!live ? <button className="btn" onClick={startLive}>Start Live</button> : <button className="btn" onClick={stopLive}>Stop Live</button>}
            <button className="btn ghost" onClick={() => captureAndSend("")}>Capture</button>
          </div>
        </div>

        <div className="ar-card">
          <h3>AR Scene</h3>
          <ThreeScene emotion={emotion} />
        </div>
      </div>

      <canvas ref={canvasRef} style={{display:"none"}} />

      <style jsx>{`
        .app-grid{ display:grid; grid-template-columns: 420px 1fr; height:100vh; gap:20px; padding:20px; background: linear-gradient(180deg,#0f1724,#071021); color:#e6eef8; box-sizing:border-box; }
        .left-panel{ background: linear-gradient(180deg,#081226, #042033); border-radius:12px; padding:16px; display:flex; flex-direction:column; }
        .right-panel{ display:flex; flex-direction:column; gap:16px; }
        .header h2{ margin:0; font-size:20px }
        .sub{ color:#9fb0c8; margin:0; font-size:13px }
        .cam-card{ background:#071225; border-radius:10px; padding:12px; }
        .cam-top{ position:relative; display:flex; align-items:center; justify-content:center; }
        .video{ width:100%; max-width:520px; border-radius:8px; background:#000; }
        .badge{ position:absolute; left:12px; top:12px; padding:8px 12px; background:rgba(0,0,0,0.6); border-radius:8px; font-weight:700; }
        .badge.joy{ background:linear-gradient(90deg,#ff7eb6,#ff65a3); color:#fff; }
        .badge.sorrow{ background:linear-gradient(90deg,#6fb3ff,#3a8dff); color:#fff; }
        .badge.surprise{ background:linear-gradient(90deg,#ffd36f,#ff9a3f); color:#111; }
        .cam-controls{ margin-top:8px; display:flex; gap:8px; }
        .btn{ background:linear-gradient(90deg,#5eead4,#38bdf8); border:none; padding:8px 12px; border-radius:8px; cursor:pointer; color:#043; font-weight:700 }
        .btn.ghost{ background:transparent; border:1px solid rgba(255,255,255,0.06); color:#9fb0c8 }
        .ar-card{ background:#071226; border-radius:10px; padding:12px; min-height:420px; }
      `}</style>
    </div>
  );
}
