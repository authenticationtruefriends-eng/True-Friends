import { useState, useRef, useEffect, useMemo } from "react";
import { Check, CheckCheck, Smile, Trash2, MoreVertical, Reply, Pin, Headphones, MapPin, Play, Pause, Copy, Loader2, FileText } from "lucide-react";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import ImageModal from "../common/ImageModal";
import { useChat } from "../../context/ChatContext";
import { useAuth } from "../../context/AuthContext";
import Skeleton from "../common/Skeleton";
import { getConstructedUrl, isExternalUrl } from "../../utils/urlHelper";
import { decryptMessage, decryptFileToBlob } from "../../utils/encryption";
import { decryptionCache } from "../../utils/decryptionCache";
import AudioPlayer from "./AudioPlayer";


// Custom Code Block Component with Copy
const CodeBlock = ({ inline, className, children, ...props }) => {
  const [copied, setCopied] = useState(false);
  const match = /language-(\w+)/.exec(className || '');
  const lang = match ? match[1] : '';

  if (inline) {
    return (
      <code
        style={{
          background: 'rgba(0,0,0,0.1)',
          padding: '2px 4px',
          borderRadius: '4px',
          fontSize: '0.9em',
          fontFamily: 'monospace'
        }}
        className={className}
        {...props}
      >
        {children}
      </code>
    );
  }

  const handleCopy = async () => {
    const textToCopy = String(children).replace(/\n$/, '');

    try {
      // Try modern API first
      await navigator.clipboard.writeText(textToCopy);
      setCopied(true);
    } catch {
      // Fallback for HTTP/Non-Secure contexts
      try {
        const textArea = document.createElement("textarea");
        textArea.value = textToCopy;

        // Ensure it's not visible but part of DOM
        textArea.style.position = "fixed";
        textArea.style.left = "-9999px";
        textArea.style.top = "0";
        document.body.appendChild(textArea);

        textArea.focus();
        textArea.select();

        const successful = document.execCommand('copy');
        document.body.removeChild(textArea);

        if (successful) {
          setCopied(true);
        } else {
          console.error("Fallback copy failed");
        }
      } catch (fallbackErr) {
        console.error("Copy failed:", fallbackErr);
      }
    }

    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div style={{ position: 'relative', margin: '8px 0', borderRadius: '8px', overflow: 'hidden' }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        background: 'var(--bg-tertiary)',
        color: 'var(--text-primary)',
        padding: '4px 12px',
        fontSize: '0.75rem',
        borderBottom: '1px solid var(--border-color)'
      }}>
        <span style={{ fontWeight: '600', textTransform: 'uppercase' }}>{lang || 'Code'}</span>
        <button
          onClick={handleCopy}
          style={{
            background: 'transparent',
            border: 'none',
            color: copied ? '#4ade80' : '#a0a0a0',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            fontSize: '0.75rem'
          }}
        >
          {copied ? <Check size={14} /> : <Copy size={14} />}
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
      <div style={{
        background: 'var(--bg-tertiary)',
        padding: '12px',
        overflowX: 'auto',
        color: '#d4d4d4'
      }}>
        <code style={{ fontFamily: 'Consolas, Monaco, "Andale Mono", "Ubuntu Mono", monospace', fontSize: '0.9rem', display: 'block' }} {...props}>
          {children}
        </code>
      </div>
    </div>
  );
};

// Custom Markdown Image Component
const MarkdownImage = ({ src, alt, onImageClick, ...props }) => {
  return (
    <img
      src={src}
      alt={alt || "Image"}
      style={{
        maxWidth: '100%',
        width: '250px',
        height: 'auto',
        borderRadius: '12px',
        cursor: 'zoom-in',
        margin: '10px 0',
        border: '1px solid rgba(255,255,255,0.1)',
        boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
        display: 'block'
      }}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (onImageClick) onImageClick(src);
      }}
      {...props}
    />
  );
};

