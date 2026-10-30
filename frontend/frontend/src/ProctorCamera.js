import { useEffect, useRef, useState } from "react";

const createPeerConnection = () =>
  new RTCPeerConnection({
    iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
  });

function ProctorCamera({
  isExamActive,
  liveSessionId,
  onCameraChange,
  onCameraFailure,
  socket,
}) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const peerRef = useRef(null);
  const cameraFailureRef = useRef(onCameraFailure);
  const wasExamActiveRef = useRef(false);
  const [cameraError, setCameraError] = useState("");
  const [isStarting, setIsStarting] = useState(false);
  const [isLive, setIsLive] = useState(false);
  const [liveStatus, setLiveStatus] = useState("");

  cameraFailureRef.current = onCameraFailure;

  useEffect(() => {
    if (videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
    }
  }, [isLive]);

  useEffect(() => {
    if (!isExamActive || !streamRef.current) return undefined;

    const track = streamRef.current.getVideoTracks()[0];
    const handleTrackEnded = () => cameraFailureRef.current?.("camera_stopped");
    track?.addEventListener("ended", handleTrackEnded);
    return () => track?.removeEventListener("ended", handleTrackEnded);
  }, [isExamActive]);

  useEffect(() => {
    if (isExamActive) {
      wasExamActiveRef.current = true;
      return;
    }

    if (wasExamActiveRef.current) {
      wasExamActiveRef.current = false;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      setIsLive(false);
      onCameraChange(null);
    }
  }, [isExamActive, onCameraChange]);

  useEffect(() => {
    if (!isExamActive || !liveSessionId || !socket || !streamRef.current) {
      setLiveStatus("");
      return undefined;
    }

    const peer = createPeerConnection();
    peerRef.current = peer;
    for (const track of streamRef.current.getVideoTracks()) {
      peer.addTrack(track, streamRef.current);
    }

    let isCreatingOffer = false;
    const pendingCandidates = [];
    const createOffer = async () => {
      if (isCreatingOffer || peer.signalingState !== "stable") return;
      isCreatingOffer = true;
      try {
        const offer = await peer.createOffer();
        await peer.setLocalDescription(offer);
        socket.emit("rtc:signal", {
          sessionId: liveSessionId,
          signal: { type: "offer", description: peer.localDescription },
        });
        setLiveStatus("Connecting your camera to a reviewer...");
      } catch {
        setLiveStatus("Unable to start the live video connection.");
      } finally {
        isCreatingOffer = false;
      }
    };

    const handleReviewerJoined = ({ sessionId } = {}) => {
      if (sessionId === liveSessionId) createOffer();
    };
    const handleSignal = async ({ sessionId, signal } = {}) => {
      if (sessionId !== liveSessionId || !signal) return;
      try {
        if (signal.type === "answer" && signal.description) {
          await peer.setRemoteDescription(signal.description);
          for (const candidate of pendingCandidates.splice(0)) {
            await peer.addIceCandidate(candidate);
          }
          setLiveStatus("Live video is shared with the reviewer.");
        } else if (signal.type === "candidate" && signal.candidate) {
          if (peer.remoteDescription) {
            await peer.addIceCandidate(signal.candidate);
          } else {
            pendingCandidates.push(signal.candidate);
          }
        }
      } catch {
        setLiveStatus("The live video connection was interrupted.");
      }
    };

    peer.onicecandidate = ({ candidate }) => {
      if (candidate) {
        socket.emit("rtc:signal", {
          sessionId: liveSessionId,
          signal: { type: "candidate", candidate },
        });
      }
    };

    const joinSession = () => {
      socket.timeout(5000).emit("exam:join", { sessionId: liveSessionId }, (error, result) => {
        if (error || result?.error) {
          setLiveStatus("Unable to join live proctoring. Check your connection.");
        } else if (result.reviewerJoined) {
          createOffer();
        } else {
          setLiveStatus("Waiting for a reviewer to join the live camera.");
        }
      });
    };

    socket.on("reviewer:joined", handleReviewerJoined);
    socket.on("rtc:signal", handleSignal);
    socket.on("connect", joinSession);
    const heartbeat = window.setInterval(() => {
      socket.emit("exam:heartbeat", { sessionId: liveSessionId });
    }, 20000);
    if (socket.connected) joinSession();

    return () => {
      socket.off("reviewer:joined", handleReviewerJoined);
      socket.off("rtc:signal", handleSignal);
      socket.off("connect", joinSession);
      window.clearInterval(heartbeat);
      peer.close();
      if (peerRef.current === peer) peerRef.current = null;
    };
  }, [isExamActive, liveSessionId, socket]);

  const startCamera = async () => {
    setCameraError("");

    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError("Camera access requires a supported browser and a secure connection.");
      return;
    }

    setIsStarting(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: "user" },
      });
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = stream;
      setIsLive(true);
      onCameraChange(stream);
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch {
      setCameraError("Camera permission was not granted or the camera is unavailable.");
    } finally {
      setIsStarting(false);
    }
  };

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setIsLive(false);
    onCameraChange(null);
    if (videoRef.current) videoRef.current.srcObject = null;
  };

  return (
    <aside className="camera-card" aria-label="Required proctor camera">
      <div className="camera-heading">
        <div>
          <span className="eyebrow">Required live proctor camera</span>
          <p>Enable the camera before starting. Reviewers can see the live video while you take the exam.</p>
        </div>
        <span className={`camera-status ${isLive ? "is-live" : ""}`}>
          {isLive ? "Camera on" : "Camera off"}
        </span>
      </div>

      {isLive ? (
        <video ref={videoRef} className="camera-preview" autoPlay muted playsInline />
      ) : (
        <div className="camera-placeholder">Camera permission is required to begin</div>
      )}

      {!isExamActive && (
        <div className="camera-actions">
          {isLive ? (
            <button type="button" className="text-button" onClick={stopCamera}>
              Turn camera off
            </button>
          ) : (
            <button type="button" className="secondary-button" onClick={startCamera} disabled={isStarting}>
              {isStarting ? "Requesting camera permission..." : "Enable camera"}
            </button>
          )}
        </div>
      )}

      <p className="privacy-note">
        Your video is sent live to a reviewer while the exam is active. The app does not record or save video.
      </p>
      {liveStatus && isExamActive && <p className="live-status" role="status">{liveStatus}</p>}
      {cameraError && <p className="inline-error" role="alert">{cameraError}</p>}
    </aside>
  );
}

