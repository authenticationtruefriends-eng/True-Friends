import { useState, useRef, useEffect } from "react";
import { useSocket } from "../../context/SocketContext";
import { useAuth } from "../../context/AuthContext";
import { Send, X, Image as ImageIcon, Loader2, Smile, CheckCheck, Paperclip, Camera, Mic, MapPin, FileText, Headphones, Sticker, Video } from "lucide-react";
import { useChat } from "../../context/ChatContext";
import { encryptMessage, encryptFileChunk, arrayBufferToBase64 } from "../../utils/encryption";
import EmojiPicker from 'emoji-picker-react';
import { createPortal } from 'react-dom';

export default function ChatInput({ toUser, onSendMessage, initialText = "", onUpdateMessage, onCancelEditing }) {
  const [text, setText] = useState(initialText);
  const [uploading, setUploading] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [isRecording, setIsRecording] = useState(false);

  // --- Recording State & Refs ---
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const timerRef = useRef(null);
  const isCancelledRef = useRef(false);

  const [activePickerTab, setActivePickerTab] = useState("emoji"); // emoji, gif, sticker
  const [gifResults, setGifResults] = useState([]);
  const [stickerResults, setStickerResults] = useState([]); // Separate state for stickers
  const [gifQuery, setGifQuery] = useState("");
  const [loadingGifs, setLoadingGifs] = useState(false);
  const [giphyError, setGiphyError] = useState(null);
  const [showCameraModal, setShowCameraModal] = useState(false);
  const [cameraStream, setCameraStream] = useState(null);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  const { user } = useAuth();
  const { socket } = useSocket();
  const { replyStates, clearReplyTo } = useChat();

  const typingTimeoutRef = useRef(null);
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);
  const docInputRef = useRef(null);
  const audioInputRef = useRef(null);
  const inputRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  const currentReply = replyStates[toUser];

  // Update local text if initialText changes (when starting an edit)
  useEffect(() => {
    if (initialText) {
      setText(initialText);
    }
  }, [initialText]);

  // Auto-focus when editing or replying
  useEffect(() => {
    if (initialText || currentReply) {
      inputRef.current?.focus();
    }
  }, [initialText, currentReply]);

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // --- New Media Handlers ---

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];
      isCancelledRef.current = false;

      mediaRecorderRef.current.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorderRef.current.onstop = async () => {
        if (isCancelledRef.current) {
          console.log("Recording cancelled, discarding audio.");
          audioChunksRef.current = []; // Clear chunks
          stream.getTracks().forEach(track => track.stop()); // Stop stream even if cancelled
          return;
        }

        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const file = new File([audioBlob], `voice-note-${Date.now()}.webm`, { type: 'audio/webm' });
        uploadFile(file, 'audio');
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
      setIsPaused(false);
      setRecordingDuration(0);

      // Start Timer
      timerRef.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);

    } catch (err) {
      console.error("Mic error:", err);
      alert("Microphone access denied.");
    }
  };

  const pauseRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.pause();
      setIsPaused(true);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  const resumeRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "paused") {
      mediaRecorderRef.current.resume();
      setIsPaused(false);
      timerRef.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);
    }
  };

  const cancelRecording = () => {
    isCancelledRef.current = true;
    if (mediaRecorderRef.current) {
      if (mediaRecorderRef.current.state === "paused") {
        mediaRecorderRef.current.resume(); // Resume to stop cleanly
        setTimeout(() => mediaRecorderRef.current.stop(), 50);
      } else {
        mediaRecorderRef.current.stop();
      }
    }
    setIsRecording(false);
    setIsPaused(false);
    setRecordingDuration(0);
    if (timerRef.current) clearInterval(timerRef.current);
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop(); // triggers onstop -> upload
      setIsRecording(false);
      setIsPaused(false);
      setRecordingDuration(0);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  const handleLocation = () => {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        const mapsUrl = `https://www.google.com/maps?q=${latitude},${longitude}`;
        const messagePayload = {
          msgId: Date.now().toString() + Math.random().toString(36).substr(2, 9),
          type: 'location',
          latitude,
          longitude,
          text: encryptMessage(`📍 My Location`),
          mapsUrl: mapsUrl,
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          timestamp: Date.now(),
          replyTo: currentReply ? {
            text: encryptMessage(currentReply.text),
            from: currentReply.fromMe || currentReply.from === user.uid ? 'me' : currentReply.from,
            msgId: currentReply.msgId || currentReply.timestamp
          } : null
        };

        if (toUser.startsWith("group_")) {
          socket.emit("group-message", { groupId: toUser, from: user.uid, message: messagePayload });
        } else {
          socket.emit("send-message", { to: toUser, from: user.uid, message: messagePayload });
        }

        onSendMessage(messagePayload);
        if (currentReply) clearReplyTo(toUser);
        setShowAttachMenu(false);
      },
      (err) => {
        alert("Failed to get location.");
        console.error(err);
      }
    );
  };

  const [uploadProgress, setUploadProgress] = useState(0);

  const uploadFile = async (file, forceType = null) => {
    if (!file) return;
    setUploading(true);
    setUploadProgress(0);

    try {
      const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB chunks
      const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
      const fileId = Date.now().toString() + Math.random().toString(36).substr(2, 9);

      let version = 'v3'; // Framed GCM

      for (let i = 0; i < totalChunks; i++) {
        const start = i * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, file.size);
        const chunk = file.slice(start, end);
        const arrayBuffer = await chunk.arrayBuffer();

        // Encrypt Chunk
        const { encryptedChunk, iv } = await encryptFileChunk(arrayBuffer);

        // v3: Prepend IV (12 bytes) to the encrypted data for each chunk
        const framedChunk = new Uint8Array(iv.byteLength + encryptedChunk.byteLength);
        framedChunk.set(new Uint8Array(iv), 0);
        framedChunk.set(new Uint8Array(encryptedChunk), iv.byteLength);

        // Convert to Base64 for transit
        const base64Content = arrayBufferToBase64(framedChunk);

        // Retry logic for chunk upload
        let success = false;
        let retries = 3;
        while (!success && retries > 0) {
          try {
            const res = await fetch("/api/upload-chunk", {
              method: "POST",
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                fileId,
                chunkIndex: i,
                totalChunks,
                data: base64Content
              })
            });

            if (!res.ok) throw new Error(`Chunk ${i} failed`);
            success = true;
          } catch (chunkErr) {
            retries--;
            if (retries === 0) throw chunkErr;
            console.warn(`Chunk ${i} upload failed, retrying... (${retries} left)`);
            await new Promise(r => setTimeout(r, 1000)); // Wait 1s before retry
          }
        }

        setUploadProgress(Math.round(((i + 1) / totalChunks) * 100));
      }

      const finalizeRes = await fetch("/api/upload-finalize", {
        method: "POST",
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileId,
          totalChunks,
          fileName: file.name,
          version
        })
      });

      const data = await finalizeRes.json();
      if (data.success && data.url) {
        sendFileMessage(data.url, file.name, forceType || file.type, true, null, version);
      }
    } catch (err) {
      console.error("Upload error:", err);
      alert("Large file upload failed. Check server logs.");
    } finally {
      setUploading(false);
      setUploadProgress(0);
      setShowAttachMenu(false);
    }
  };

  const handleFileSelect = (e, type = null) => {
    const file = e.target.files[0];
    if (file) uploadFile(file, type);
    e.target.value = ""; // reset
  };


  const handleEmojiClick = (emojiData) => {
    // console.log('Emoji clicked:', emojiData);
    if (emojiData && emojiData.emoji) {
      setText(prev => prev + emojiData.emoji);
    }
  };

  // --- Camera Handlers (Desktop) ---

  const handleCameraClick = () => {
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

    if (isMobile) {
      // Use native file picker with capture on mobile
      cameraInputRef.current?.click();
    } else {
      // Use custom camera modal on desktop
      setShowCameraModal(true);
      setShowAttachMenu(false);
    }
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      setCameraStream(stream);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error("Camera error:", err);
      alert("Could not access camera. Please allow permissions.");
      setShowCameraModal(false);
    }
  };

  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
    }
    setShowCameraModal(false);
  };

  const takePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const width = videoRef.current.videoWidth;
    const height = videoRef.current.videoHeight;

    canvasRef.current.width = width;
    canvasRef.current.height = height;

    const ctx = canvasRef.current.getContext('2d');
    ctx.drawImage(videoRef.current, 0, 0, width, height);

    canvasRef.current.toBlob((blob) => {
      const file = new File([blob], `photo-${Date.now()}.jpg`, { type: 'image/jpeg' });
      uploadFile(file, 'image'); // Upload immediately
      stopCamera();
    }, 'image/jpeg', 0.8);
  };

  // Auto-start camera when modal opens
  useEffect(() => {
    if (showCameraModal) {
      startCamera();
    } else {
      if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
        setCameraStream(null);
      }
    }
  }, [showCameraModal, cameraStream]);


  // --- GIF & Sticker Handlers ---

  const fetchGiphy = async (type = 'gifs', query = "") => {
    setLoadingGifs(true);
    setGiphyError(null);
    try {
      // Use backend proxy to avoid CORS/Network issues
      const endpoint = query
        ? `/api/giphy?type=${type}&q=${encodeURIComponent(query)}&limit=20`
        : `/api/giphy?type=${type}&limit=20`;

      const res = await fetch(endpoint);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.meta?.msg || data?.message || `API Error: ${res.status}`);
      }

      if (data.data) {
        if (type === 'gifs') setGifResults(data.data);
        else setStickerResults(data.data);
      }
    } catch (err) {
      console.error("GIPHY fetch error:", err);
      setGiphyError(err.message);
    } finally {
      setLoadingGifs(false);
    }
  };

  useEffect(() => {
    if (activePickerTab === 'gif' && gifResults.length === 0) {
      fetchGiphy('gifs');
    }
    if (activePickerTab === 'sticker' && stickerResults.length === 0) {
      fetchGiphy('stickers');
    }
  }, [activePickerTab, gifResults.length, stickerResults.length]);

  const handleMediaSelect = (item, type) => {
    // GIFs and Stickers usually stick to 'image' for chat rendering
    const url = item?.images?.fixed_height?.url || item?.images?.original?.url;
    if (!url) return;

    sendFileMessage(url, type === 'sticker' ? "Sticker" : "GIF", "image/gif");
    setShowEmojiPicker(false);
  };

  // const stickers = [...]; // Removing hardcoded stickers

  const sendFileMessage = (fileUrl, fileName, mimeType, encrypted = false, iv = null, version = 'v1') => {
    if (!socket) return;

    const msgId = Date.now().toString() + Math.random().toString(36).substr(2, 9);
    const isImage = mimeType?.startsWith("image/");
    const isAudio = mimeType?.startsWith("audio/");
    const isVideo = mimeType?.startsWith("video/");

    const messagePayload = {
      msgId,
      type: isImage ? 'image' : isAudio ? 'audio' : isVideo ? 'video' : 'file',
      fileUrl,
      imageUrl: isImage ? fileUrl : null, // backward compatibility
      audioUrl: isAudio ? fileUrl : null, // for audio messages
      fileName: fileName || "Attachment",
      mimeType,
      encrypted, // Mark if file content is encrypted
      iv,
      version,
      text: encryptMessage(isImage ? "📷 Photo" : isAudio ? "🎵 Voice Message" : isVideo ? "🎥 Video" : `📄 ${fileName || "File"}`),
      time: new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit"
      }),
      timestamp: Date.now(),
      replyTo: currentReply ? {
        text: encryptMessage(currentReply.text),
        from: currentReply.fromMe || currentReply.from === user.uid ? 'me' : currentReply.from,
        msgId: currentReply.msgId || currentReply.timestamp
      } : null
    };

    if (toUser.startsWith("group_")) {
      socket.emit("group-message", {
        groupId: toUser,
        from: user.uid,
        message: messagePayload
      });
    } else {
      socket.emit("send-message", {
        to: toUser,
        from: user.uid,
        message: messagePayload
      });
    }

    onSendMessage(messagePayload);
    if (currentReply) clearReplyTo(toUser);
  };

  const sendMessage = () => {
    if (!text.trim() || !socket) return;

    if (initialText) {
      onUpdateMessage(text.trim());
      setText("");
      if (onCancelEditing) onCancelEditing();
      return;
    }

    const msgId = Date.now().toString() + Math.random().toString(36).substr(2, 9);

    const messagePayload = {
      msgId,
      text: encryptMessage(text.trim()),
      time: new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit"
      }),
      timestamp: Date.now(),
      replyTo: currentReply ? {
        text: encryptMessage(currentReply.text),
        from: currentReply.fromMe || currentReply.from === user.uid ? 'me' : currentReply.from,
        msgId: currentReply.msgId || currentReply.timestamp
      } : null
    };

    if (toUser.startsWith("group_")) {
      socket.emit("group-message", {
        groupId: toUser,
        from: user.uid,
        message: messagePayload
      });
    } else {
      socket.emit("send-message", {
        to: toUser,
        from: user.uid,
        message: messagePayload
      });
    }

    onSendMessage(messagePayload);
    setText("");
    if (currentReply) clearReplyTo(toUser);

    if (!toUser.startsWith("group_")) {
      socket.emit("stop-typing", { to: toUser });
    }
  };

  const handleTyping = () => {
    if (!socket) return;
    socket.emit("typing", { to: toUser });
    clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      socket.emit("stop-typing", { to: toUser });
    }, 1200);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // --- RENDER ---

  if (isRecording) {
    return (
      <div className="chat-input-container recording-mode" style={{
        display: 'flex', alignItems: 'center', gap: '15px', padding: '10px 15px',
        background: 'var(--bg-secondary)', borderRadius: '12px', border: '1px solid var(--border)',
        animation: 'slideUp 0.2s ease-out'
      }}>
        <style>{`
          @keyframes slideUp { from { transform: translateY(10px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
          @keyframes pulse-red { 0% { opacity: 1; transform: scale(1); } 50% { opacity: 0.5; transform: scale(1.1); } 100% { opacity: 1; transform: scale(1); } }
        `}</style>

        {/* Cancel Button */}
        <button
          onClick={cancelRecording}
          className="icon-btn delete-btn"
          style={{ color: '#ff4757', padding: '10px', background: 'rgba(255,71,87,0.1)', borderRadius: '50%' }}
          title="Cancel Recording"
        >
          <X size={24} />
        </button>

        {/* Timer & Visuals */}
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '12px', justifyContent: 'center' }}>
          <div style={{
            width: '12px', height: '12px', borderRadius: '50%', background: '#ff4757',
            animation: isPaused ? 'none' : 'pulse-red 1.5s infinite',
            opacity: isPaused ? 0.5 : 1
          }} />
          <span style={{ fontSize: '1.2rem', fontWeight: 'bold', fontFamily: 'monospace', color: 'var(--text-primary)' }}>
            {formatTime(recordingDuration)}
          </span>
          <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
            {isPaused ? "(Paused)" : "Recording..."}
          </span>
        </div>

        {/* Controls */}
        <div style={{ display: 'flex', gap: '10px' }}>
          {isPaused ? (
            <button onClick={resumeRecording} className="icon-btn" style={{ color: 'var(--primary-color)', padding: '8px' }}>
              {/* Play Icon equivalent */}
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
            </button>
          ) : (
            <button onClick={pauseRecording} className="icon-btn" style={{ color: 'var(--text-secondary)', padding: '8px' }}>
              {/* Pause Icon equivalent */}
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>
            </button>
          )}

          <button
            onClick={stopRecording}
            className="send-btn"
            style={{
              background: 'var(--primary-color)', color: 'white', border: 'none', borderRadius: '50%',
              width: '45px', height: '45px', display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', boxShadow: '0 4px 12px rgba(102,0,153,0.3)'
            }}>
            <Send size={20} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="chat-input-wrapper-modern">
      {uploading && (
        <div style={{
          position: 'absolute', top: '-10px', left: '10px', right: '10px',
          height: '4px', background: 'rgba(0,0,0,0.1)', borderRadius: '2px', overflow: 'hidden',
          zIndex: 10
        }}>
          <div style={{
            width: `${uploadProgress}%`, height: '100%',
            background: 'var(--accent-primary, #5e5ae7)', transition: 'width 0.3s ease'
          }} />
        </div>
      )}
      {/* Hidden File Inputs */}
      <input type="file" ref={fileInputRef} onChange={(e) => handleFileSelect(e)} style={{ display: 'none' }} accept="image/*" />
      <input type="file" ref={cameraInputRef} onChange={(e) => handleFileSelect(e)} style={{ display: 'none' }} accept="image/*" capture="camera" />
      <input type="file" ref={docInputRef} onChange={(e) => handleFileSelect(e, 'file')} style={{ display: 'none' }} />
      <input type="file" ref={audioInputRef} onChange={(e) => handleFileSelect(e, 'audio')} style={{ display: 'none' }} accept="audio/*" />

      {/* Attachment Menu Popup */}
      {showAttachMenu && (
        <>
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 999 }}
            onClick={() => setShowAttachMenu(false)}
          />
          <div className="attachment-menu-container">
            <div className="attach-item" onClick={() => fileInputRef.current?.click()}>
              <div className="attach-icon-wrapper" style={{ background: '#5e5ae7' }}><ImageIcon size={22} /></div>
              <span className="attach-label">Gallery</span>
            </div>
            <div className="attach-item" onClick={handleCameraClick}>
              <div className="attach-icon-wrapper" style={{ background: '#ff4b8c' }}><Camera size={22} /></div>
              <span className="attach-label">Camera</span>
            </div>
            <div className="attach-item" onClick={handleLocation}>
              <div className="attach-icon-wrapper" style={{ background: '#1ba34e' }}><MapPin size={22} /></div>
              <span className="attach-label">Location</span>
            </div>
            <div className="attach-item" onClick={() => docInputRef.current?.click()}>
              <div className="attach-icon-wrapper" style={{ background: '#7f66ff' }}><FileText size={22} /></div>
              <span className="attach-label">Document</span>
            </div>
            <div className="attach-item" onClick={() => audioInputRef.current?.click()}>
              <div className="attach-icon-wrapper" style={{ background: '#ff9c3a' }}><Headphones size={22} /></div>
              <span className="attach-label">Audio</span>
            </div>
          </div>
        </>
      )}

      {/* Camera Modal (Desktop) */}
      {showCameraModal && createPortal(
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9999999,
          background: 'black', display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center'
        }}>
          <video
            ref={videoRef}
            autoPlay
            playsInline
            style={{ width: '100%', maxWidth: '800px', height: 'auto', borderRadius: '12px', transform: 'scaleX(-1)' }}
          />
          <canvas ref={canvasRef} style={{ display: 'none' }} />

          <div style={{
            position: 'absolute', bottom: '40px',
            display: 'flex', gap: '30px', alignItems: 'center'
          }}>
            <button
              onClick={stopCamera}
              style={{ padding: '12px', borderRadius: '50%', background: 'rgba(255,255,255,0.2)', border: 'none', color: 'white' }}
            >
              <X size={32} />
            </button>
            <button
              onClick={takePhoto}
              style={{
                width: '80px', height: '80px', borderRadius: '50%',
                background: 'white', border: '5px solid #ccc',
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}
            />
            {/* Simple spacer or switch camera button could go here */}
            <div style={{ width: '56px' }}></div>
          </div>
        </div>
        , document.body)}

      {/* Reply Preview */}
      {currentReply && (
        <div style={{
          position: 'absolute', bottom: '70px', left: '12px', right: '12px',
          padding: '10px 15px', background: '#e1f5fe', borderRadius: '12px',
          borderLeft: '4px solid #039be5', display: 'flex', justifyContent: 'space-between',
          alignItems: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
        }}>
          <div style={{ fontSize: '0.8rem', overflow: 'hidden' }}>
            <div style={{ fontWeight: 'bold', color: '#039be5' }}>Replying to {currentReply.fromMe ? 'You' : currentReply.from}</div>
            <div style={{ color: '#555', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{currentReply.text}</div>
          </div>
          <X size={16} style={{ cursor: 'pointer' }} onClick={() => clearReplyTo(toUser)} />
        </div>
      )}

      <div className="input-pill">
        <button className="inline-icon-btn" onClick={() => setShowEmojiPicker(true)}>
          <Smile size={24} />
        </button>

        <textarea
          ref={inputRef}
          className="chat-input-modern"
          placeholder="Message"
          value={text}
          rows={1}
          onChange={(e) => {
            setText(e.target.value);
            handleTyping();
            e.target.style.height = 'auto';
            e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
          }}
          onKeyDown={handleKeyDown}
        />

        <button className="inline-icon-btn" onClick={() => setShowAttachMenu(!showAttachMenu)}>
          <Paperclip size={22} />
        </button>

        {!text.trim() && (
          <button className="inline-icon-btn" onClick={handleCameraClick}>
            <Camera size={22} />
          </button>
        )}
      </div>

      {text.trim() || initialText ? (
        <button className="mic-circle-btn" onClick={sendMessage}>
          {initialText ? <CheckCheck size={24} /> : <Send size={24} style={{ marginLeft: '2px' }} />}
        </button>
      ) : (
        <button
          className={`mic-circle-btn ${isRecording ? 'recording' : ''}`}
          onMouseDown={startRecording}
          onMouseUp={stopRecording}
          onTouchStart={startRecording}
          onTouchEnd={stopRecording}
        >
          <Mic size={24} />
        </button>
      )}

      {/* Emoji Picker Portal */}
      {showEmojiPicker && createPortal(
        <div style={{
          position: 'fixed', inset: 0, zIndex: 999999,
          display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
          background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)'
        }}>
          <div style={{ position: 'absolute', inset: 0 }} onClick={() => setShowEmojiPicker(false)} />
          <div
            className="picker-tabs-container"
            style={{ width: window.innerWidth < 500 ? '100%' : '400px', height: '50vh', position: 'relative', zIndex: 10 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="picker-tabs-header">
              <button className={`picker-tab-btn ${activePickerTab === 'emoji' ? 'active' : ''}`} onClick={() => setActivePickerTab('emoji')}>Emoji</button>
              <button className={`picker-tab-btn ${activePickerTab === 'gif' ? 'active' : ''}`} onClick={() => setActivePickerTab('gif')}>GIF</button>
              <button className={`picker-tab-btn ${activePickerTab === 'sticker' ? 'active' : ''}`} onClick={() => setActivePickerTab('sticker')}>Stickers</button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto' }}>
              {activePickerTab === 'emoji' && (
                <EmojiPicker
                  onEmojiClick={(data) => {
                    handleEmojiClick(data);
                    // setShowEmojiPicker(false); // keep it open like WhatsApp
                  }}
                  width="100%"
                  height="100%"
                  previewConfig={{ showPreview: false }}
                  skinTonesDisabled
                  autoFocusSearch={false}
                />
              )}
              {activePickerTab === 'gif' && (
                <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                  <div style={{ padding: '8px' }}>
                    <input
                      type="text"
                      placeholder="Search GIFs..."
                      style={{ width: '100%', padding: '10px', borderRadius: '20px', border: '1px solid #ddd', outline: 'none' }}
                      value={gifQuery}
                      onChange={(e) => {
                        setGifQuery(e.target.value);
                        fetchGiphy('gifs', e.target.value);
                      }}
                    />
                  </div>
                  <div style={{ flex: 1, overflowY: 'auto', display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '4px', padding: '4px' }}>
                    {loadingGifs ? (
                      <div style={{ gridColumn: '1/3', textAlign: 'center', padding: '20px' }}><Loader2 className="animate-spin" size={24} /></div>
                    ) : giphyError ? (
                      <div style={{ gridColumn: '1/3', textAlign: 'center', padding: '20px', color: 'red' }}>
                        <p>Failed to load GIFs</p>
                        <small>{giphyError}</small>
                        <button onClick={() => fetchGiphy('gifs', gifQuery)} style={{ marginTop: '10px', padding: '5px 10px', fontSize: '0.8rem' }}>Retry</button>
                      </div>
                    ) : (
                      Array.isArray(gifResults) && gifResults.map(gif => {
                        const url = gif?.images?.fixed_height?.url || gif?.images?.original?.url;
                        if (!url) return null;
                        return (
                          <img
                            key={gif.id}
                            src={url}
                            alt="GIF"
                            style={{ width: '100%', height: '120px', objectFit: 'cover', cursor: 'pointer', borderRadius: '8px' }}
                            onClick={() => handleMediaSelect(gif, 'gif')}
                          />
                        );
                      })
                    )}
                  </div>
                </div>
              )}
              {activePickerTab === 'sticker' && (
                <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                  <div style={{ padding: '8px' }}>
                    <input
                      type="text"
                      placeholder="Search Stickers..."
                      style={{ width: '100%', padding: '10px', borderRadius: '20px', border: '1px solid #ddd', outline: 'none' }}
                      onChange={(e) => fetchGiphy('stickers', e.target.value)}
                    />
                  </div>
                  <div style={{ padding: '8px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', overflowY: 'auto', flex: 1 }}>
                    {loadingGifs ? (
                      <div style={{ gridColumn: '1/4', textAlign: 'center', padding: '20px' }}><Loader2 className="animate-spin" size={24} /></div>
                    ) : giphyError ? (
                      <div style={{ gridColumn: '1/4', textAlign: 'center', padding: '20px', color: 'red' }}>
                        <p>Failed to load Stickers</p>
                        <small>{giphyError}</small>
                        <button onClick={() => fetchGiphy('stickers')} style={{ marginTop: '10px', padding: '5px 10px', fontSize: '0.8rem' }}>Retry</button>
                      </div>
                    ) : (
                      Array.isArray(stickerResults) && stickerResults.map(s => {
                        const url = s?.images?.fixed_height?.url || s?.images?.original?.url;
                        if (!url) return null;
                        return (
                          <img
                            key={s.id}
                            src={url}
                            alt="Sticker"
                            style={{ width: '100%', cursor: 'pointer', borderRadius: '8px' }}
                            onClick={() => handleMediaSelect(s, 'sticker')}
                          />
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
        , document.body)}
    </div>
  );
}
