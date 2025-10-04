import streamlit as st

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
    
    .signup-link a {
        color: #feca57;
        text-decoration: none;
        font-weight: 600;
    }
    
    .signup-link a:hover {
        color: #ff6b6b;
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
def login_user(username, password):
    # TODO: Add actual authentication logic here
    # For now, accept any non-empty credentials
    if username and password:
        st.session_state.logged_in = True
        st.session_state.username = username
        return True
    return False

def signup_user(username, email, password):
    # TODO: Add actual user registration logic here
    if username and email and password:
        st.success("✅ Account created successfully! Please login.")
        st.session_state.show_signup = False
        return True
    return False

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
        
        # Toggle between Login and Signup
        if not st.session_state.show_signup:
            # --- LOGIN FORM ---
            st.markdown("### Welcome Back!")
            
            username = st.text_input("Username", placeholder="Enter your username", key="login_username")
            password = st.text_input("Password", type="password", placeholder="Enter your password", key="login_password")
            
            col_login1, col_login2 = st.columns(2)
            with col_login1:
                remember_me = st.checkbox("Remember me")
            with col_login2:
                st.markdown('<p style="text-align: right; margin-top: 0.5rem;"><a href="#" style="color: #feca57; text-decoration: none;">Forgot Password?</a></p>', unsafe_allow_html=True)
            
            if st.button("Login 🚀"):
                if login_user(username, password):
                    st.success("✅ Login successful!")
                    st.rerun()
                else:
                    st.error("❌ Please enter valid credentials")
            
            st.markdown('<div class="divider">OR</div>', unsafe_allow_html=True)
            
            if st.button("Continue as Guest"):
                st.session_state.logged_in = True
                st.session_state.username = "Guest"
                st.rerun()
            
            st.markdown('<div class="signup-link">Don\'t have an account? <a href="#" id="show_signup">Sign Up</a></div>', unsafe_allow_html=True)
            
            if st.button("Create New Account", key="show_signup_btn"):
                st.session_state.show_signup = True
                st.rerun()
        
        else:
            # --- SIGNUP FORM ---
            st.markdown("### Create Account")
            
            new_username = st.text_input("Username", placeholder="Choose a username", key="signup_username")
            new_email = st.text_input("Email", placeholder="Enter your email", key="signup_email")
            new_password = st.text_input("Password", type="password", placeholder="Create a password", key="signup_password")
            confirm_password = st.text_input("Confirm Password", type="password", placeholder="Confirm your password", key="confirm_password")
            
            accept_terms = st.checkbox("I agree to the Terms & Conditions")
            
            if st.button("Sign Up 🎉"):
                if new_password != confirm_password:
                    st.error("❌ Passwords don't match!")
                elif not accept_terms:
                    st.error("❌ Please accept the Terms & Conditions")
                else:
                    signup_user(new_username, new_email, new_password)
            
            st.markdown('<div class="signup-link">Already have an account? <a href="#">Login</a></div>', unsafe_allow_html=True)
            
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

else:
    # --- LOGGED IN VIEW ---
    st.success(f"🎉 Welcome, {st.session_state.username}!")
    st.write("You are now logged in. Redirecting to main app...")
    
    if st.button("Go to Evaluator"):
        # TODO: Navigate to your main app.py
        st.info("🔄 Load your main app.py content here or use st.switch_page()")
    
    if st.button("Logout"):
        st.session_state.logged_in = False
        st.session_state.username = None
        st.rerun()