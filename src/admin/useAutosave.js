import { useCallback, useEffect, useRef, useState } from "react";
import { callAdmin } from "./api.js";

export function useAutosave({ initialData, password, delay = 2000 }) {
  const [data, setData] = useState(initialData);
  const [status, setStatus] = useState("idle"); // idle | saving | saved | error
  const [undoStack, setUndoStack] = useState([]);

  const dataRef = useRef(data);
  const passwordRef = useRef(password);
  const timerRef = useRef(null);
  useEffect(() => { dataRef.current = data; }, [data]);
  useEffect(() => { passwordRef.current = password; }, [password]);
  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  const scheduleSave = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      setStatus("saving");
      try {
        await callAdmin({ action: "save", password: passwordRef.current, data: dataRef.current });
        setStatus("saved");
      } catch {
        setStatus("error");
      }
    }, delay);
  }, [delay]);

  const mutate = useCallback((fn) => {
    setUndoStack((stack) => [...stack, dataRef.current]);
    setData((prev) => fn(prev));
    scheduleSave();
  }, [scheduleSave]);

  const undo = useCallback(() => {
    setUndoStack((stack) => {
      if (!stack.length) return stack;
      const prev = stack[stack.length - 1];
      setData(prev);
      scheduleSave();
      return stack.slice(0, -1);
    });
  }, [scheduleSave]);

  return { data, status, mutate, undo, canUndo: undoStack.length > 0 };
}
