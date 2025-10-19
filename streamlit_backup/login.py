import streamlit as st
import sys
import os

# Add backend to path
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

try:
    from backend.database import login_user, register_user
    DB_AVAILABLE = True
except Exception as e:
    print(f"⚠️ Database not available: {e}")
    DB_AVAILABLE = False

# --- Page Configuration ---
st.set_page_config(
    page_title="🎤 Extempore Evaluator - Login", 
    layout="centered", 
    initial_sidebar_state="collapsed"
)

# --- Custom Styling ---
st.markdown("""
<style>
    .stApp { 
        background: linear-gradient(135deg, #0e1117 0%, #1a1a2e 100%);
        color: #f5f5f5; 
    }
    
    .login-container {
        background-color: #1c1c1c;
        border-radius: 1rem;
        padding: 3rem 2rem;
        box-shadow: 0 8px 32px 0 rgba(255, 107, 107, 0.2);
        border: 1px solid rgba(254, 202, 87, 0.1);
        max-width: 450px;
        margin: auto;
    }
    
    .logo-text {
        text-align: center;
        font-size: 3rem;
        margin-bottom: 0.5rem;
    }
    
    .app-title {
        text-align: center;
        color: #feca57;
        font-size: 2rem;
        margin-bottom: 0.5rem;
        font-weight: 700;
    }
    
    .app-subtitle {
        text-align: center;
        color: #a0a0a0;
        font-size: 1rem;
        margin-bottom: 2rem;
    }
    
    div.stButton > button {
        background: linear-gradient(90deg, #ff6b6b 0%, #feca57 100%);
        color: white;
        font-size: 18px;
        font-weight: 600;
        border-radius: 0.5rem;
        height: 50px;
        width: 100%;
        border: none;
        margin-top: 1rem;
        transition: all 0.3s ease;
    }
    
    div.stButton > button:hover {
        transform: translateY(-2px);
        box-shadow: 0 6px 20px rgba(255, 107, 107, 0.4);
    }
    
    .stTextInput > div > div > input {
        background-color: #2a2a2a;
        color: #f5f5f5;
        border: 1px solid #404040;
        border-radius: 0.5rem;
        padding: 12px;
        font-size: 16px;
    }
    
    .stTextInput > div > div > input:focus {
        border-color: #feca57;
        box-shadow: 0 0 0 1px #feca57;
    }
    
    .divider {
        text-align: center;
        margin: 2rem 0;
        color: #666;
        position: relative;
    }
    
    .divider::before,
    .divider::after {
        content: "";
        position: absolute;
        top: 50%;
        width: 40%;
        height: 1px;
        background: #404040;
    }
    
    .divider::before { left: 0; }
    .divider::after { right: 0; }
    
    .signup-link {
        text-align: center;
        margin-top: 1.5rem;
        color: #a0a0a0;
    }
    
    .feature-list {
        background-color: #252525;
        border-radius: 0.5rem;
        padding: 1rem;
        margin-top: 1rem;
    }
    
    .feature-item {
        color: #b0b0b0;
        margin: 0.5rem 0;
        padding-left: 1.5rem;
        position: relative;
    }
    
    .feature-item::before {
        content: "✓";
        position: absolute;
        left: 0;
        color: #feca57;
        font-weight: bold;
    }
</style>
""", unsafe_allow_html=True)

# Initialize session state
if 'logged_in' not in st.session_state:
    st.session_state.logged_in = False
if 'show_signup' not in st.session_state:
    st.session_state.show_signup = False

# --- Login/Signup Logic ---
def handle_login(username, password):
    """Handle user login with database"""
    if not username or not password:
        return False, "Please enter both username and password"
    
    if DB_AVAILABLE:
        result = login_user(username, password)
        if result['success']:
            st.session_state.logged_in = True
            st.session_state.username = result['username']
            st.session_state.user_id = result['user_id']
            st.session_state.email = result['email']
            return True, "Login successful"
        return False, result.get('message', 'Invalid credentials')
    else:
        # Fallback: accept any non-empty credentials
        if username and password:
            st.session_state.logged_in = True
            st.session_state.username = username
            st.session_state.user_id = None
            return True, "Login successful (DB offline)"
        return False, "Invalid credentials"

