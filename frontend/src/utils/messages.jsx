import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";

export const saveMessage = async (chatId, message) => {
  await addDoc(collection(db, "chats", chatId, "messages"), {
    ...message,
    createdAt: serverTimestamp()
  });
};
