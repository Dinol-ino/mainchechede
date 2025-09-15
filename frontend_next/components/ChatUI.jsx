import React, { useState, useRef, useEffect } from "react";
import { v4 as uuidv4 } from "uuid";

export default function ChatUI({ messages, onSend, processing }){
  const [text, setText] = useState("");
  const endRef = useRef();
  useEffect(()=>{ if(endRef.current) endRef.current.scrollIntoView({behavior:"smooth"}); }, [messages, processing]);

  const submit = (e)=>{ e?.preventDefault(); const t = text.trim(); if(!t) return; setText(""); onSend(t); };

  return (
    <div className="chat-wrapper">
      <div className="messages">
        {messages.map(m=> (
          <div key={m.id} className={`msg ${m.role}`}>
            <div className="bubble">{m.text}</div>
          </div>
        ))}
        {processing && <div className="msg ai"><div className="bubble small">Processing...</div></div>}
        <div ref={endRef} />
      </div>

      <form className="composer" onSubmit={submit}>
        <input placeholder="Write a message..." value={text} onChange={e=>setText(e.target.value)} />
        <button type="submit">Send</button>
      </form>

      <style jsx>{`
        .chat-wrapper{ display:flex; flex-direction:column; height:100%; gap:12px; }
        .messages{ flex:1; overflow:auto; padding:12px; border-radius:8px; background: linear-gradient(180deg,#041826,#021524); }
        .msg{ display:flex; margin-bottom:10px; }
        .msg.user{ justify-content:flex-end; }
        .msg.ai{ justify-content:flex-start; }
        .bubble{ max-width:82%; padding:10px 14px; border-radius:14px; line-height:1.3; }
        .msg.user .bubble{ background: linear-gradient(90deg,#0ea5a3,#34d399); color:#002927; border-bottom-right-radius:4px; }
        .msg.ai .bubble{ background: linear-gradient(90deg,#111827,#0b1220); color:#dbeafe; border-bottom-left-radius:4px; }
        .bubble.small{ padding:6px 10px; opacity:0.9; font-size:13px }
        .composer{ display:flex; gap:8px; padding:6px; background:transparent; }
        .composer input{ flex:1; padding:10px 12px; border-radius:10px; border:1px solid rgba(255,255,255,0.05); background:rgba(255,255,255,0.02); color:#e6eef8 }
        .composer button{ padding:10px 14px; border-radius:10px; border:none; background:linear-gradient(90deg,#60a5fa,#7dd3fc); color:#012; font-weight:700; cursor:pointer }
      `}</style>
    </div>
  );
}