import React, { useEffect, useRef, useState } from "react";

const FACE_API_CDN =
  "https://cdn.jsdelivr.net/npm/@vladmandic/face-api/dist/face-api.min.js";
const MODEL_URL = "https://vladmandic.github.io/face-api/model";

export default function WebcamFaceAnalyzer() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState("Hazır bekliyor");
  const [lastResult, setLastResult] = useState(null);

  // Load face-api
  useEffect(() => {
    let scriptEl;
    async function load() {
      if (window.faceapi) return;
      scriptEl = document.createElement("script");
      scriptEl.src = FACE_API_CDN;
      scriptEl.async = true;
      document.head.appendChild(scriptEl);
      await new Promise((res, rej) => {
        scriptEl.onload = res;
        scriptEl.onerror = rej;
      });

      const faceapi = window.faceapi;
      await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
      await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
      await faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL);
      await faceapi.nets.ageGenderNet.loadFromUri(MODEL_URL);
      setReady(true);
      setStatus("Modeller yüklendi ✔");
    }
    load();
    return () => {
      if (scriptEl) document.head.removeChild(scriptEl);
    };
  }, []);

  // Start camera
  async function startCamera() {
    try {
      setStatus("Kamera açılıyor…");
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setRunning(true);
      setStatus("Çalışıyor");
    } catch (e) {
      setStatus("Kamera hatası: " + e.message);
    }
  }

  function stopCamera() {
    const vid = videoRef.current;
    if (vid && vid.srcObject) {
      vid.srcObject.getTracks().forEach((t) => t.stop());
      vid.srcObject = null;
    }
    setRunning(false);
    setStatus("Durduruldu");
  }

  // Main detection loop
  useEffect(() => {
    if (!ready || !running) return;
    let interval;
    const faceapi = window.faceapi;
    const opts = new faceapi.TinyFaceDetectorOptions();

    async function detect() {
      if (!videoRef.current) return;

      const detections = await faceapi
        .detectAllFaces(videoRef.current, opts)
        .withFaceLandmarks()
        .withFaceExpressions()
        .withAgeAndGender();

      const ctx = canvasRef.current.getContext("2d");
      canvasRef.current.width = videoRef.current.videoWidth;
      canvasRef.current.height = videoRef.current.videoHeight;
      ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);

      faceapi.draw.drawDetections(canvasRef.current, detections);
      faceapi.draw.drawFaceLandmarks(
        canvasRef.current,
        detections.map((d) => d.landmarks)
      );

      if (detections[0]) {
        const d = detections[0];
        const emotion = Object.entries(d.expressions).sort(
          (a, b) => b[1] - a[1]
        )[0][0];
        setLastResult({
          age: d.age.toFixed(0),
          gender: d.gender,
          emotion,
        });
      } else {
        setLastResult(null);
      }
    }

    interval = setInterval(detect, 300);
    return () => clearInterval(interval);
  }, [ready, running]);

  // Snapshot
  function takeSnapshot() {
    const video = videoRef.current;
    const overlay = canvasRef.current;
    if (!video) return;

    const snapshotCanvas = document.createElement("canvas");
    snapshotCanvas.width = video.videoWidth;
    snapshotCanvas.height = video.videoHeight;
    const ctx = snapshotCanvas.getContext("2d");

    ctx.drawImage(video, 0, 0, snapshotCanvas.width, snapshotCanvas.height);
    if (overlay) {
      ctx.drawImage(overlay, 0, 0, snapshotCanvas.width, snapshotCanvas.height);
    }

    const url = snapshotCanvas.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = url;
    a.download = `snapshot_${Date.now()}.png`;
    a.click();
  }

  return (
    <div className="container">
      <h1>Webcam Face Analyzer</h1>
      <p>{status}</p>

      <div className="video-container">
        <video ref={videoRef} autoPlay muted playsInline></video>
        <canvas ref={canvasRef}></canvas>
      </div>

      <div className="controls">
        {!running ? (
          <button onClick={startCamera} disabled={!ready}>
            Başlat
          </button>
        ) : (
          <button onClick={stopCamera}>Durdur</button>
        )}
        <button onClick={takeSnapshot} disabled={!running}>
          Fotoğraf Çek
        </button>
      </div>

      <div className="results">
        {lastResult ? (
          <>
            <p>Yaş: {lastResult.age}</p>
            <p>Cinsiyet: {lastResult.gender}</p>
            <p>Duygu: {lastResult.emotion}</p>
          </>
        ) : (
          <p>Yüz algılanmadı</p>
        )}
      </div>
    </div>
  );
}
