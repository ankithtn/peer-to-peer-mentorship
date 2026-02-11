from datetime import datetime

from flask_sqlalchemy import SQLAlchemy


db = SQLAlchemy()


class User(db.Model):
    __tablename__ = "users"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120), nullable=False)
    email = db.Column(db.String(255), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(255), nullable=False)

    bio = db.Column(db.Text, nullable=True)
    interests = db.Column(db.Text, nullable=True)
    skills = db.Column(db.Text, nullable=True)
    role = db.Column(db.String(20), nullable=False, default="mentee")  # mentor / mentee / both
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    requested_sessions = db.relationship(
        "Session",
        foreign_keys="Session.requester_id",
        backref="requester",
        lazy=True,
    )
    mentor_sessions = db.relationship(
        "Session",
        foreign_keys="Session.mentor_id",
        backref="mentor",
        lazy=True,
    )

    feedback_given = db.relationship(
        "Feedback",
        foreign_keys="Feedback.author_id",
        backref="author",
        lazy=True,
    )
    feedback_received = db.relationship(
        "Feedback",
        foreign_keys="Feedback.target_user_id",
        backref="target_user",
        lazy=True,
    )

    def to_dict_basic(self):
        return {
            "id": self.id,
            "name": self.name,
            "email": self.email,
            "bio": self.bio,
            "interests": self.interests,
            "skills": self.skills,
            "role": self.role,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class SessionStatus:
    PENDING = "pending"
    ACCEPTED = "accepted"
    REJECTED = "rejected"
    COMPLETED = "completed"


class Session(db.Model):
    __tablename__ = "sessions"

    id = db.Column(db.Integer, primary_key=True)
    requester_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    mentor_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)

    topic = db.Column(db.String(255), nullable=False)
    description = db.Column(db.Text, nullable=True)
    scheduled_time = db.Column(db.DateTime, nullable=True)

    status = db.Column(
        db.String(20),
        default=SessionStatus.PENDING,
        nullable=False,
        index=True,
    )
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(
        db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    feedback = db.relationship("Feedback", backref="session", lazy=True)

    def to_dict(self):
        return {
            "id": self.id,
            "requester": self.requester.to_dict_basic() if self.requester else None,
            "mentor": self.mentor.to_dict_basic() if self.mentor else None,
            "topic": self.topic,
            "description": self.description,
            "scheduled_time": self.scheduled_time.isoformat()
            if self.scheduled_time
            else None,
            "status": self.status,
            "created_at": self.created_at.isoformat()
            if self.created_at
            else None,
            "updated_at": self.updated_at.isoformat()
            if self.updated_at
            else None,
        }


class Feedback(db.Model):
    __tablename__ = "feedback"

    id = db.Column(db.Integer, primary_key=True)
    session_id = db.Column(db.Integer, db.ForeignKey("sessions.id"), nullable=False)
    author_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    target_user_id = db.Column(
        db.Integer, db.ForeignKey("users.id"), nullable=False, index=True
    )

    rating = db.Column(db.Integer, nullable=False)  # 1-5
    comment = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "session_id": self.session_id,
            "author": self.author.to_dict_basic() if self.author else None,
            "target_user": self.target_user.to_dict_basic()
            if self.target_user
            else None,
            "rating": self.rating,
            "comment": self.comment,
            "created_at": self.created_at.isoformat()
            if self.created_at
            else None,
        }

