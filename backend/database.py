# backend/database.py
import psycopg2
from psycopg2 import pool
import hashlib
import os
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()

# Database connection pool
db_pool = None

def init_db_pool():
    """Initialize database connection pool"""
    global db_pool
    try:
        db_pool = psycopg2.pool.SimpleConnectionPool(
            1, 20,
            host=os.getenv("DB_HOST", "localhost"),
            database=os.getenv("DB_NAME", "extempore_db"),
            user=os.getenv("DB_USER", "postgres"),
            password=os.getenv("DB_PASSWORD", "your_password"),
            port=os.getenv("DB_PORT", "5432")
        )
        print("✅ Database connection pool created successfully")
        create_tables()
    except Exception as e:
        print(f"❌ Error creating connection pool: {e}")
        raise

def get_db_connection():
    """Get a connection from the pool"""
    return db_pool.getconn()

def release_db_connection(conn):
    """Return a connection to the pool"""
    db_pool.putconn(conn)

def create_tables():
    """Create necessary database tables"""
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        
        # Users table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS users (
                user_id SERIAL PRIMARY KEY,
                username VARCHAR(50) UNIQUE NOT NULL,
                email VARCHAR(100) UNIQUE NOT NULL,
                password_hash VARCHAR(64) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                last_login TIMESTAMP
            )
        """)
        
        # Speech analyses table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS speech_analyses (
                analysis_id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(user_id) ON DELETE CASCADE,
                filename VARCHAR(255),
                transcription TEXT,
                clarity_score FLOAT,
                arguments_score FLOAT,
                grammar_score FLOAT,
                delivery_score FLOAT,
                overall_score FLOAT,
                smile_mean FLOAT,
                eyebrow_raise_mean FLOAT,
                blink_count INTEGER,
                head_pose_mean FLOAT,
                confidence_score FLOAT,
                nervousness_score FLOAT,
                analyzed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        conn.commit()
        print("✅ Database tables created successfully")
    except Exception as e:
        print(f"❌ Error creating tables: {e}")
        conn.rollback()
    finally:
        cursor.close()
        release_db_connection(conn)

def hash_password(password):
    """Hash a password using SHA-256"""
    return hashlib.sha256(password.encode()).hexdigest()

def register_user(username, email, password):
    """Register a new user"""
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        password_hash = hash_password(password)
        
        cursor.execute(
            "INSERT INTO users (username, email, password_hash) VALUES (%s, %s, %s) RETURNING user_id",
            (username, email, password_hash)
        )
        user_id = cursor.fetchone()[0]
        conn.commit()
        return {"success": True, "user_id": user_id, "message": "User registered successfully"}
    except psycopg2.IntegrityError as e:
        conn.rollback()
        if "username" in str(e):
            return {"success": False, "message": "Username already exists"}
        elif "email" in str(e):
            return {"success": False, "message": "Email already exists"}
        return {"success": False, "message": "Registration failed"}
    except Exception as e:
        conn.rollback()
        return {"success": False, "message": f"Error: {str(e)}"}
    finally:
        cursor.close()
        release_db_connection(conn)

def login_user(username, password):
    """Authenticate a user"""
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        password_hash = hash_password(password)
        
        cursor.execute(
            "SELECT user_id, username, email FROM users WHERE username = %s AND password_hash = %s",
            (username, password_hash)
        )
        user = cursor.fetchone()
        
        if user:
            # Update last login
            cursor.execute(
                "UPDATE users SET last_login = %s WHERE user_id = %s",
                (datetime.now(), user[0])
            )
            conn.commit()
            return {
                "success": True,
                "user_id": user[0],
                "username": user[1],
                "email": user[2]
            }
        return {"success": False, "message": "Invalid username or password"}
    except Exception as e:
        return {"success": False, "message": f"Error: {str(e)}"}
    finally:
        cursor.close()
        release_db_connection(conn)

def save_analysis(user_id, analysis_data):
    """Save speech analysis results"""
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        
        feedback = analysis_data.get('feedback', {})
        gesture_metrics = analysis_data.get('gesture_metrics', {})
        
        cursor.execute("""
            INSERT INTO speech_analyses (
                user_id, filename, transcription,
                clarity_score, arguments_score, grammar_score, 
                delivery_score, overall_score,
                smile_mean, eyebrow_raise_mean, blink_count, head_pose_mean,
                confidence_score, nervousness_score
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING analysis_id
        """, (
            user_id,
            analysis_data.get('filename', ''),
            analysis_data.get('transcription', ''),
            feedback.get('Clarity', {}).get('score', 0),
            feedback.get('Arguments', {}).get('score', 0),
            feedback.get('Grammar', {}).get('score', 0),
            feedback.get('Delivery', {}).get('score', 0),
            feedback.get('Overall', {}).get('score', 0),
            gesture_metrics.get('smile_mean', 0),
            gesture_metrics.get('eyebrow_raise_mean', 0),
            gesture_metrics.get('blink_count', 0),
            gesture_metrics.get('head_pose_mean', 0),
            analysis_data.get('confidence_score', 0),
            analysis_data.get('nervousness_score', 0)
        ))
        
        analysis_id = cursor.fetchone()[0]
        conn.commit()
        return {"success": True, "analysis_id": analysis_id}
    except Exception as e:
        conn.rollback()
        return {"success": False, "message": f"Error: {str(e)}"}
    finally:
        cursor.close()
        release_db_connection(conn)

def get_user_history(user_id, limit=10):
    """Get user's speech analysis history"""
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT analysis_id, filename, overall_score, 
                   confidence_score, nervousness_score, analyzed_at
            FROM speech_analyses
            WHERE user_id = %s
            ORDER BY analyzed_at DESC
            LIMIT %s
        """, (user_id, limit))
        
        results = cursor.fetchall()
        history = []
        for row in results:
            history.append({
                "analysis_id": row[0],
                "filename": row[1],
                "overall_score": row[2],
                "confidence_score": row[3],
                "nervousness_score": row[4],
                "analyzed_at": row[5].strftime("%Y-%m-%d %H:%M:%S")
            })
        return {"success": True, "history": history}
    except Exception as e:
        return {"success": False, "message": f"Error: {str(e)}"}
    finally:
        cursor.close()
        release_db_connection(conn)

def get_analysis_details(analysis_id):
    """Get detailed analysis by ID"""
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT * FROM speech_analyses WHERE analysis_id = %s
        """, (analysis_id,))
        
        result = cursor.fetchone()
        if result:
            return {"success": True, "analysis": result}
        return {"success": False, "message": "Analysis not found"}
    except Exception as e:
        return {"success": False, "message": f"Error: {str(e)}"}
    finally:
        cursor.close()
        release_db_connection(conn)

# Initialize the database pool when module is imported
if db_pool is None:
    try:
        init_db_pool()
    except Exception as e:
        print(f"⚠️ Warning: Database not initialized. Error: {e}")