export default function MessageBubble({ message, isMine, chatId, onImageClick, onEdit }) {
  const { user } = useAuth();
  const { addReaction, deleteMessage, setReplyTo, groups, showToast } = useChat();
  const [showPicker, setShowPicker] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showDeleteMenu, setShowDeleteMenu] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [modalImage, setModalImage] = useState(null); // For Markdown Images
  const menuRef = useRef(null);

  const MAX_RETRIES = 2;
  const emojis = ["👍", "❤️", "😂", "😮", "😢", "🔥"];

  // Decrypt message text for display
  const displayText = message.text ? decryptMessage(message.text) : message.text;

  // State for decrypted file URL
  const [decryptedFileUrl, setDecryptedFileUrl] = useState(null);
  const [manualDecryptedUrl, setManualDecryptedUrl] = useState(null);
  const [isDecrypting, setIsDecrypting] = useState(false);

  // Helper function to detect if a URL is an image based on file extension
  const isImageUrl = (url) => {
    if (!url) return false;
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg'];
    const urlLower = url.toLowerCase();
    return imageExtensions.some(ext => urlLower.endsWith(ext));
  };

  // Decrypt encrypted files with caching and retry logic
  useEffect(() => {
    const decryptFileIfNeeded = async () => {
      const fileUrl = message.imageUrl || message.fileUrl || message.audioUrl;

      // Check if file is encrypted
      if (!message.encrypted || !fileUrl) {
        return;
      }

      // Safeguard: Don't auto-decrypt very large files to prevent browser lag (50MB threshold)
      if (message.size > 50 * 1024 * 1024) {
        console.log('Skipping auto-decryption for large file:', message.fileName);
        return;
      }

      // Check cache first
      const cached = decryptionCache.get(fileUrl);
      if (cached) {
        setDecryptedFileUrl(cached);
        return;
      }

      // Check if already decrypting (prevent race condition)
      const pending = decryptionCache.getPending(fileUrl);
      if (pending) {
        try {
          const result = await pending;
          setDecryptedFileUrl(result);
        } catch {
          // Error handled in pending promise
        }
        return;
      }

      // Start new decryption
      setIsDecrypting(true);

      const decryptionPromise = (async () => {
        try {
          // Fetch the encrypted file as ArrayBuffer for binary safety
          const response = await fetch(fileUrl);
          if (!response.ok) {
            throw new Error(`Failed to fetch encrypted file: ${response.status}`);
          }

          const buffer = await response.arrayBuffer();
          let rawData = buffer;
          let extractedMimeType = message.mimeType;
          let iv = message.iv;
          let version = message.version || 'v1';

          // Check if it's a JSON file (legacy/legacy-style)
          try {
            const firstChars = new TextDecoder().decode(buffer.slice(0, 10));
            if (firstChars.trim().startsWith('{')) {
              const textContent = new TextDecoder().decode(buffer);
              const json = JSON.parse(textContent);
              if (json.encryptedData || json.content) {
                rawData = json.encryptedData || json.content;
                extractedMimeType = json.mimeType || extractedMimeType;
                iv = json.iv || iv;
                version = json.version || version;
              }
            }
          } catch {
            // Not JSON or contains non-UTF8 chars, treat as raw binary
          }

          // Decrypt directly to Blob then create Object URL
          // Much more memory efficient than Base64 Data URL for large files
          const blob = await decryptFileToBlob(rawData, extractedMimeType, iv, version);
          const objectUrl = URL.createObjectURL(blob);

          // Cache the result
          decryptionCache.set(fileUrl, objectUrl, {
            mimeType: extractedMimeType,
            size: blob.size
          });

          return objectUrl;
        } catch (error) {
          console.error('❌ File decryption failed:', error);
          throw error;
        }
      })();

      // Track pending decryption
      decryptionCache.setPending(fileUrl, decryptionPromise);

      try {
        const objectUrl = await decryptionPromise;
        setDecryptedFileUrl(objectUrl);
      } catch {
        // Error already logged
      } finally {
        setIsDecrypting(false);
      }
    };

    decryptFileIfNeeded();
  }, [message.encrypted, message.imageUrl, message.fileUrl, message.audioUrl, message.mimeType, message.size, message.fileName, message.iv, message.version]);

  // Helper for manual decryption of large files
  const handleManualDecrypt = async () => {
    const fileUrl = message.imageUrl || message.fileUrl || message.audioUrl;
    if (!fileUrl || isDecrypting) return;

    setIsDecrypting(true);
    try {
      const response = await fetch(fileUrl);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const buffer = await response.arrayBuffer();
      let rawData = buffer;
      let extractedMimeType = message.mimeType;
      let iv = message.iv;
      let version = message.version || 'v1';

      try {
        const firstChars = new TextDecoder().decode(buffer.slice(0, 10));
        if (firstChars.trim().startsWith('{')) {
          const textContent = new TextDecoder().decode(buffer);
          const json = JSON.parse(textContent);
          if (json.encryptedData || json.content) {
            rawData = json.encryptedData || json.content;
            extractedMimeType = json.mimeType || extractedMimeType;
            iv = json.iv || iv;
            version = json.version || version;
          }
        }
      } catch { /* Not JSON */ }

      const blob = await decryptFileToBlob(rawData, extractedMimeType, iv, version);
      const objectUrl = URL.createObjectURL(blob);

      // Cache the result
      decryptionCache.set(fileUrl, objectUrl, {
        mimeType: extractedMimeType,
        size: blob.size
      });

      setManualDecryptedUrl(objectUrl);
    } catch (error) {
      console.error('Manual decryption failed:', error);
      alert('Failed to decrypt file: ' + error.message);
    } finally {
      setIsDecrypting(false);
    }
  };


  // Determine if this message should be displayed as an image
  const isAudio = message.type === 'audio' ||
    message.mimeType?.startsWith('audio/') ||
    message.mimeType?.includes('audio') ||
    (message.fileName && message.fileName.includes('voice-note'));

  const isVideo = message.type === 'video' ||
    message.mimeType?.startsWith('video/') ||
    message.mimeType?.includes('video');

  const showDecryptButton = message.encrypted && message.size > 50 * 1024 * 1024 && !decryptedFileUrl && !manualDecryptedUrl;

  const isPdf = message.type === 'file' && (
    message.mimeType === 'application/pdf' ||
    message.fileName?.toLowerCase().endsWith('.pdf')
  );

  const shouldShowAsImage = !isAudio && !isVideo && !isPdf && !showDecryptButton && (
    !!decryptedFileUrl ||
    !!manualDecryptedUrl ||
    message.type === 'image' ||
    message.mimeType?.startsWith('image/') ||
    isImageUrl(message.imageUrl || message.fileUrl)
  ) && (decryptedFileUrl || manualDecryptedUrl || message.imageUrl || message.fileUrl);

  // Construct image URL with cache-busting
  // Use decrypted URL if available, otherwise use original
  const rawImageUrl = decryptedFileUrl || manualDecryptedUrl || message.imageUrl || message.fileUrl;
  const constructedImageUrl = decryptedFileUrl || manualDecryptedUrl || getConstructedUrl(rawImageUrl);
  const isExternal = isExternalUrl(rawImageUrl);
  // Use a stable timestamp for cache busting to prevent reloading on every render
  const [timestamp] = useState(Date.now());
  const cacheBustedUrl = decryptedFileUrl || manualDecryptedUrl || (constructedImageUrl + (constructedImageUrl.includes('?') ? '&' : '?') + `t=${timestamp}-${retryCount}`);

  // Moved components inside useMemo to follow Hook rules
  const markdownComponents = useMemo(() => ({
    p: (props) => <p style={{ margin: '0 0 8px 0' }} {...props} />,
    ul: (props) => <ul style={{ paddingLeft: '20px', margin: '4px 0 10px 0' }} {...props} />,
    ol: (props) => <ol style={{ paddingLeft: '20px', margin: '4px 0 10px 0' }} {...props} />,
    li: (props) => <li style={{ margin: '2px 0' }} {...props} />,
    h1: (props) => <h1 style={{ fontSize: '1.2rem', fontWeight: 'bold', margin: '10px 0 6px 0' }} {...props} />,
    h2: (props) => <h2 style={{ fontSize: '1.1rem', fontWeight: 'bold', margin: '8px 0 4px 0' }} {...props} />,
    h3: (props) => <h3 style={{ fontSize: '1rem', fontWeight: 'bold', margin: '6px 0 4px 0' }} {...props} />,
    strong: (props) => <strong style={{ fontWeight: '700' }} {...props} />,
    code: CodeBlock,
    img: (props) => <MarkdownImage {...props} onImageClick={setModalImage} />,
    table: (props) => <table style={{ borderCollapse: 'collapse', width: '100%', margin: '10px 0' }} {...props} />,
    th: (props) => <th style={{ border: '1px solid currentColor', padding: '6px', textAlign: 'left', opacity: 0.8 }} {...props} />,
    td: (props) => <td style={{ border: '1px solid currentColor', padding: '6px', opacity: 0.9 }} {...props} />,
    a: (props) => <a style={{ textDecoration: 'underline', color: 'inherit', pointerEvents: 'auto' }} target="_blank" rel="noopener noreferrer" {...props} />
  }), []);

  const handleReaction = (emoji) => {
    addReaction(chatId, message.msgId || message.timestamp || message.id, emoji);
    setShowPicker(false);
    setShowMenu(false);
  };

  const handleDeleteForMe = () => {
    deleteMessage(chatId, message.msgId || message.timestamp, 'local');
    setShowDeleteMenu(false);
    setShowMenu(false);
  };

  const handleDeleteForEveryone = () => {
    deleteMessage(chatId, message.msgId || message.timestamp, 'everyone');
    setShowDeleteMenu(false);
    setShowMenu(false);
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setShowMenu(false);
        setShowPicker(false);
      }
    };

    const handleEscKey = (event) => {
      if (event.key === 'Escape') {
        setShowMenu(false);
        setShowPicker(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscKey);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscKey);
    };
  }, []);

  // Timeout for stuck images - treat as error after 10s
  useEffect(() => {
    if (shouldShowAsImage && !imageLoaded && !imageError && retryCount < MAX_RETRIES) {
      const timer = setTimeout(() => {
        if (!imageLoaded && !imageError) {
          console.warn('🕒 Image load timeout - retry', retryCount + 1);
          setRetryCount(prev => prev + 1);
          setImageError(false); // Reset to retry
          setImageLoaded(false);
        }
      }, 10000);
      return () => clearTimeout(timer);
    } else if (retryCount >= MAX_RETRIES && !imageLoaded) {
      setImageError(true); // Final failure
    }
  }, [shouldShowAsImage, imageLoaded, imageError, message, retryCount]);

  // Debug logging for image messages
  // Debug logging for image messages
  useEffect(() => {
    // Logging removed to keep console clean
  }, [message]);

  const reactions = message.reactions || {};
  const isDeleted = message.isDeleted;

  const scrollToOriginal = (msgId) => {
    const id = msgId?.toString();
    const el = document.getElementById(`msg-${id}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      const originalBg = el.style.backgroundColor;
      el.style.backgroundColor = 'rgba(102, 0, 153, 0.2)';
      setTimeout(() => el.style.backgroundColor = originalBg, 1500);
    }
  };

  const menuItemStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '12px 18px',
    border: 'none',
    background: 'transparent',
    cursor: 'pointer',
    color: '#1a1a1a',
    width: '100%',
    textAlign: 'left',
    fontSize: '14px',
    fontWeight: '600',
    transition: 'background 0.2s',
  };

  const isGroup = chatId?.startsWith("group_");
  const bubbleId = (message.msgId || message.timestamp || message.id)?.toString();


  return (
    <div
      id={`msg-${bubbleId}`}
      className={`message-container ${isMine ? "mine" : ""}`}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: isMine ? 'flex-end' : 'flex-start',
        position: 'relative',
        marginBottom: '15px',
        width: '100%',
        paddingRight: isMine ? '0' : '65px',
        paddingLeft: isMine ? '65px' : '0',
        zIndex: (showMenu || showPicker) ? 5000 : 1
      }}
    >
      {/* Sender Name for Group Chats */}
      {isGroup && !isMine && (
        <div style={{
          fontSize: '0.75rem',
          color: '#666',
          marginBottom: '2px',
          marginLeft: '4px',
          fontWeight: '600'
        }}>
          {message.from}
        </div>
      )}

      <div className={`message ${isMine ? "mine" : ""}`} style={{
        position: 'relative',
        fontStyle: isDeleted ? 'italic' : 'normal',
        opacity: isDeleted ? 0.7 : 1,
        background: isDeleted
          ? (isMine ? 'var(--primary-dark)' : 'var(--border-color)')
          : (isMine ? 'linear-gradient(135deg, var(--primary-color), var(--primary-light))' : 'var(--glass-bg)'),
        color: isDeleted
          ? (isMine ? 'var(--message-sent-text)' : 'var(--text-secondary)')
          : (isMine ? 'var(--message-sent-text)' : 'var(--text-primary)'),
        backdropFilter: !isMine ? 'blur(8px)' : 'none',
        WebkitBackdropFilter: !isMine ? 'blur(8px)' : 'none',
        maxWidth: '85%',
        borderRadius: '18px',
        borderBottomRightRadius: isMine ? '4px' : '18px',
        borderBottomLeftRadius: isMine ? '18px' : '4px',
        padding: '12px 16px',
        boxShadow: isMine ? '0 4px 12px rgba(102, 0, 153, 0.15)' : 'var(--shadow-sm)',
        border: !isMine ? '1px solid var(--glass-border)' : 'none',
        zIndex: 2,
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
      }}>
        {/* Quoted Message */}
        {message.replyTo && (
          <div
            onClick={() => scrollToOriginal(message.replyTo.msgId)}
            style={{
              background: isMine ? 'rgba(0,0,0,0.15)' : 'rgba(102, 0, 153, 0.05)',
              borderLeft: `3px solid ${isMine ? '#ffffff' : 'var(--primary-color)'}`,
              padding: '6px 10px',
              borderRadius: '6px',
              marginBottom: '8px',
              fontSize: '0.8rem',
              color: 'inherit',
              cursor: 'pointer',
              userSelect: 'none'
            }}
          >
            <div style={{ fontWeight: 'bold', fontSize: '0.7rem', marginBottom: '2px' }}>
              {message.replyTo.from === 'me' || message.replyTo.fromMe ? 'You' : message.replyTo.from}
            </div>
            <div style={{
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              opacity: 0.8
            }}>
              {decryptMessage(message.replyTo.text)}
            </div>
          </div>
        )}

        {/* Image Preview - Check both type and mimeType for robustness */}
        {shouldShowAsImage && !isDeleted ? (
          <div style={{ marginBottom: '10px', borderRadius: '12px', overflow: 'hidden', position: 'relative', minHeight: '100px', minWidth: '150px' }}>
            {/* Error State */}
            {imageError ? (
              <div style={{
                color: 'var(--text-secondary)',
                padding: '15px',
                textAlign: 'center',
                background: isMine ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.03)',
                border: '1px dashed #ffa0a0',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '8px',
                width: '100%',
                minWidth: '200px',
                borderRadius: '12px'
              }}>
                <div style={{ fontSize: '1.2rem' }}>🖼️</div>
                <p style={{ margin: 0, fontSize: '0.7rem', color: isMine ? '#fff' : '#cc0000', fontWeight: '500' }}>Failed to load image</p>
                <p style={{ fontSize: '10px', color: '#666', background: '#fff', padding: '2px', borderRadius: '4px', maxWidth: '200px', overflowWrap: 'anywhere', maxHeight: '40px', overflow: 'hidden' }}>
                  {/* Truncate long Base64 strings in error display */}
                  {constructedImageUrl?.length > 100 ? constructedImageUrl.substring(0, 50) + '...' : constructedImageUrl}
                </p>
                <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', justifyContent: 'center' }}>
                  <button
                    onClick={(e) => { e.stopPropagation(); window.open(constructedImageUrl, '_blank'); }}
                    style={{ border: 'none', background: 'rgba(255,255,255,0.2)', color: 'inherit', padding: '4px 8px', borderRadius: '8px', fontSize: '0.6rem', cursor: 'pointer' }}
                  >
                    Open Link
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); window.location.reload(); }}
                    style={{ border: 'none', background: 'var(--primary)', color: 'white', padding: '4px 8px', borderRadius: '8px', fontSize: '0.6rem', cursor: 'pointer' }}
                  >
                    Refresh
                  </button>
                </div>
              </div>
            ) : (
              <>
                {(!imageLoaded || (message.encrypted && !decryptedFileUrl && !manualDecryptedUrl)) && (
                  <div style={{ position: 'relative' }}>
                    <Skeleton width="100%" height="200px" borderRadius="12px" />
                    <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', color: '#999', fontSize: '0.8rem', fontWeight: 'bold' }}>
                      {message.encrypted && !decryptedFileUrl && !manualDecryptedUrl ? 'Decrypting...' : 'Loading Image...'}
                    </div>
                  </div>
                )}
                {!imageError && (!message.encrypted || decryptedFileUrl || manualDecryptedUrl) && (
                  <img
                    key={`img-${message.msgId}-${retryCount}`}
                    src={cacheBustedUrl}
                    alt="Shared Media"
                    crossOrigin={isExternal ? "anonymous" : undefined}
                    loading="eager"
                    decoding="async"
                    onLoad={() => {
                      setImageLoaded(true);
                      setImageError(false);
                    }}
                    onError={() => {
                      // If it was encrypted and failed, it might be a bad decryption
                      if (retryCount < MAX_RETRIES) {
                        setRetryCount(prev => prev + 1);
                      } else {
                        setImageError(true);
                        setImageLoaded(true);
                      }
                    }}
                    style={{
                      maxWidth: '100%',
                      maxHeight: '300px',
                      display: (imageLoaded && (!message.encrypted || decryptedFileUrl || manualDecryptedUrl)) ? 'block' : 'none',
                      cursor: 'pointer',
                      borderRadius: '12px',
                      transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                      objectFit: 'contain',
                      animation: 'scaleIn 0.4s ease-out',
                      backgroundColor: '#fff'
                    }}
                    onClick={() => {
                      if (onImageClick) onImageClick(constructedImageUrl);
                    }}
                    onMouseEnter={(e) => {
                      e.target.style.transform = 'scale(1.03) translateY(-2px)';
                      e.target.style.boxShadow = 'var(--shadow-lg)';
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.transform = 'scale(1)';
                      e.target.style.boxShadow = 'none';
                    }}
                  />
                )}
              </>
            )}
          </div>
        ) : (isVideo || (message.type === 'video' || message.mimeType?.startsWith('video/'))) &&
          !isDeleted && !showDecryptButton ? (
          <div style={{
            marginBottom: '10px',
            borderRadius: '12px',
            overflow: 'hidden',
            background: '#000',
            position: 'relative',
            maxWidth: '100%',
            minHeight: '200px'
          }}>
            {(!message.encrypted || decryptedFileUrl || manualDecryptedUrl) ? (
              <video
                src={decryptedFileUrl || manualDecryptedUrl || message.fileUrl}
                controls
                style={{
                  width: '100%',
                  maxHeight: '400px',
                  display: 'block',
                  borderRadius: '12px'
                }}
              />
            ) : (
              <div style={{
                height: '200px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
                color: '#fff'
              }}>
                <Loader2 className="animate-spin" size={32} />
                <p style={{ marginTop: '10px', fontSize: '0.8rem' }}>Decrypting Video...</p>
              </div>
            )}
          </div>
        ) : (message.mimeType === 'audio' ||
          message.type === 'audio' ||
          message.mimeType?.includes('audio') ||
          message.fileName?.includes('voice-note')) &&
          !isDeleted ? (
          <>
            {(message.fileUrl?.endsWith('.enc') && !decryptedFileUrl && !manualDecryptedUrl) ? (
              <div style={{ padding: '10px', fontSize: '0.8rem', opacity: 0.7 }}>Decrypting audio...</div>
            ) : (
              <AudioPlayer
                audioUrl={decryptedFileUrl || manualDecryptedUrl || getConstructedUrl(message.fileUrl || message.audioUrl)}
                isMine={isMine}
              />
            )}
          </>
        ) : message.type === 'location' && !isDeleted ? (
          <div className="location-bubble" style={{
            padding: '0',
            background: isMine ? 'rgba(255,255,255,0.1)' : 'var(--bg-secondary)',
            borderRadius: '12px',
            overflow: 'hidden',
            minWidth: '240px',
            border: isMine ? '1px solid rgba(255,255,255,0.2)' : '1px solid var(--border)'
          }}>
            {/* Map Preview */}
            <div style={{ height: '150px', width: '100%', background: 'var(--bg-secondary)', position: 'relative' }}>
              <iframe
                width="100%"
                height="100%"
                frameBorder="0"
                scrolling="no"
                marginHeight="0"
                marginWidth="0"
                src={`https://maps.google.com/maps?q=${message.latitude},${message.longitude}&z=15&output=embed`}
                style={{ pointerEvents: 'none', border: 'none' }}
                title="Location Preview"
              />
            </div>

            {/* Footer */}
            <div style={{ padding: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <MapPin size={18} color={isMine ? 'white' : 'var(--primary)'} />
                <span style={{ fontWeight: '600', fontSize: '0.9rem' }}>Location Shared</span>
              </div>
              <button
                onClick={() => window.open(message.mapsUrl || `https://www.google.com/maps?q=${message.latitude},${message.longitude}`, '_blank')}
                style={{
                  width: '100%',
                  padding: '8px',
                  background: isMine ? 'white' : 'var(--primary-color)',
                  color: isMine ? 'var(--primary-color)' : 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '0.85rem',
                  fontWeight: 'bold',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '5px'
                }}
              >
                Get Directions <div style={{ fontSize: '0.7rem' }}>↗</div>
              </button>
            </div>
          </div>
        ) : showDecryptButton && !isDeleted ? (
          <div style={{
            padding: '20px',
            background: isMine ? 'rgba(255,255,255,0.1)' : 'rgba(102, 0, 153, 0.05)',
            border: `2px dashed ${isMine ? 'rgba(255,255,255,0.3)' : 'var(--primary-color)'}`,
            borderRadius: '16px',
            marginBottom: '10px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '15px',
            textAlign: 'center',
            minWidth: '220px'
          }}>
            <div style={{ width: '60px', height: '60px', borderRadius: '50%', background: 'rgba(0,0,0,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '30px' }}>
              {isVideo ? '🎬' : isAudio ? '🎵' : '📄'}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 'bold', fontSize: '1rem', marginBottom: '4px', wordBreak: 'break-all' }}>
                {message.fileName || 'Encrypted File'}
              </div>
              <div style={{ fontSize: '0.8rem', opacity: 0.7 }}>
                {(message.size / (1024 * 1024)).toFixed(1)} MB • ENCRYPTED
              </div>
            </div>
            <button
              onClick={handleManualDecrypt}
              disabled={isDecrypting}
              style={{
                width: '100%',
                padding: '12px 24px',
                background: isMine ? 'white' : 'var(--primary-color)',
                color: isMine ? 'var(--primary-color)' : 'white',
                border: 'none',
                borderRadius: '12px',
                cursor: 'pointer',
                fontSize: '0.95rem',
                fontWeight: 'bold',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '10px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                transition: 'transform 0.2s'
              }}
              onMouseEnter={(e) => e.target.style.transform = 'translateY(-2px)'}
              onMouseLeave={(e) => e.target.style.transform = 'translateY(0)'}
            >
              {isDecrypting ? (
                <>
                  <Loader2 className="animate-spin" size={20} />
                  <span>Processing...</span>
                </>
              ) : (
                <>
                  <Play size={20} fill="currentColor" />
                  <span>Decrypt & Play</span>
                </>
              )}
            </button>
          </div>
        ) : isPdf && !isDeleted && !showDecryptButton ? (
          <div style={{
            marginBottom: '10px',
            borderRadius: '12px',
            overflow: 'hidden',
            background: 'var(--bg-secondary)',
            position: 'relative',
            maxWidth: '100%',
            height: '220px',
            border: '1px solid var(--border-color)',
            display: 'flex',
            flexDirection: 'column'
          }}>
            <div style={{
              padding: '10px 15px',
              background: 'rgba(0,0,0,0.05)',
              borderBottom: '1px solid var(--border-color)',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              justifyContent: 'space-between'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                <FileText size={18} color="var(--primary-color)" />
                <span style={{
                  fontSize: '0.85rem',
                  fontWeight: '600',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}>
                  {message.fileName || 'PDF Document'}
                </span>
              </div>
              <button
                onClick={() => {
                  const url = decryptedFileUrl || manualDecryptedUrl || message.fileUrl;
                  window.open(url, '_blank');
                }}
                style={{
                  background: 'var(--primary-color)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '4px 10px',
                  fontSize: '0.75rem',
                  cursor: 'pointer',
                  fontWeight: 'bold'
                }}
              >
                Open Full
              </button>
            </div>
            <div style={{ flex: 1, position: 'relative' }}>
              {(decryptedFileUrl || manualDecryptedUrl || !message.encrypted) ? (
                <iframe
                  src={`${decryptedFileUrl || manualDecryptedUrl || message.fileUrl}#toolbar=0`}
                  style={{
                    width: '100%',
                    height: '100%',
                    border: 'none'
                  }}
                  title="PDF Preview"
                />
              ) : (
                <div style={{
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                  alignItems: 'center',
                  color: 'var(--text-secondary)'
                }}>
                  <Loader2 className="animate-spin" size={32} />
                  <p style={{ marginTop: '10px', fontSize: '0.8rem' }}>Decrypting PDF...</p>
                </div>
              )}
            </div>
          </div>
        ) : message.type === 'file' && message.fileUrl && !isDeleted ? (
          <div style={{
            padding: '14px',
            background: 'var(--primary-soft)',
            border: '1px solid var(--primary-light)',
            borderRadius: '12px',
            marginBottom: '10px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}>
            <span style={{ fontSize: '24px' }}>📎</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 'bold', fontSize: '0.9rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {message.fileName || 'Attachment'}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#666' }}>
                {message.mimeType || 'File'}
              </div>
            </div>
            <button
              onClick={() => {
                // Use decrypted URL if available, otherwise use original
                const downloadUrl = decryptedFileUrl || manualDecryptedUrl || message.fileUrl;
                fetch(downloadUrl)
                  .then(response => response.blob())
                  .then(blob => {
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = message.fileName || 'download';
                    document.body.appendChild(a);
                    a.click();
                    window.URL.revokeObjectURL(url);
                    document.body.removeChild(a);
                  })
                  .catch(err => {
                    console.error('Download failed:', err);
                    alert('Failed to download file. Please try again.');
                  });
              }}
              style={{
                padding: '8px 16px',
                background: 'var(--primary)',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '0.85rem',
                fontWeight: '600',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => e.target.style.background = 'var(--primary-dark)'}
              onMouseLeave={(e) => e.target.style.background = 'var(--primary)'}
            >
              Download
            </button>
          </div>
        ) : (
          // Strict Text Fallback - Only rendering markdown if it's explicitly NOT a media type
          (!message.type || message.type === 'text' || message.type === 'system' || message.type === 'video') && (
            <div className="markdown-content" style={{ margin: 0, color: 'inherit', fontSize: '0.95rem', lineHeight: '1.5' }}>
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={markdownComponents}
              >
                {displayText}
              </ReactMarkdown>
            </div>
          )
        )
        }

        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          gap: '8px',
          marginTop: '6px',
          opacity: 0.7
        }}>
          {message.isEdited && <span style={{ fontSize: '0.65rem', fontStyle: 'italic', fontWeight: '500' }}>Edited</span>}
          <span style={{ fontSize: '0.65rem', color: 'inherit', fontWeight: 'bold' }}>{message.time}</span>
          {isMine && !isDeleted && (
            message.seen ? (
              <CheckCheck size={16} color="#4ade80" strokeWidth={2.5} title="Seen" />
            ) : message.delivered ? (
              <CheckCheck size={16} color="#9ca3af" strokeWidth={2.5} title="Delivered" />
            ) : (
              <Check size={16} color="#9ca3af" strokeWidth={2.5} title="Sent" />
            )
          )}
        </div>

        {/* Action Button Trigger */}
        {
          !isDeleted && (
            <div
              ref={menuRef}
              style={{
                position: 'absolute',
                [isMine ? 'left' : 'right']: '-45px',
                top: '50%',
                transform: 'translateY(-50%)',
                zIndex: 1000 // High enough to be reachable but inside container
              }}
            >
              <button
                onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }}
                style={{
                  background: 'var(--glass-bg)',
                  border: '1px solid var(--primary-color)',
                  borderRadius: '50%',
                  cursor: 'pointer',
                  color: isMine ? 'var(--primary-color)' : 'var(--primary-color)', // Explicitly set to avoid inheritance
                  padding: '6px',
                  display: 'flex',
                  boxShadow: 'var(--shadow-md)',
                  opacity: showMenu ? '1' : '0.6',
                  transition: 'all 0.2s',
                  backdropFilter: 'blur(10px)'
                }}
              >
                <MoreVertical size={16} />
              </button>

              {/* ACTION MENU DROPDOWN */}
              {showMenu && (
                <div style={{
                  position: 'absolute',
                  top: '35px',
                  [isMine ? 'right' : 'left']: 0,
                  background: 'var(--bg-primary)',
                  boxShadow: '0 15px 45px rgba(0,0,0,0.3)',
                  borderRadius: '12px',
                  padding: '10px 0',
                  zIndex: 10001, // Absolute top
                  minWidth: '200px',
                  display: 'flex',
                  flexDirection: 'column',
                  border: '1px solid var(--border-color)'
                }}>
                  <div style={{
                    display: 'flex',
                    gap: '12px',
                    padding: '5px 15px 15px 15px',
                    borderBottom: '1px solid var(--border-color)',
                    justifyContent: 'center',
                    marginBottom: '5px'
                  }}>
                    {emojis.map(e => (
                      <span
                        key={e}
                        onClick={() => handleReaction(e)}
                        style={{ cursor: 'pointer', fontSize: '1.4rem' }}
                      >
                        {e}
                      </span>
                    ))}
                  </div>

                  <button className="menu-item" onClick={() => { setShowPicker(true); setShowMenu(false); }} style={menuItemStyle}>
                    <Smile size={18} color="#444" /> <span style={{ color: '#1a1a1a' }}>Add Reaction</span>
                  </button>
                  <button className="menu-item" onClick={() => { setReplyTo(chatId, message); setShowMenu(false); }} style={menuItemStyle}>
                    <Reply size={18} color="#444" /> <span style={{ color: '#1a1a1a' }}>Reply</span>
                  </button>
                  {isMine && !isDeleted && !message.fileUrl && !message.imageUrl && (
                    <button className="menu-item" onClick={() => { onEdit(message); setShowMenu(false); }} style={menuItemStyle}>
                      <Pin size={18} color="#444" style={{ transform: 'rotate(45deg)' }} /> <span style={{ color: '#1a1a1a' }}>Edit Message</span>
                    </button>
                  )}

                  <button
                    className="menu-item"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (message.text) {
                        navigator.clipboard.writeText(displayText || message.text)
                          .then(() => showToast("Message copied!"))
                          .catch(err => console.error("Failed to copy:", err));
                      }
                      setShowMenu(false);
                    }}
                    style={menuItemStyle}
                    onMouseEnter={(e) => e.target.style.background = 'var(--bg-secondary)'}
                    onMouseLeave={(e) => e.target.style.background = 'transparent'}
                  >
                    <Copy size={18} color="#444" /> <span style={{ color: '#1a1a1a' }}>Copy</span>
                  </button>

                  {chatId?.toString().startsWith('group_') && (
                    (() => {
                      const group = groups?.find(g => g.id.toLowerCase() === chatId.toLowerCase());
                      const isAdmin = group?.createdBy === user?.uid;

                      return isAdmin ? (
                        <button
                          className="menu-item"
                          onClick={() => {
                            console.log("Pin clicked");
                            setShowMenu(false);
                          }}
                          style={menuItemStyle}
                          onMouseEnter={(e) => e.target.style.background = '#f5f5f5'}
                          onMouseLeave={(e) => e.target.style.background = 'transparent'}
                        >
                          <Pin size={18} color="#444" /> <span style={{ color: '#1a1a1a' }}>Pin Message</span>
                        </button>
                      ) : null;
                    })()
                  )}

                  <div style={{ height: '1px', background: '#f0f0f0', margin: '4px 0' }} />

                  <button className="menu-item" onClick={() => { setShowDeleteMenu(true); setShowMenu(false); }} style={{ ...menuItemStyle, color: '#d63031' }}>
                    <Trash2 size={18} /> <span>Delete</span>
                  </button>
                </div>
              )}
            </div>
          )
        }
      </div >

      {
        !isDeleted && Object.keys(reactions).length > 0 && (
          <div style={{
            display: 'flex',
            gap: '6px',
            marginTop: '6px',
            flexWrap: 'wrap',
            justifyContent: isMine ? 'flex-end' : 'flex-start',
            zIndex: 1
          }}>
            {Object.entries(reactions).map(([emoji, users]) => (
              users.length > 0 && (
                <div
                  key={emoji}
                  title={users.join(", ")}
                  style={{
                    background: 'var(--glass-bg)',
                    backdropFilter: 'blur(10px)',
                    borderRadius: '20px',
                    padding: '4px 12px',
                    fontSize: '0.9rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    border: '1px solid var(--glass-border)',
                    boxShadow: 'var(--shadow-sm)',
                    cursor: 'pointer',
                    transition: 'all 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                    animation: 'scaleIn 0.3s ease-out'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'scale(1.2)';
                    e.currentTarget.style.boxShadow = 'var(--shadow-md)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'scale(1)';
                    e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
                  }}
                >
                  <span>{emoji}</span>
                  <span style={{ fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--text-primary)' }}>{users.length}</span>
                </div>
              )
            ))}
          </div>
        )
      }

      {/* Delete Options Modal */}
      {
        showDeleteMenu && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0, 0, 0, 0.5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 9999,
              backdropFilter: 'blur(4px)'
            }}
            onClick={() => setShowDeleteMenu(false)}
          >
            <div
              style={{
                background: 'var(--bg-primary)',
                borderRadius: '12px',
                padding: '8px',
                minWidth: '280px',
                maxWidth: '90%',
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)',
                animation: 'scaleIn 0.2s ease-out'
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <img
                src={cacheBustedUrl}
                alt={message.fileName || "Encrypted Image"}
                style={{
                  maxWidth: '100%',
                  maxHeight: '300px',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  display: imageLoaded ? 'block' : 'none'
                }}
                onLoad={() => setImageLoaded(true)}
                onError={() => {
                  console.error("❌ Image failed to load:", cacheBustedUrl);
                  setImageLoaded(false);
                  setImageError(true);

                  // Self-healing: If a cached blob fails, it might be revoked.
                  // Remove from cache and force retry (once)
                  if (decryptedFileUrl && !retryCount) {
                    console.log("♻️ Triggering self-healing for revoked blob...");
                    decryptionCache.remove(message.imageUrl || message.fileUrl || message.audioUrl);
                    setRetryCount(prev => prev + 1);
                    setDecryptedFileUrl(null); // Clear local state to trigger effect
                  }
                }}
                onClick={() => {
                  if (decryptedFileUrl) {
                    onImageClick(decryptedFileUrl);
                  }
                }}
              />
              <button
                onClick={handleDeleteForMe}
                style={{
                  width: '100%',
                  padding: '14px 16px',
                  border: 'none',
                  background: 'transparent',
                  textAlign: 'left',
                  cursor: 'pointer',
                  fontSize: '15px',
                  color: '#1a1a1a',
                  borderRadius: '8px',
                  transition: 'background 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = '#f5f5f5'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              >
                <Trash2 size={20} color="#666" />
                <span>Delete for Me</span>
              </button>

              {isMine && (
                <button
                  onClick={handleDeleteForEveryone}
                  style={{
                    width: '100%',
                    padding: '14px 16px',
                    border: 'none',
                    background: 'transparent',
                    textAlign: 'left',
                    cursor: 'pointer',
                    fontSize: '15px',
                    color: '#d63031',
                    borderRadius: '8px',
                    transition: 'background 0.2s',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = '#fff5f5'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  <Trash2 size={20} color="#d63031" />
                  <span>Delete for Everyone</span>
                </button>
              )}

              <div style={{ height: '1px', background: '#e0e0e0', margin: '8px 0' }} />

              <button
                onClick={() => setShowDeleteMenu(false)}
                style={{
                  width: '100%',
                  padding: '14px 16px',
                  border: 'none',
                  background: 'transparent',
                  textAlign: 'center',
                  cursor: 'pointer',
                  fontSize: '15px',
                  color: '#666',
                  borderRadius: '8px',
                  transition: 'background 0.2s',
                  fontWeight: '500'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = '#f5f5f5'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              >
                Cancel
              </button>
            </div>
          </div>
        )
      }

      {/* Full Screen Image Modal */}
      {
        modalImage && (
          <ImageModal
            imageUrl={modalImage}
            onClose={() => setModalImage(null)}
          />
        )
      }
    </div >
  );
}