export function LiveReviewerFeed({ socket, session }) {
  const videoRef = useRef(null);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("Connecting to student's camera...");

  useEffect(() => {
    if (!socket) {
      setError("Live proctoring is not connected. Reconnect and refresh the reviewer queue.");
      return undefined;
    }

    const videoElement = videoRef.current;
    const peer = createPeerConnection();
    const pendingCandidates = [];
    peer.ontrack = (event) => {
      if (videoElement) {
        videoElement.srcObject = event.streams[0];
      }
      setStatus("Receiving live student video.");
      setError("");
    };

    const handleSignal = async ({ sessionId, signal } = {}) => {
      if (sessionId !== session.sessionId || !signal) return;
      try {
        if (signal.type === "offer" && signal.description) {
          await peer.setRemoteDescription(signal.description);
          for (const candidate of pendingCandidates.splice(0)) {
            await peer.addIceCandidate(candidate);
          }
          const answer = await peer.createAnswer();
          await peer.setLocalDescription(answer);
          socket.emit("rtc:signal", {
            sessionId: session.sessionId,
            signal: { type: "answer", description: peer.localDescription },
          });
        } else if (signal.type === "candidate" && signal.candidate) {
          if (peer.remoteDescription) {
            await peer.addIceCandidate(signal.candidate);
          } else {
            pendingCandidates.push(signal.candidate);
          }
        }
      } catch {
        setError("Unable to establish the live video stream.");
      }
    };

    peer.onicecandidate = ({ candidate }) => {
      if (candidate) {
        socket.emit("rtc:signal", {
          sessionId: session.sessionId,
          signal: { type: "candidate", candidate },
        });
      }
    };

    const joinSession = () => {
      socket.timeout(5000).emit(
        "reviewer:join",
        { sessionId: session.sessionId },
        (joinError, result) => {
          if (joinError || result?.error) {
            setError(result?.error || "Unable to join the live video session.");
          }
        }
      );
    };

    socket.on("rtc:signal", handleSignal);
    socket.on("connect", joinSession);
    if (socket.connected) joinSession();

    return () => {
      socket.off("rtc:signal", handleSignal);
      socket.off("connect", joinSession);
      peer.close();
      if (videoElement) videoElement.srcObject = null;
    };
  }, [session.sessionId, socket]);

  return (
    <div className="live-feed">
      <video ref={videoRef} autoPlay playsInline className="reviewer-video" />
      <p className={error ? "inline-error" : "live-status"} role={error ? "alert" : "status"}>
        {error || status}
      </p>
    </div>
  );
}

export default ProctorCamera;
