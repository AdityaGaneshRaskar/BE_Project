import cv2
import mediapipe as mp
import numpy as np

class FacialGestureAnalyzer:
    def __init__(self):
        self.mp_face = mp.solutions.face_mesh.FaceMesh(
            static_image_mode=False,
            max_num_faces=1,
            refine_landmarks=True,
            min_detection_confidence=0.5,
            min_tracking_confidence=0.5
        )

    def analyze_video(self, video_path, show_video=False):
        cap = cv2.VideoCapture(video_path)

        smile_ratios = []
        eyebrow_raise_ratios = []
        head_tilts = []
        blink_count = 0
        frame_idx = 0

        while cap.isOpened():
            ret, frame = cap.read()
            if not ret:
                break

            frame_idx += 1
            frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            results = self.mp_face.process(frame_rgb)

            if results.multi_face_landmarks:
                face = results.multi_face_landmarks[0]
                h, w, _ = frame.shape
                landmarks = [(int(lm.x*w), int(lm.y*h)) for lm in face.landmark]

                # --- Mouth / Smile Ratio ---
                left_mouth = landmarks[61]
                right_mouth = landmarks[291]
                top_lip = landmarks[13]
                bottom_lip = landmarks[14]

                mouth_width = np.linalg.norm(np.array(right_mouth) - np.array(left_mouth))
                mouth_height = np.linalg.norm(np.array(top_lip) - np.array(bottom_lip))
                if mouth_height < 1e-6:  # avoid division by zero
                    continue
                smile_ratio = mouth_width / mouth_height
                smile_ratios.append(smile_ratio)

                # --- Eyebrow Raise ---
                left_eyebrow = landmarks[105]
                left_eye = landmarks[159]
                right_eyebrow = landmarks[334]
                right_eye = landmarks[386]

                bottom_lip_height = max(mouth_height, 1e-6)
                left_ratio = (left_eyebrow[1] - left_eye[1]) / bottom_lip_height
                right_ratio = (right_eyebrow[1] - right_eye[1]) / bottom_lip_height
                eyebrow_raise_ratios.append((left_ratio + right_ratio) / 2)

                # --- Blink detection ---
                left_ear = (np.linalg.norm(np.array(landmarks[159])-np.array(landmarks[145])) /
                            np.linalg.norm(np.array(landmarks[33])-np.array(landmarks[133])+1e-6))
                right_ear = (np.linalg.norm(np.array(landmarks[386])-np.array(landmarks[374])) /
                             np.linalg.norm(np.array(landmarks[362])-np.array(landmarks[263])+1e-6))
                if left_ear < 0.2 or right_ear < 0.2:
                    blink_count += 1

                # --- Head tilt metric ---
                left_eye_corner = landmarks[33]
                right_eye_corner = landmarks[263]
                tilt = abs(left_eye_corner[1] - right_eye_corner[1])
                head_tilts.append(tilt)

            if show_video:
                cv2.imshow('Frame', frame)
                if cv2.waitKey(1) & 0xFF == ord('q'):
                    break

        cap.release()
        if show_video:
            cv2.destroyAllWindows()

        # --- Aggregate metrics safely ---
        metrics = {
            "smile_mean": float(np.mean(smile_ratios)) if smile_ratios else 0,
            "eyebrow_raise_mean": float(np.mean(eyebrow_raise_ratios)) if eyebrow_raise_ratios else 0,
            "blink_count": int(blink_count / max(frame_idx, 1) * 30),  # normalized per ~30 frames (~1 sec)
            "head_pose_mean": float(np.mean(head_tilts)) if head_tilts else 0
        }

        return metrics
