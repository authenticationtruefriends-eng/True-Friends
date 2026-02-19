import { useEffect, useState } from "react";
import { socket } from "../../utils/socket";

export default function GroupChat({ groupId }) {
  const [messages, setMessages] = useState([]);

  useEffect(() => {
    socket.emit("join-group", groupId);

    socket.on("group-receive", (msg) => {
      setMessages((prev) => [...prev, msg]);
    });

    return () => socket.off("group-receive");
  }, [groupId]);

  const sendGroupMessage = (text) => {
    const message = {
      text,
      time: Date.now()
    };

    socket.emit("group-message", {
      groupId,
      message
    });
  };

  return (
    <div>
      {messages.map((m, i) => (
        <div key={i}>{m.text}</div>
      ))}
      <button onClick={() => sendGroupMessage("Hello Group")}>
        Send
      </button>
    </div>
  );
}
