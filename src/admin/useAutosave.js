import { useCallback, useEffect, useRef, useState } from "react";
import { callAdmin } from "./api.js";

export function useAutosave({ initialData, password, delay = 2000 }) {
  const [data, setData] = useState(initialData);
  const [status, setStatus] = useState("idle");
  const [canUndo, setCanUndo] = useState(false);

  const dataRef = useRef(initialData);
  const passwordRef = useRef(password);
  const undoStackRef = useRef([]);
  const timerRef = useRef(null);

  useEffect(() => { dataRef.current = data; }, [data]);
  useEffect(() => { passwordRef.current = password; }, [password]);
  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  const save = useCallback(async () => {
    setStatus("saving");
    try {
      await callAdmin({ action: "save", password: passwordRef.current, data: dataRef.current });
      setStatus("saved");
    } catch {
      setStatus("error");
    }
  }, []);

  const scheduleSave = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => { save(); }, delay);
  }, [delay, save]);

  const mutate = useCallback((fn) => {
    const prev = dataRef.current;
    const next = fn(prev);
    dataRef.current = next;
    undoStackRef.current.push(prev);
    setData(next);
    setCanUndo(true);
    scheduleSave();
  }, [scheduleSave]);

  const undo = useCallback(() => {
    if (!undoStackRef.current.length) return;
    const prev = undoStackRef.current.pop();
    dataRef.current = prev;
    setData(prev);
    setCanUndo(undoStackRef.current.length > 0);
    scheduleSave();
  }, [scheduleSave]);

  const retry = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    save();
  }, [save]);

  return { data, status, mutate, undo, canUndo, retry };
}
