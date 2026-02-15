"""
Peer-to-Peer Mentorship Platform - Flask Backend

Features:
- User authentication (signup/login/logout)
- Profile management
- Mentor/mentee browsing with search
- Session requests and management
- Feedback system
"""

import os
import re
import logging
from datetime import datetime
from functools import wraps

from flask import Flask, jsonify, request, session as flask_session, send_from_directory
from flask_cors import CORS
from sqlalchemy.exc import OperationalError, IntegrityError
from werkzeug.security import check_password_hash, generate_password_hash

from config import config
from models import db, User, Session, SessionStatus, Feedback


# LOGGING CONFIGURATION

def setup_logging(app):
    """Configure application logging"""
    
    # Create logs directory if it doesn't exist
    log_dir = os.path.dirname(config.LOG_FILE)
    if not os.path.exists(log_dir):
        os.makedirs(log_dir)
    
    # Set log level
    log_level = getattr(logging, config.LOG_LEVEL.upper(), logging.INFO)
    
    # File handler
    file_handler = logging.FileHandler(config.LOG_FILE)
    file_handler.setLevel(log_level)
    file_formatter = logging.Formatter(
        '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    file_handler.setFormatter(file_formatter)
    
    # Console handler
    console_handler = logging.StreamHandler()
    console_handler.setLevel(log_level)
    console_formatter = logging.Formatter(
        '%(levelname)s - %(message)s'
    )
    console_handler.setFormatter(console_formatter)
    
    # Configure app logger
    app.logger.addHandler(file_handler)
    app.logger.addHandler(console_handler)
    app.logger.setLevel(log_level)
    
    app.logger.info("="*60)
    app.logger.info("APPLICATION STARTED")
    app.logger.info("="*60)
    app.logger.info(f"Environment: {config.FLASK_ENV}")
    app.logger.info(f"Debug mode: {config.DEBUG}")
    app.logger.info(f"Database: {config.DB_NAME}")
    app.logger.info("="*60)


# PASSWORD VALIDATION

def validate_password(password):
    """
    Validate password strength
    
    Requirements:
    - Minimum length (from config)
    - At least one uppercase letter
    - At least one lowercase letter
    - At least one number
    
    Returns:
        tuple: (is_valid: bool, error_message: str or None)
    """
    if not password:
        return False, "Password is required"
    
    if len(password) < config.PASSWORD_MIN_LENGTH:
        return False, f"Password must be at least {config.PASSWORD_MIN_LENGTH} characters long"
    
    if not re.search(r"[A-Z]", password):
        return False, "Password must contain at least one uppercase letter"
    
    if not re.search(r"[a-z]", password):
        return False, "Password must contain at least one lowercase letter"
    
    if not re.search(r"\d", password):
        return False, "Password must contain at least one number"
    
    return True, None


# APP FACTORY

def create_app():
    """Create and configure the Flask application"""
    
    app = Flask(
        __name__,
        static_folder="../frontend",
        static_url_path="",
    )
    
    # Load configuration
    app.config.from_object(config)
    
    # Setup logging
    setup_logging(app)
    
    # Initialize database
    db.init_app(app)
    
    # Enable CORS (allow frontend to send cookies)
    CORS(app, supports_credentials=True)
    
    # Create database tables
    with app.app_context():
        try:
            db.create_all()
            app.logger.info("Database tables created successfully")
        except OperationalError as e:
            app.logger.error(" Database connection failed!")
            app.logger.error(f"Error: {str(e)}")
            app.logger.error("Please check your database configuration in backend/.env")
            print("\n" + "="*60)
            print(" DATABASE CONNECTION FAILED")
            print("="*60)
            print("The server will start, but API endpoints requiring the database will fail.")
            print("Please check:")
            print("  1. MySQL is running")
            print("  2. Database credentials in backend/.env are correct")
            print("  3. Database 'mentorship_platform' exists")
            print("="*60 + "\n")
    
    # Register routes
    register_routes(app)
    
    app.logger.info("Application initialized successfully")
    
    return app


# AUTHENTICATION DECORATOR

def login_required(fn):
    """Decorator to require authentication for routes"""
    @wraps(fn)
    def wrapper(*args, **kwargs):
        user_id = flask_session.get("user_id")
        if not user_id:
            app.logger.warning(f"Unauthorized access attempt to {request.path}")
            return jsonify({"error": "Authentication required"}), 401
        return fn(*args, **kwargs)
    return wrapper


def get_current_user():
    """Get the currently authenticated user"""
    user_id = flask_session.get("user_id")
    if not user_id:
        return None
    return User.query.get(user_id)


# ROUTE REGISTRATION

def register_routes(app: Flask):
    """Register all application routes"""
    
    frontend_dir = os.path.abspath(os.path.join(app.root_path, "..", "frontend"))
    
    # FRONTEND ROUTES
    
    @app.route("/")
    def index():
        """Serve the main application page"""
        return send_from_directory(frontend_dir, "index.html")
    
    @app.route("/<path:filename>")
    def frontend_static(filename):
        """Serve frontend static files (CSS, JS, images)"""
        return send_from_directory(frontend_dir, filename)
    
    # HEALTH CHECK
    
    @app.route("/api/health", methods=["GET"])
    def health():
        """Health check endpoint to verify server and database status"""
        try:
            # Test database connection
            db.session.execute(db.text("SELECT 1"))
            app.logger.info("Health check: OK")
            return jsonify({"ok": True, "db": "up", "message": "Server is healthy"})
        except Exception as e:
            app.logger.error(f"Health check failed: {str(e)}")
            return jsonify({"ok": False, "db": "down", "error": str(e)}), 500
    
     
    # AUTHENTICATION ROUTES
    
    @app.route("/api/auth/signup", methods=["POST"])
    def signup():
        """
        User registration endpoint
        
        Request body:
            - name: str (required)
            - email: str (required)
            - password: str (required, min 8 chars)
            - role: str (optional, default: mentee)
            - bio: str (optional)
            - skills: str (optional)
            - interests: str (optional)
        
        Returns:
            201: User created successfully
            400: Validation error
            500: Server error
        """
        try:
            data = request.get_json() or {}
            
            # Extract and validate required fields
            name = data.get("name", "").strip()
            email = data.get("email", "").strip().lower()
            password = data.get("password", "")
            role = data.get("role", "mentee").strip().lower()
            
            # Validation
            if not name:
                app.logger.warning("Signup failed: Name is required")
                return jsonify({"error": "Name is required"}), 400
            
            if not email:
                app.logger.warning("Signup failed: Email is required")
                return jsonify({"error": "Email is required"}), 400
            
            if not password:
                app.logger.warning("Signup failed: Password is required")
                return jsonify({"error": "Password is required"}), 400
            
            # Validate email format
            email_pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
            if not re.match(email_pattern, email):
                app.logger.warning(f"Signup failed: Invalid email format: {email}")
                return jsonify({"error": "Invalid email format"}), 400
            
            # Validate password strength
            is_valid, error_msg = validate_password(password)
            if not is_valid:
                app.logger.warning(f"Signup failed: {error_msg}")
                return jsonify({"error": error_msg}), 400
            
            # Check if email already exists
            if User.query.filter_by(email=email).first():
                app.logger.warning(f"Signup failed: Email already registered: {email}")
                return jsonify({"error": "Email already registered"}), 400
            
            # Validate role
            if role not in {"mentor", "mentee", "both"}:
                role = "mentee"
            
            # Hash password
            password_hash = generate_password_hash(password)
            
            # Create user
            user = User(
                name=name,
                email=email,
                password_hash=password_hash,
                bio=data.get("bio", ""),
                interests=data.get("interests", ""),
                skills=data.get("skills", ""),
                role=role,
            )
            
            db.session.add(user)
            db.session.commit()
            
            # Auto-login after signup
            flask_session["user_id"] = user.id
            
            app.logger.info(f" User registered successfully: {email} (ID: {user.id})")
            
            return jsonify({"user": user.to_dict_basic(), "message": "Account created successfully"}), 201
            
        except IntegrityError as e:
            db.session.rollback()
            app.logger.error(f"Database integrity error during signup: {str(e)}")
            return jsonify({"error": "Email already registered"}), 400
        except Exception as e:
            db.session.rollback()
            app.logger.error(f"Unexpected error during signup: {str(e)}")
            return jsonify({"error": "An unexpected error occurred. Please try again."}), 500
    
    @app.route("/api/auth/login", methods=["POST"])
    def login():
        """
        User login endpoint
        
        Request body:
            - email: str (required)
            - password: str (required)
        
        Returns:
            200: Login successful
            400: Validation error
            401: Invalid credentials
        """
        try:
            data = request.get_json() or {}
            
            email = data.get("email", "").strip().lower()
            password = data.get("password", "")
            
            # Validation
            if not email or not password:
                app.logger.warning("Login failed: Email and password required")
                return jsonify({"error": "Email and password are required"}), 400
            
            # Find user
            user = User.query.filter_by(email=email).first()
            
            # Check credentials
            if not user or not check_password_hash(user.password_hash, password):
                app.logger.warning(f"Login failed: Invalid credentials for {email}")
                return jsonify({"error": "Invalid email or password"}), 401
            
            # Create session
            flask_session["user_id"] = user.id
            
            app.logger.info(f" User logged in: {email} (ID: {user.id})")
            
            return jsonify({"user": user.to_dict_basic(), "message": "Login successful"})
            
        except Exception as e:
            app.logger.error(f"Unexpected error during login: {str(e)}")
            return jsonify({"error": "An unexpected error occurred. Please try again."}), 500
    
    @app.route("/api/auth/logout", methods=["POST"])
    def logout():
        """User logout endpoint"""
        try:
            user_id = flask_session.get("user_id")
            flask_session.clear()
            
            if user_id:
                app.logger.info(f" User logged out: ID {user_id}")
            
            return jsonify({"message": "Logged out successfully"})
            
        except Exception as e:
            app.logger.error(f"Error during logout: {str(e)}")
            return jsonify({"error": "An error occurred during logout"}), 500
    
    @app.route("/api/auth/me", methods=["GET"])
    def me():
        """Get current authenticated user"""
        try:
            user = get_current_user()
            if not user:
                return jsonify({"user": None})
            
            return jsonify({"user": user.to_dict_basic()})
            
        except Exception as e:
            app.logger.error(f"Error fetching current user: {str(e)}")
            return jsonify({"user": None})
    
    # PROFILE ROUTES

    
    @app.route("/api/profile", methods=["GET", "PUT"])
    @login_required
    def profile():
        """Get or update user profile"""
        user = get_current_user()
        
        if request.method == "GET":
            return jsonify({"user": user.to_dict_basic()})
        
        # PUT - Update profile
        try:
            data = request.get_json() or {}
            
            # Update fields
            if "name" in data and data["name"].strip():
                user.name = data["name"].strip()
            
            if "bio" in data:
                user.bio = data["bio"].strip()
            
            if "interests" in data:
                user.interests = data["interests"].strip()
            
            if "skills" in data:
                user.skills = data["skills"].strip()

            if "experience_years" in data and user.role in ("mentor", "both"):
                try:
                    val = data.get("experience_years")
                    if val is None or val == "":
                        user.experience_years = None
                    else:
                        user.experience_years = int(val) if int(val) >= 0 else None
                except (TypeError, ValueError):
                    user.experience_years = None
            
            if "role" in data:
                role = data["role"].strip().lower()
                if role in {"mentor", "mentee", "both"}:
                    user.role = role
            
            db.session.commit()
            
            app.logger.info(f"Profile updated: User ID {user.id}")
            
            return jsonify({"user": user.to_dict_basic(), "message": "Profile updated successfully"})
            
        except Exception as e:
            db.session.rollback()
            app.logger.error(f"Error updating profile: {str(e)}")
            return jsonify({"error": "Failed to update profile"}), 500
    
    # USER ROUTES
    
    @app.route("/api/users", methods=["GET"])
    @login_required
    def list_users():
        """
        List users with optional filtering
        
        Query parameters:
            - q: Search query (searches name, interests, skills)
            - role: Filter by role (mentor, mentee, both)
            - show_all: If true, show all users (default: only mentor/both)
        
        Returns:
            List of users (excludes current user, emails hidden)
        """
        try:
            current_user = get_current_user()
            query = User.query
            
            # Filter by role
            role = request.args.get("role", "").strip().lower()
            show_all = request.args.get("show_all", "").lower() == "true"
            
            if role in {"mentor", "mentee", "both"}:
                query = query.filter(User.role == role)
            elif not show_all:
                # Default: only show mentors and users who can mentor (both)
                query = query.filter(User.role.in_(["mentor", "both"]))
            
            # Search filter
            search = request.args.get("q", "").strip()
            if search:
                like_pattern = f"%{search}%"
                query = query.filter(
                    (User.name.ilike(like_pattern)) |
                    (User.interests.ilike(like_pattern)) |
                    (User.skills.ilike(like_pattern))
                )
            
            # Exclude current user
            if current_user:
                query = query.filter(User.id != current_user.id)
            
            # Execute query
            users = query.order_by(User.created_at.desc()).all()
            
            # Calculate average rating for each user
            users_data = []
            for user in users:
                user_dict = user.to_dict_basic()
                # Remove email for privacy (only show in profile)
                user_dict.pop('email', None)
                
                # Calculate average rating
                feedbacks = Feedback.query.filter_by(target_user_id=user.id).all()
                if feedbacks:
                    avg_rating = sum(f.rating for f in feedbacks) / len(feedbacks)
                    user_dict['average_rating'] = round(avg_rating, 1)
                    user_dict['total_reviews'] = len(feedbacks)
                else:
                    user_dict['average_rating'] = None
                    user_dict['total_reviews'] = 0
                
                users_data.append(user_dict)
            
            app.logger.info(f"Users query: Found {len(users_data)} users (search: '{search}', role: '{role}')")
            
            return jsonify({"users": users_data})
            
        except Exception as e:
            app.logger.error(f"Error listing users: {str(e)}")
            return jsonify({"error": "Failed to fetch users"}), 500
    
    # SESSION ROUTES
    
    @app.route("/api/sessions", methods=["GET", "POST"])
    @login_required
    def sessions_route():
        """Get user's sessions or create a new session request"""
        user = get_current_user()
        
        if request.method == "GET":
            # Get sessions where user is requester or mentor
            try:
                sessions = Session.query.filter(
                    (Session.requester_id == user.id) |
                    (Session.mentor_id == user.id)
                ).order_by(Session.created_at.desc()).all()
                
                app.logger.info(f"Sessions query: Found {len(sessions)} sessions for User ID {user.id}")
                
                return jsonify({"sessions": [s.to_dict() for s in sessions]})
                
            except Exception as e:
                app.logger.error(f"Error fetching sessions: {str(e)}")
                return jsonify({"error": "Failed to fetch sessions"}), 500
        
        # POST - Create new session request
        try:
            data = request.get_json() or {}
            
            mentor_id = data.get("mentor_id")
            topic = data.get("topic", "").strip()
            description = data.get("description", "").strip()
            scheduled_time_str = data.get("scheduled_time")
            meeting_link = data.get("meeting_link", "").strip()
            
            # Validation
            if not mentor_id or not topic:
                app.logger.warning("Session creation failed: Mentor and topic required")
                return jsonify({"error": "Mentor and topic are required"}), 400
            
            if mentor_id == user.id:
                app.logger.warning(f"Session creation failed: User {user.id} tried to request themselves")
                return jsonify({"error": "You cannot request yourself as a mentor"}), 400
            
            # Check mentor exists
            mentor = User.query.get(mentor_id)
            if not mentor:
                app.logger.warning(f"Session creation failed: Mentor ID {mentor_id} not found")
                return jsonify({"error": "Mentor not found"}), 404
            
            #Validate mentor role
            if mentor.role not in ["mentor", "both"]:
                app.logger.warning(f"Session creation failed: User {mentor_id} is not a mentor (role: {mentor.role})")
                return jsonify({"error": "This user is not available as a mentor"}), 400
            
            # Check for duplicate pending/accepted sessions
            existing_session = Session.query.filter(
                Session.requester_id == user.id,
                Session.mentor_id == mentor_id,
                Session.topic == topic,
                Session.status.in_(["pending", "accepted"])
            ).first()
            
            if existing_session:
                app.logger.warning(f"Session creation failed: Duplicate session exists (ID: {existing_session.id})")
                return jsonify({"error": "You already have a pending or accepted session with this mentor for this topic"}), 400
            
            # Parse scheduled time
            scheduled_time = None
            if scheduled_time_str:
                try:
                    scheduled_time = datetime.fromisoformat(scheduled_time_str)
                except ValueError:
                    app.logger.warning(f"Session creation failed: Invalid datetime format: {scheduled_time_str}")
                    return jsonify({"error": "Invalid scheduled_time format. Use ISO 8601 format."}), 400
            
            # Create session
            session_obj = Session(
                requester_id=user.id,
                mentor_id=mentor_id,
                topic=topic,
                description=description,
                scheduled_time=scheduled_time,
                meeting_link=meeting_link,
            )
            
            db.session.add(session_obj)
            db.session.commit()
            
            app.logger.info(f"Session created: ID {session_obj.id}, Requester: {user.id}, Mentor: {mentor_id}")
            
            return jsonify({"session": session_obj.to_dict(), "message": "Session request sent"}), 201
            
        except Exception as e:
            db.session.rollback()
            app.logger.error(f"Error creating session: {str(e)}")
            return jsonify({"error": "Failed to create session"}), 500
    
    @app.route("/api/sessions/<int:session_id>/status", methods=["PUT"])
    @login_required
    def update_session_status(session_id):
        """Update session status (accept/reject/complete) and optionally add meeting link"""
        try:
            user = get_current_user()
            session_obj = Session.query.get_or_404(session_id)
            
            data = request.get_json() or {}
            new_status = data.get("status")
            meeting_link = data.get("meeting_link", "").strip()
            
            # Validate status
            if new_status not in {SessionStatus.ACCEPTED, SessionStatus.REJECTED, SessionStatus.COMPLETED}:
                app.logger.warning(f"Invalid status update attempt: {new_status}")
                return jsonify({"error": "Invalid status"}), 400
            
            # Authorization checks
            if new_status in {SessionStatus.ACCEPTED, SessionStatus.REJECTED}:
                # Only mentor can accept/reject
                if user.id != session_obj.mentor_id:
                    app.logger.warning(f"Unauthorized status update: User {user.id} is not the mentor")
                    return jsonify({"error": "Only the mentor can accept or reject sessions"}), 403
                
                # Can only accept/reject pending sessions
                if session_obj.status != SessionStatus.PENDING:
                    app.logger.warning(f"Invalid status transition: {session_obj.status} -> {new_status}")
                    return jsonify({"error": "Only pending sessions can be accepted or rejected"}), 400
                
                # When accepting, optionally add meeting link
                if new_status == SessionStatus.ACCEPTED and meeting_link:
                    session_obj.meeting_link = meeting_link
            
            elif new_status == SessionStatus.COMPLETED:
                # Mentor or requester can mark as completed
                if user.id not in {session_obj.mentor_id, session_obj.requester_id}:
                    app.logger.warning(f"Unauthorized completion: User {user.id} not part of session")
                    return jsonify({"error": "You are not authorized to update this session"}), 403
                
                # Can only complete accepted sessions
                if session_obj.status not in {SessionStatus.ACCEPTED, SessionStatus.COMPLETED}:
                    app.logger.warning(f"Invalid completion: Session status is {session_obj.status}")
                    return jsonify({"error": "Session must be accepted before it can be completed"}), 400
            
            # Update status
            session_obj.status = new_status
            db.session.commit()
            
            app.logger.info(f"Session {session_id} status updated to {new_status} by User {user.id}")
            
            return jsonify({"session": session_obj.to_dict(), "message": f"Session {new_status}"})
            
        except Exception as e:
            db.session.rollback()
            app.logger.error(f"Error updating session status: {str(e)}")
            return jsonify({"error": "Failed to update session status"}), 500
    
    # FEEDBACK ROUTES
    
    @app.route("/api/sessions/<int:session_id>/feedback", methods=["POST"])
    @login_required
    def create_feedback(session_id):
        """Create feedback for a completed session"""
        try:
            user = get_current_user()
            session_obj = Session.query.get_or_404(session_id)
            
            # Authorization check
            if user.id not in {session_obj.requester_id, session_obj.mentor_id}:
                app.logger.warning(f"Unauthorized feedback: User {user.id} not part of session {session_id}")
                return jsonify({"error": "You are not part of this session"}), 403
            
            # Session must be completed
            if session_obj.status != SessionStatus.COMPLETED:
                app.logger.warning(f"Feedback failed: Session {session_id} is not completed")
                return jsonify({"error": "Feedback can only be given for completed sessions"}), 400
            
            # Check if feedback already exists
            existing_feedback = Feedback.query.filter_by(
                session_id=session_id,
                author_id=user.id
            ).first()
            
            if existing_feedback:
                app.logger.warning(f"Feedback failed: User {user.id} already left feedback for session {session_id}")
                return jsonify({"error": "You have already left feedback for this session"}), 400
            
            data = request.get_json() or {}
            rating = data.get("rating")
            comment = data.get("comment", "").strip()
            
            # Validate rating
            try:
                rating = int(rating)
            except (TypeError, ValueError):
                app.logger.warning("Feedback failed: Invalid rating type")
                return jsonify({"error": "Rating must be a number"}), 400
            
            if rating < 1 or rating > 5:
                app.logger.warning(f"Feedback failed: Rating {rating} out of range")
                return jsonify({"error": "Rating must be between 1 and 5"}), 400
            
            # Determine target user (the other person in the session)
            target_user_id = (
                session_obj.mentor_id if user.id == session_obj.requester_id
                else session_obj.requester_id
            )
            
            # Create feedback
            feedback_obj = Feedback(
                session_id=session_obj.id,
                author_id=user.id,
                target_user_id=target_user_id,
                rating=rating,
                comment=comment,
            )
            
            db.session.add(feedback_obj)
            db.session.commit()
            
            app.logger.info(f"Feedback created: ID {feedback_obj.id}, Session: {session_id}, Rating: {rating}")
            
            return jsonify({"feedback": feedback_obj.to_dict(), "message": "Feedback submitted successfully"}), 201
            
        except IntegrityError:
            db.session.rollback()
            app.logger.warning(f"Feedback failed: Duplicate feedback for session {session_id}")
            return jsonify({"error": "You have already left feedback for this session"}), 400
        except Exception as e:
            db.session.rollback()
            app.logger.error(f"Error creating feedback: {str(e)}")
            return jsonify({"error": "Failed to submit feedback"}), 500
    
    @app.route("/api/users/<int:user_id>/feedback", methods=["GET"])
    @login_required
    def get_user_feedback(user_id):
        """Get all feedback for a specific user"""
        try:
            # Check user exists
            User.query.get_or_404(user_id)
            
            # Get feedback
            feedback_items = Feedback.query.filter_by(
                target_user_id=user_id
            ).order_by(Feedback.created_at.desc()).all()
            
            app.logger.info(f"Feedback query: Found {len(feedback_items)} reviews for User {user_id}")
            
            return jsonify({"feedback": [f.to_dict() for f in feedback_items]})
            
        except Exception as e:
            app.logger.error(f"Error fetching user feedback: {str(e)}")
            return jsonify({"error": "Failed to fetch feedback"}), 500


# APPLICATION ENTRY POINT

app = create_app()

if __name__ == "__main__":
    # Run the development server
    app.run(
        host="0.0.0.0",
        port=5000,
        debug=config.DEBUG
    )