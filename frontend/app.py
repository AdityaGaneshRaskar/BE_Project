import streamlit as st
import requests
import matplotlib.pyplot as plt
from math import pi
import sys
import os

# Add backend to path
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

try:
    from backend.database import save_analysis
    DB_AVAILABLE = True
except:
    DB_AVAILABLE = False

# ===== LOGIN CHECK =====
if 'logged_in' not in st.session_state:
    st.session_state.logged_in = False

if not st.session_state.logged_in:
    exec(open('login.py', encoding='utf-8').read())
    st.stop()
# ===== END LOGIN CHECK =====

# --- Page Configuration ---
st.set_page_config(page_title="🎤 Extempore Evaluator", layout="wide", initial_sidebar_state="collapsed")

# --- UI Styling ---
st.markdown("""
<style>
    .stApp { background-color: #0e1117; color: #f5f5f5; }
    .stProgress > div > div > div > div { background-image: linear-gradient(to right, #ff6b6b , #feca57); }
    .report-container { border: 1px solid #333333; border-radius: 0.75rem; padding: 20px; background-color: #1c1c1c; box-shadow: 0 6px 12px 0 rgba(0,0,0,0.6); margin-bottom: 25px; }
    h1 { text-align: center; color: #f5f5f5; }
    h2, h3, h4 { color: #feca57; }
    div.stButton > button:first-child { background-color: #ff6b6b; color: white; font-size: 16px; border-radius: 0.5rem; height: 45px; width: 100%; }
    div.stButton > button:first-child:hover { background-color: #feca57; color: black; }
    
    /* User info header styling */
    .user-header {
        background: linear-gradient(90deg, #1c1c1c 0%, #2a2a2a 100%);
        padding: 1rem;
        border-radius: 0.5rem;
        margin-bottom: 1rem;
        display: flex;
        justify-content: space-between;
        align-items: center;
        border: 1px solid #404040;
    }
    .user-info {
        color: #feca57;
        font-size: 1.1rem;
        font-weight: 600;
    }
    .logout-btn {
        background: linear-gradient(90deg, #ff6b6b 0%, #feca57 100%) !important;
        padding: 0.5rem 1.5rem;
        border-radius: 0.5rem;
        border: none;
        cursor: pointer;
    }
</style>
""", unsafe_allow_html=True)

# --- User Header with Logout ---
col_user, col_logout = st.columns([4, 1])
with col_user:
    st.markdown(f'<div class="user-info">👋 Welcome, {st.session_state.username}!</div>', unsafe_allow_html=True)
with col_logout:
    if st.button("Logout 🚪", key="logout_btn"):
        st.session_state.logged_in = False
        st.session_state.username = None
        st.session_state.user_id = None
        st.rerun()

# --- App Header ---
st.title("🎤 Extempore Speech Evaluator")
st.markdown("<p style='text-align: center; font-size: 18px;'>Upload your speech, and our AI will provide instant feedback on clarity, grammar, delivery, gestures, and confidence.</p>", unsafe_allow_html=True)
st.divider()

# --- File Uploader ---
uploaded_file = st.file_uploader(
    "Upload an audio or video file", 
    type=["mp3", "wav", "m4a", "mp4", "mov", "avi", "mkv"], 
    label_visibility="collapsed"
)

# --- Helper: Estimate Confidence & Nervousness ---
def estimate_confidence_nervousness(metrics):
    smile = metrics.get("smile_mean", 0)
    head_movement = metrics.get("head_pose_mean", 0)
    eyebrow = metrics.get("eyebrow_raise_mean", 0)
    blink = metrics.get("blink_count", 0)
    blink_norm = min(blink, 20)/20  # normalize

    # Confidence score
    confidence = (smile * 10) - (head_movement * 5)
    confidence = max(0, min(10, confidence))

    # Nervousness score
    nervousness = (eyebrow * 5 + blink_norm * 5 + head_movement * 5)
    nervousness = max(0, min(10, nervousness))

    return confidence, nervousness

