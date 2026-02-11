from datetime import datetime

import os
from flask import (
    Flask,
    jsonify,
    request,
    session as flask_session,
    send_from_directory,
)
from flask_cors import CORS
from sqlalchemy.exc import OperationalError
from werkzeug.security import check_password_hash, generate_password_hash

from config import config
from models import db, User, Session, SessionStatus, Feedback


def create_app():
    app = Flask(
        __name__,
        static_folder="../frontend",
        static_url_path="",
    )
    app.config.from_object(config)

    db.init_app(app)
    CORS(app, supports_credentials=True)

    with app.app_context():
        try:
            db.create_all()
        except OperationalError as e:
            # APIs requiring DB will still fail, but the server can start and serve the UI.
            print("Database connection failed. Check backend/.env configuration.")
            print(str(e))

    register_routes(app)
    return app


def login_required(fn):
    from functools import wraps

    @wraps(fn)
    def wrapper(*args, **kwargs):
        if "user_id" not in flask_session:
            return jsonify({"error": "Authentication required"}), 401
        return fn(*args, **kwargs)

    return wrapper


def get_current_user():
    user_id = flask_session.get("user_id")
    if not user_id:
        return None
    return User.query.get(user_id)


def register_routes(app: Flask):
    frontend_dir = os.path.abspath(os.path.join(app.root_path, "..", "frontend"))

    @app.route("/")
    def index():
        # Serve frontend index
        return send_from_directory(frontend_dir, "index.html")

    @app.route("/<path:filename>")
    def frontend_static(filename):
        # Serve frontend assets (css/js)
        return send_from_directory(frontend_dir, filename)

    @app.route("/api/health", methods=["GET"])
    def health():
        try:
            db.session.execute(db.text("SELECT 1"))
            return jsonify({"ok": True, "db": "up"})
        except Exception as e:
            return jsonify({"ok": False, "db": "down", "error": str(e)}), 500

    # ---------- Auth ----------

    @app.route("/api/auth/signup", methods=["POST"])
    def signup():
        data = request.get_json() or {}
        name = data.get("name", "").strip()
        email = data.get("email", "").strip().lower()
        password = data.get("password", "")
        role = (data.get("role") or "mentee").strip().lower()

        if not name or not email or not password:
            return (
                jsonify({"error": "Name, email, and password are required."}),
                400,
            )

        if User.query.filter_by(email=email).first():
            return jsonify({"error": "Email already registered."}), 400

        if role not in {"mentor", "mentee", "both"}:
            role = "mentee"

        password_hash = generate_password_hash(password)

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

        flask_session["user_id"] = user.id

        return jsonify({"user": user.to_dict_basic()}), 201

    @app.route("/api/auth/login", methods=["POST"])
    def login():
        data = request.get_json() or {}
        email = data.get("email", "").strip().lower()
        password = data.get("password", "")

        if not email or not password:
            return jsonify({"error": "Email and password are required."}), 400

        user = User.query.filter_by(email=email).first()
        if not user or not check_password_hash(user.password_hash, password):
            return jsonify({"error": "Invalid email or password."}), 401

        flask_session["user_id"] = user.id
        return jsonify({"user": user.to_dict_basic()})

    @app.route("/api/auth/logout", methods=["POST"])
    def logout():
        flask_session.clear()
        return jsonify({"message": "Logged out"})

    @app.route("/api/auth/me", methods=["GET"])
    def me():
        user = get_current_user()
        if not user:
            return jsonify({"user": None})
        return jsonify({"user": user.to_dict_basic()})

    # ---------- Profiles ----------

    @app.route("/api/profile", methods=["GET", "PUT"])
    @login_required
    def profile():
        user = get_current_user()
        if request.method == "GET":
            return jsonify({"user": user.to_dict_basic()})

        data = request.get_json() or {}
        user.name = data.get("name", user.name)
        user.bio = data.get("bio", user.bio)
        user.interests = data.get("interests", user.interests)
        user.skills = data.get("skills", user.skills)
        role = data.get("role")
        if role in {"mentor", "mentee", "both"}:
            user.role = role
        db.session.commit()
        return jsonify({"user": user.to_dict_basic()})

    @app.route("/api/users", methods=["GET"])
    @login_required
    def list_users():
        query = User.query

        role = request.args.get("role")
        if role:
            role = role.strip().lower()
            if role in {"mentor", "mentee", "both"}:
                query = query.filter(User.role == role)

        search = request.args.get("q", "").strip()
        if search:
            like = f"%{search}%"
            query = query.filter(
                (User.name.ilike(like))
                | (User.interests.ilike(like))
                | (User.skills.ilike(like))
            )

        # Exclude current user from list
        current = get_current_user()
        if current:
            query = query.filter(User.id != current.id)

        users = query.order_by(User.created_at.desc()).all()
        return jsonify({"users": [u.to_dict_basic() for u in users]})

    # ---------- Sessions ----------

    @app.route("/api/sessions", methods=["GET", "POST"])
    @login_required
    def sessions_route():
        user = get_current_user()

        if request.method == "GET":
            # Sessions where user is requester or mentor
            sessions = (
                Session.query.filter(
                    (Session.requester_id == user.id)
                    | (Session.mentor_id == user.id)
                )
                .order_by(Session.created_at.desc())
                .all()
            )
            return jsonify({"sessions": [s.to_dict() for s in sessions]})

        data = request.get_json() or {}
        mentor_id = data.get("mentor_id")
        topic = data.get("topic", "").strip()
        description = data.get("description", "").strip()
        scheduled_time_str = data.get("scheduled_time")

        if not mentor_id or not topic:
            return jsonify({"error": "Mentor and topic are required."}), 400

        if mentor_id == user.id:
            return jsonify({"error": "You cannot request yourself as mentor."}), 400

        mentor = User.query.get(mentor_id)
        if not mentor:
            return jsonify({"error": "Mentor not found."}), 404

        scheduled_time = None
        if scheduled_time_str:
            try:
                scheduled_time = datetime.fromisoformat(scheduled_time_str)
            except ValueError:
                return jsonify({"error": "Invalid scheduled_time format."}), 400

        session_obj = Session(
            requester_id=user.id,
            mentor_id=mentor_id,
            topic=topic,
            description=description,
            scheduled_time=scheduled_time,
        )
        db.session.add(session_obj)
        db.session.commit()

        return jsonify({"session": session_obj.to_dict()}), 201

    @app.route("/api/sessions/<int:session_id>/status", methods=["PUT"])
    @login_required
    def update_session_status(session_id):
        user = get_current_user()
        session_obj = Session.query.get_or_404(session_id)

        data = request.get_json() or {}
        new_status = data.get("status")

        if new_status not in {
            SessionStatus.ACCEPTED,
            SessionStatus.REJECTED,
            SessionStatus.COMPLETED,
        }:
            return jsonify({"error": "Invalid status."}), 400

        # Only mentor can accept/reject; requester or mentor can mark completed
        if new_status in {SessionStatus.ACCEPTED, SessionStatus.REJECTED}:
            if user.id != session_obj.mentor_id:
                return jsonify({"error": "Only mentor can update this session."}), 403
            if session_obj.status != SessionStatus.PENDING:
                return jsonify({"error": "Only pending sessions can be updated."}), 400
        elif new_status == SessionStatus.COMPLETED:
            if user.id not in {session_obj.mentor_id, session_obj.requester_id}:
                return jsonify({"error": "Not allowed."}), 403
            if session_obj.status not in {
                SessionStatus.ACCEPTED,
                SessionStatus.COMPLETED,
            }:
                return jsonify({"error": "Session must be accepted first."}), 400

        session_obj.status = new_status
        db.session.commit()

        return jsonify({"session": session_obj.to_dict()})

    # ---------- Feedback ----------

    @app.route("/api/sessions/<int:session_id>/feedback", methods=["POST"])
    @login_required
    def create_feedback(session_id):
        user = get_current_user()
        session_obj = Session.query.get_or_404(session_id)

        if user.id not in {session_obj.requester_id, session_obj.mentor_id}:
            return jsonify({"error": "You are not part of this session."}), 403

        if session_obj.status != SessionStatus.COMPLETED:
            return jsonify({"error": "Feedback allowed only for completed sessions."}), 400

        data = request.get_json() or {}
        rating = data.get("rating")
        comment = data.get("comment", "").strip()

        try:
            rating = int(rating)
        except (TypeError, ValueError):
            return jsonify({"error": "Rating must be an integer."}), 400

        if rating < 1 or rating > 5:
            return jsonify({"error": "Rating must be between 1 and 5."}), 400

        # Target is the other person in the session
        target_user_id = (
            session_obj.mentor_id
            if user.id == session_obj.requester_id
            else session_obj.requester_id
        )

        feedback_obj = Feedback(
            session_id=session_obj.id,
            author_id=user.id,
            target_user_id=target_user_id,
            rating=rating,
            comment=comment,
        )
        db.session.add(feedback_obj)
        db.session.commit()

        return jsonify({"feedback": feedback_obj.to_dict()}), 201

    @app.route("/api/users/<int:user_id>/feedback", methods=["GET"])
    @login_required
    def get_user_feedback(user_id):
        User.query.get_or_404(user_id)
        feedback_items = (
            Feedback.query.filter_by(target_user_id=user_id)
            .order_by(Feedback.created_at.desc())
            .all()
        )
        return jsonify({"feedback": [f.to_dict() for f in feedback_items]})


app = create_app()


if __name__ == "__main__":
    app.run(debug=True)