def handle_signup(username, email, password):
    """Handle user registration with database"""
    if not username or not email or not password:
        return False, "All fields are required"
    
    if DB_AVAILABLE:
        result = register_user(username, email, password)
        if result['success']:
            return True, "Account created successfully! Please login."
        return False, result.get('message', 'Registration failed')
    else:
        return False, "Database not available. Cannot register."

# --- Main UI ---
if not st.session_state.logged_in:
    # Center content
    col1, col2, col3 = st.columns([1, 2, 1])
    
    with col2:
        st.markdown('<div class="login-container">', unsafe_allow_html=True)
        
        # Logo and Title
        st.markdown('<div class="logo-text">🎤</div>', unsafe_allow_html=True)
        st.markdown('<div class="app-title">Extempore Evaluator</div>', unsafe_allow_html=True)
        st.markdown('<div class="app-subtitle">AI-Powered Speech Analysis</div>', unsafe_allow_html=True)
        
        if not DB_AVAILABLE:
            st.warning("⚠️ Database offline - Guest mode only")
        
        # Toggle between Login and Signup
        if not st.session_state.show_signup:
            # --- LOGIN FORM ---
            st.markdown("### Welcome Back!")
            
            username = st.text_input("Username", placeholder="Enter your username", key="login_username")
            password = st.text_input("Password", type="password", placeholder="Enter your password", key="login_password")
            
            col_login1, col_login2 = st.columns(2)
            with col_login1:
                remember_me = st.checkbox("Remember me")
            
            if st.button("Login 🚀"):
                success, message = handle_login(username, password)
                if success:
                    st.success(f"✅ {message}")
                    st.rerun()
                else:
                    st.error(f"❌ {message}")
            
            st.markdown('<div class="divider">OR</div>', unsafe_allow_html=True)
            
            if st.button("Continue as Guest"):
                st.session_state.logged_in = True
                st.session_state.username = "Guest"
                st.session_state.user_id = None
                st.rerun()
            
            if st.button("Create New Account", key="show_signup_btn"):
                st.session_state.show_signup = True
                st.rerun()
        
        else:
            # --- SIGNUP FORM ---
            st.markdown("### Create Account")
            
            new_username = st.text_input("Username", placeholder="Choose a username", key="signup_username")
            new_email = st.text_input("Email", placeholder="Enter your email", key="signup_email")
            new_password = st.text_input("Password", type="password", placeholder="Create a password (min 6 characters)", key="signup_password")
            confirm_password = st.text_input("Confirm Password", type="password", placeholder="Confirm your password", key="confirm_password")
            
            accept_terms = st.checkbox("I agree to the Terms & Conditions")
            
            if st.button("Sign Up 🎉"):
                if new_password != confirm_password:
                    st.error("❌ Passwords don't match!")
                elif len(new_password) < 6:
                    st.error("❌ Password must be at least 6 characters!")
                elif not accept_terms:
                    st.error("❌ Please accept the Terms & Conditions")
                elif "@" not in new_email:
                    st.error("❌ Please enter a valid email address")
                else:
                    success, message = handle_signup(new_username, new_email, new_password)
                    if success:
                        st.success(f"✅ {message}")
                        st.session_state.show_signup = False
                        st.rerun()
                    else:
                        st.error(f"❌ {message}")
            
            if st.button("Back to Login", key="back_to_login"):
                st.session_state.show_signup = False
                st.rerun()
        
        st.markdown('</div>', unsafe_allow_html=True)
        
        # Features Section
        st.markdown('<div class="feature-list">', unsafe_allow_html=True)
        st.markdown('<div class="feature-item">AI-powered speech transcription</div>', unsafe_allow_html=True)
        st.markdown('<div class="feature-item">Real-time gesture analysis</div>', unsafe_allow_html=True)
        st.markdown('<div class="feature-item">Comprehensive feedback & scoring</div>', unsafe_allow_html=True)
        st.markdown('<div class="feature-item">Confidence & nervousness metrics</div>', unsafe_allow_html=True)
        st.markdown('</div>', unsafe_allow_html=True)