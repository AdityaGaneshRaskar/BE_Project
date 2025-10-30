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
        
        # Enhanced speech analyses table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS speech_analyses (
                analysis_id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(user_id) ON DELETE CASCADE,
                filename VARCHAR(255),
                video_path VARCHAR(500),
                topic TEXT,
                transcription TEXT,
                
                -- Feedback scores
                clarity_score FLOAT,
                clarity_comment TEXT,
                arguments_score FLOAT,
                arguments_comment TEXT,
                grammar_score FLOAT,
                grammar_comment TEXT,
                delivery_score FLOAT,
                delivery_comment TEXT,
                overall_score FLOAT,
                overall_comment TEXT,
                
                -- Gesture metrics
                smile_mean FLOAT,
                eyebrow_raise_mean FLOAT,
                blink_count INTEGER,
                head_pose_mean FLOAT,
                
                -- Calculated metrics
                confidence_score FLOAT,
                nervousness_score FLOAT,
                
                -- File info
                file_duration FLOAT,
                file_size INTEGER,
                
                -- Timestamps
                analyzed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                
                -- Session tracking
                session_number INTEGER DEFAULT 1
            )
        """)
        
        # Check if topic column exists, if not add it
        cursor.execute("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name='speech_analyses' AND column_name='topic'
        """)
        
        if cursor.fetchone() is None:
            print("⚠️ Adding missing 'topic' column to speech_analyses table...")
            cursor.execute("""
                ALTER TABLE speech_analyses 
                ADD COLUMN topic TEXT
            """)
            print("✅ 'topic' column added successfully")
        
        # Create index for faster queries
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_user_analyses 
            ON speech_analyses(user_id, analyzed_at DESC)
        """)
        
        conn.commit()
        print("✅ Database tables created/verified successfully")
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
    """Save speech analysis results with enhanced tracking"""
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        
        feedback = analysis_data.get('feedback', {})
        gesture_metrics = analysis_data.get('gesture_metrics', {})
        
        # Get session number (count of previous analyses + 1)
        cursor.execute(
            "SELECT COUNT(*) FROM speech_analyses WHERE user_id = %s",
            (user_id,)
        )
        session_number = cursor.fetchone()[0] + 1
        
        # Safely extract topic with default empty string
        topic = analysis_data.get('topic', '')
        
        cursor.execute("""
            INSERT INTO speech_analyses (
                user_id, filename, video_path, topic, transcription,
                clarity_score, clarity_comment,
                arguments_score, arguments_comment,
                grammar_score, grammar_comment,
                delivery_score, delivery_comment,
                overall_score, overall_comment,
                smile_mean, eyebrow_raise_mean, blink_count, head_pose_mean,
                confidence_score, nervousness_score,
                file_duration, file_size,
                session_number
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING analysis_id
        """, (
            user_id,
            analysis_data.get('filename', ''),
            analysis_data.get('video_path', ''),
            topic,
            analysis_data.get('transcription', ''),
            feedback.get('Clarity', {}).get('score', 0),
            feedback.get('Clarity', {}).get('comment', ''),
            feedback.get('Arguments', {}).get('score', 0),
            feedback.get('Arguments', {}).get('comment', ''),
            feedback.get('Grammar', {}).get('score', 0),
            feedback.get('Grammar', {}).get('comment', ''),
            feedback.get('Delivery', {}).get('score', 0),
            feedback.get('Delivery', {}).get('comment', ''),
            feedback.get('Overall', {}).get('score', 0),
            feedback.get('Overall', {}).get('comment', ''),
            gesture_metrics.get('smile_mean', 0),
            gesture_metrics.get('eyebrow_raise_mean', 0),
            gesture_metrics.get('blink_count', 0),
            gesture_metrics.get('head_pose_mean', 0),
            analysis_data.get('confidence_score', 0),
            analysis_data.get('nervousness_score', 0),
            analysis_data.get('file_duration', 0),
            analysis_data.get('file_size', 0),
            session_number
        ))
        
        analysis_id = cursor.fetchone()[0]
        conn.commit()
        print(f"✅ Analysis saved successfully: ID {analysis_id}, Session {session_number}")
        return {"success": True, "analysis_id": analysis_id, "session_number": session_number}
    except Exception as e:
        conn.rollback()
        print(f"❌ Error saving analysis: {e}")
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
            SELECT analysis_id, filename, topic, overall_score, 
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
                "topic": row[2],
                "overall_score": row[3],
                "confidence_score": row[4],
                "nervousness_score": row[5],
                "analyzed_at": row[6].strftime("%Y-%m-%d %H:%M:%S")
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

def get_user_statistics(user_id):
    """Get user's overall statistics and progress"""
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        
        # Get overall statistics
        cursor.execute("""
            SELECT 
                COUNT(*) as total_analyses,
                AVG(overall_score) as avg_overall_score,
                AVG(confidence_score) as avg_confidence,
                AVG(nervousness_score) as avg_nervousness,
                MAX(overall_score) as best_score,
                MIN(overall_score) as worst_score
            FROM speech_analyses
            WHERE user_id = %s
        """, (user_id,))
        
        stats = cursor.fetchone()
        
        # Get improvement trend (last 5 vs first 5)
        cursor.execute("""
            SELECT overall_score, session_number, analyzed_at
            FROM speech_analyses
            WHERE user_id = %s
            ORDER BY analyzed_at DESC
            LIMIT 5
        """, (user_id,))
        recent_scores = cursor.fetchall()
        
        cursor.execute("""
            SELECT overall_score, session_number, analyzed_at
            FROM speech_analyses
            WHERE user_id = %s
            ORDER BY analyzed_at ASC
            LIMIT 5
        """, (user_id,))
        first_scores = cursor.fetchall()
        
        return {
            "success": True,
            "statistics": {
                "total_analyses": stats[0] or 0,
                "avg_overall_score": round(stats[1] or 0, 2),
                "avg_confidence": round(stats[2] or 0, 2),
                "avg_nervousness": round(stats[3] or 0, 2),
                "best_score": round(stats[4] or 0, 2),
                "worst_score": round(stats[5] or 0, 2)
            },
            "recent_scores": [{"score": s[0], "session": s[1], "date": s[2].strftime("%Y-%m-%d")} for s in recent_scores],
            "first_scores": [{"score": s[0], "session": s[1], "date": s[2].strftime("%Y-%m-%d")} for s in first_scores]
        }
    except Exception as e:
        return {"success": False, "message": f"Error: {str(e)}"}
    finally:
        cursor.close()
        release_db_connection(conn)

def get_detailed_history(user_id, limit=20):
    """Get user's detailed speech analysis history"""
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT 
                analysis_id, session_number, filename, topic,
                clarity_score, arguments_score, grammar_score, 
                delivery_score, overall_score,
                confidence_score, nervousness_score,
                smile_mean, eyebrow_raise_mean, blink_count, head_pose_mean,
                analyzed_at
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
                "session_number": row[1],
                "filename": row[2],
                "topic": row[3],
                "scores": {
                    "clarity": round(row[4] or 0, 1),
                    "arguments": round(row[5] or 0, 1),
                    "grammar": round(row[6] or 0, 1),
                    "delivery": round(row[7] or 0, 1),
                    "overall": round(row[8] or 0, 1)
                },
                "confidence_score": round(row[9] or 0, 1),
                "nervousness_score": round(row[10] or 0, 1),
                "gestures": {
                    "smile": round(row[11] or 0, 3),
                    "eyebrow": round(row[12] or 0, 3),
                    "blink": row[13] or 0,
                    "head_tilt": round(row[14] or 0, 3)
                },
                "analyzed_at": row[15].strftime("%Y-%m-%d %H:%M:%S")
            })
        return {"success": True, "history": history}
    except Exception as e:
        return {"success": False, "message": f"Error: {str(e)}"}
    finally:
        cursor.close()
        release_db_connection(conn)