# --- Main Logic ---
if uploaded_file is not None:
    # --- Media Preview ---
    with st.container():
        st.write("### Your Uploaded File")
        file_type = uploaded_file.type
        if file_type.startswith("audio"):
            st.audio(uploaded_file, format="audio/mp3")
        elif file_type.startswith("video"):
            st.video(uploaded_file)
        
        col1, col2, col3 = st.columns([1,2,1])
        with col2:
            analyze_button = st.button("Analyze Speech 🚀", use_container_width=True)

    if analyze_button:
        with st.spinner("Analyzing your speech... This may take a moment. ⏳"):
            files = {"file": (uploaded_file.name, uploaded_file.getvalue(), uploaded_file.type)}
            
            try:
                response = requests.post("http://127.0.0.1:8000/analyze", files=files, timeout=300)
                response.raise_for_status()
            except requests.exceptions.RequestException as e:
                st.error(f"❌ Failed to connect to the analysis service: {e}")
                st.stop()

        if response.status_code == 200:
            result = response.json()

            # Save analysis to database
            if DB_AVAILABLE and st.session_state.get('user_id'):
                gesture_metrics = result.get("gesture_metrics", {})
                if gesture_metrics:
                    confidence, nervousness = estimate_confidence_nervousness(gesture_metrics)
                    result['confidence_score'] = confidence
                    result['nervousness_score'] = nervousness
                    result['filename'] = uploaded_file.name
                    
                    save_result = save_analysis(st.session_state.user_id, result)
                    if save_result['success']:
                        st.success("✅ Analysis saved to your history!")
                    else:
                        st.warning(f"⚠️ Could not save to history: {save_result.get('message', 'Unknown error')}")

            # --- Transcription ---
            with st.container():
                st.markdown('<div class="report-container">', unsafe_allow_html=True)
                st.subheader("📝 Transcription")
                st.markdown(f"> _{result.get('transcription', 'No transcription available.')}_")
                st.markdown('</div>', unsafe_allow_html=True)

            # --- Feedback Dashboard ---
            with st.container():
                st.markdown('<div class="report-container">', unsafe_allow_html=True)
                st.subheader("📊 Feedback Dashboard")
                feedback = result.get("feedback", {})

                if "Error" in feedback:
                    st.error(f"❌ Gemini API Error: {feedback.get('Error', 'Unknown error.')}")
                else:
                    feedback_items = []
                    if isinstance(feedback, dict) and all(isinstance(v, dict) for v in feedback.values()):
                        feedback_items = [{"category": cat, **details} for cat, details in feedback.items()]
                    categories = [f.get("category", "N/A") for f in feedback_items]
                    scores = [f.get("score", 0) for f in feedback_items]

                    col1, col2 = st.columns([3, 2])

                    # Left Column: Detailed Feedback
                    with col1:
                        st.markdown("### Detailed Analysis")
                        for item in feedback_items:
                            st.markdown(f"#### {item.get('category', 'Unnamed Category')} ({item.get('score', 0)}/10)")
                            st.progress(item.get('score', 0)/10)
                            st.info(f"**💬 Comment:** {item.get('comment', 'N/A')}")
                            st.warning("**💡 Improvements:**")
                            for point in item.get("improvements", []):
                                st.markdown(f"- {point}")
                            st.divider()

                    # Right Column: Charts
                    with col2:
                        st.markdown("### 📈 Scores Overview")
                        fig_bar, ax_bar = plt.subplots(facecolor="#0e1117")
                        ax_bar.set_facecolor("#1c1c1c")
                        ax_bar.barh(categories, scores, color="#ff6b6b")
                        ax_bar.set_xlim(0,10)
                        ax_bar.set_xlabel("Score (out of 10)", color="white")
                        ax_bar.set_title("Scores by Category", pad=10, color="white")
                        ax_bar.tick_params(colors="white")
                        st.pyplot(fig_bar)

                        st.markdown("### 🕸️ Performance Radar")
                        N = len(categories)
                        angles = [n / float(N) * 2 * pi for n in range(N)]
                        angles += angles[:1]
                        scores_plot = scores + scores[:1]

                        fig_radar, ax_radar = plt.subplots(subplot_kw={'polar': True}, facecolor="#0e1117")
                        ax_radar.set_facecolor("#1c1c1c")
                        ax_radar.plot(angles, scores_plot, linewidth=2, linestyle='solid', color="#feca57")
                        ax_radar.fill(angles, scores_plot, '#ff6b6b', alpha=0.4)
                        ax_radar.set_xticks(angles[:-1])
                        ax_radar.set_xticklabels(categories, color="white")
                        ax_radar.set_yticks([2,4,6,8,10])
                        ax_radar.set_yticklabels(["2","4","6","8","10"], color="white")
                        ax_radar.set_ylim(0,10)
                        st.pyplot(fig_radar)

                st.markdown('</div>', unsafe_allow_html=True)

            # --- Facial Gesture Metrics ---
            gesture_metrics = result.get("gesture_metrics", {})
            if gesture_metrics:
                with st.container():
                    st.markdown('<div class="report-container">', unsafe_allow_html=True)
                    st.subheader("😀 Facial Gesture Metrics")

                    st.markdown(f"- **Smile Score (ratio):** {gesture_metrics.get('smile_mean', 0):.3f}")
                    st.markdown(f"- **Eyebrow Raise:** {gesture_metrics.get('eyebrow_raise_mean', 0):.3f}")
                    st.markdown(f"- **Blink Count:** {gesture_metrics.get('blink_count', 0)}")
                    st.markdown(f"- **Head Tilt Metric:** {gesture_metrics.get('head_pose_mean', 0):.3f}")

                    # Radar chart for gestures
                    categories_g = ['Smile', 'Eyebrow Raise', 'Blink Count', 'Head Tilt']
                    values = [
                        gesture_metrics.get('smile_mean', 0),
                        gesture_metrics.get('eyebrow_raise_mean', 0),
                        gesture_metrics.get('blink_count', 0),
                        gesture_metrics.get('head_pose_mean', 0)
                    ]
                    values[2] = min(values[2], 20)

                    N = len(categories_g)
                    angles = [n / float(N) * 2 * pi for n in range(N)]
                    angles += angles[:1]
                    values_plot = values + values[:1]

                    fig_g_radar, ax_g_radar = plt.subplots(subplot_kw={'polar': True}, facecolor="#0e1117")
                    ax_g_radar.set_facecolor("#1c1c1c")
                    ax_g_radar.plot(angles, values_plot, linewidth=2, linestyle='solid', color="#feca57")
                    ax_g_radar.fill(angles, values_plot, '#ff6b6b', alpha=0.4)
                    ax_g_radar.set_xticks(angles[:-1])
                    ax_g_radar.set_xticklabels(categories_g, color="white")
                    ax_g_radar.set_yticks([0, 0.5, 1, 2, 5, 10, 20])
                    ax_g_radar.set_ylim(0, max(values_plot)*1.2)
                    ax_g_radar.set_title("Facial Gesture Radar", color="white", pad=20)
                    st.pyplot(fig_g_radar)
                    st.markdown('</div>', unsafe_allow_html=True)

                # --- Confidence & Nervousness ---
                confidence, nervousness = estimate_confidence_nervousness(gesture_metrics)
                with st.container():
                    st.markdown('<div class="report-container">', unsafe_allow_html=True)
                    st.subheader("💪 Confidence & 😰 Nervousness Scores")
                    categories_cn = ["Confidence", "Nervousness"]
                    scores_cn = [confidence, nervousness]

                    # Bar chart
                    fig_bar_cn, ax_bar_cn = plt.subplots(facecolor="#0e1117")
                    ax_bar_cn.set_facecolor("#1c1c1c")
                    ax_bar_cn.barh(categories_cn, scores_cn, color="#feca57")
                    ax_bar_cn.set_xlim(0,10)
                    ax_bar_cn.set_xlabel("Score (0-10)", color="white")
                    ax_bar_cn.set_title("Confidence & Nervousness", color="white")
                    ax_bar_cn.tick_params(colors="white")
                    st.pyplot(fig_bar_cn)

                    # Radar chart
                    N = len(categories_cn)
                    angles = [n / float(N) * 2 * pi for n in range(N)]
                    angles += angles[:1]
                    scores_plot = scores_cn + scores_cn[:1]

                    fig_radar_cn, ax_radar_cn = plt.subplots(subplot_kw={'polar': True}, facecolor="#0e1117")
                    ax_radar_cn.set_facecolor("#1c1c1c")
                    ax_radar_cn.plot(angles, scores_plot, linewidth=2, linestyle='solid', color="#feca57")
                    ax_radar_cn.fill(angles, scores_plot, '#ff6b6b', alpha=0.4)
                    ax_radar_cn.set_xticks(angles[:-1])
                    ax_radar_cn.set_xticklabels(categories_cn, color="white")
                    ax_radar_cn.set_yticks([0,2,4,6,8,10])
                    ax_radar_cn.set_ylim(0,10)
                    ax_radar_cn.set_title("Confidence & Nervousness Radar", color="white", pad=20)
                    st.pyplot(fig_radar_cn)

                    st.markdown('</div>', unsafe_allow_html=True)

        else:
            st.error(f"❌ Analysis failed with status code {response.status_code}")
            st.code(response.text, language='text')