def compare_analyses(user_id, analysis_id_1, analysis_id_2):
    """Compare two analyses side by side"""
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT 
                analysis_id, session_number, filename, topic, transcription,
                clarity_score, clarity_comment,
                arguments_score, arguments_comment,
                grammar_score, grammar_comment,
                delivery_score, delivery_comment,
                overall_score, overall_comment,
                confidence_score, nervousness_score,
                smile_mean, eyebrow_raise_mean, blink_count, head_pose_mean,
                analyzed_at
            FROM speech_analyses
            WHERE user_id = %s AND analysis_id IN (%s, %s)
            ORDER BY analyzed_at ASC
        """, (user_id, analysis_id_1, analysis_id_2))
        
        results = cursor.fetchall()
        
        if len(results) != 2:
            return {"success": False, "message": "One or both analyses not found"}
        
        analyses = []
        for row in results:
            analyses.append({
                "analysis_id": row[0],
                "session_number": row[1],
                "filename": row[2],
                "topic": row[3],
                "transcription": row[4],
                "feedback": {
                    "clarity": {"score": row[5], "comment": row[6]},
                    "arguments": {"score": row[7], "comment": row[8]},
                    "grammar": {"score": row[9], "comment": row[10]},
                    "delivery": {"score": row[11], "comment": row[12]},
                    "overall": {"score": row[13], "comment": row[14]}
                },
                "confidence_score": row[15],
                "nervousness_score": row[16],
                "gestures": {
                    "smile": row[17],
                    "eyebrow": row[18],
                    "blink": row[19],
                    "head_tilt": row[20]
                },
                "analyzed_at": row[21].strftime("%Y-%m-%d %H:%M:%S")
            })
        
        # Calculate improvements
        improvement = {
            "clarity": round(analyses[1]["feedback"]["clarity"]["score"] - analyses[0]["feedback"]["clarity"]["score"], 1),
            "arguments": round(analyses[1]["feedback"]["arguments"]["score"] - analyses[0]["feedback"]["arguments"]["score"], 1),
            "grammar": round(analyses[1]["feedback"]["grammar"]["score"] - analyses[0]["feedback"]["grammar"]["score"], 1),
            "delivery": round(analyses[1]["feedback"]["delivery"]["score"] - analyses[0]["feedback"]["delivery"]["score"], 1),
            "overall": round(analyses[1]["feedback"]["overall"]["score"] - analyses[0]["feedback"]["overall"]["score"], 1),
            "confidence": round(analyses[1]["confidence_score"] - analyses[0]["confidence_score"], 1),
            "nervousness": round(analyses[1]["nervousness_score"] - analyses[0]["nervousness_score"], 1)
        }
        
        return {
            "success": True,
            "comparison": {
                "older": analyses[0],
                "newer": analyses[1],
                "improvement": improvement
            }
        }
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