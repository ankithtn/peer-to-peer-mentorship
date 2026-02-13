"""
Database models for the Peer-to-Peer Mentorship Platform

Tables:
- users: User accounts and profiles
- sessions: Mentorship session requests and bookings
- feedback: Session feedback and ratings
"""

from datetime import datetime
from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()


class User(db.Model):
    """User model for mentors and mentees"""
    
    __tablename__ = "users"

    # Primary fields
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120), nullable=False)
    email = db.Column(db.String(255), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(255), nullable=False)

    # Profile fields
    bio = db.Column(db.Text, nullable=True)
    interests = db.Column(db.Text, nullable=True)  # Comma-separated
    skills = db.Column(db.Text, nullable=True)     # Comma-separated
    experience = db.Column(db.Text, nullable=True)  # Mentor experience
    role = db.Column(
        db.String(20), 
        nullable=False, 
        default="mentee"
    )  # mentor | mentee | both
    
    # Metadata
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    requested_sessions = db.relationship(
        "Session",
        foreign_keys="Session.requester_id",
        backref="requester",
        lazy=True,
        cascade="all, delete-orphan"
    )
    
    mentor_sessions = db.relationship(
        "Session",
        foreign_keys="Session.mentor_id",
        backref="mentor",
        lazy=True,
        cascade="all, delete-orphan"
    )

    feedback_given = db.relationship(
        "Feedback",
        foreign_keys="Feedback.author_id",
        backref="author",
        lazy=True,
        cascade="all, delete-orphan"
    )
    
    feedback_received = db.relationship(
        "Feedback",
        foreign_keys="Feedback.target_user_id",
        backref="target_user",
        lazy=True,
        cascade="all, delete-orphan"
    )

    def to_dict_basic(self):
        """Convert user to dictionary (excludes password)"""
        return {
            "id": self.id,
            "name": self.name,
            "email": self.email,
            "bio": self.bio,
            "interests": self.interests,
            "skills": self.skills,
            "experience": self.experience,
            "role": self.role,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
    
    def __repr__(self):
        return f"<User {self.email} ({self.role})>"


class SessionStatus:
    """Constants for session status"""
    PENDING = "pending"
    ACCEPTED = "accepted"
    REJECTED = "rejected"
    COMPLETED = "completed"


class Session(db.Model):
    """Mentorship session model"""
    
    __tablename__ = "sessions"

    # Primary fields
    id = db.Column(db.Integer, primary_key=True)
    requester_id = db.Column(
        db.Integer, 
        db.ForeignKey("users.id"), 
        nullable=False,
        index=True
    )
    mentor_id = db.Column(
        db.Integer, 
        db.ForeignKey("users.id"), 
        nullable=False,
        index=True
    )

    # Session details
    topic = db.Column(db.String(255), nullable=False)
    description = db.Column(db.Text, nullable=True)
    scheduled_time = db.Column(db.DateTime, nullable=True)
    meeting_link = db.Column(db.String(500), nullable=True)  # Zoom/Google Meet link

    # Status tracking
    status = db.Column(
        db.String(20),
        default=SessionStatus.PENDING,
        nullable=False,
        index=True,
    )
    
    # Metadata
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(
        db.DateTime, 
        default=datetime.utcnow, 
        onupdate=datetime.utcnow,
        nullable=False
    )

    # Relationships
    feedback = db.relationship(
        "Feedback", 
        backref="session", 
        lazy=True,
        cascade="all, delete-orphan"
    )

    def to_dict(self):
        """Convert session to dictionary"""
        return {
            "id": self.id,
            "requester": self.requester.to_dict_basic() if self.requester else None,
            "mentor": self.mentor.to_dict_basic() if self.mentor else None,
            "topic": self.topic,
            "description": self.description,
            "scheduled_time": self.scheduled_time.isoformat() if self.scheduled_time else None,
            "meeting_link": self.meeting_link,
            "status": self.status,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }
    
    def __repr__(self):
        return f"<Session {self.id} ({self.status})>"


class Feedback(db.Model):
    """Session feedback and ratings model"""
    
    __tablename__ = "feedback"
    __table_args__ = (
        db.UniqueConstraint('session_id', 'author_id', name='unique_feedback_per_session'),
    )

    # Primary fields
    id = db.Column(db.Integer, primary_key=True)
    session_id = db.Column(
        db.Integer, 
        db.ForeignKey("sessions.id"), 
        nullable=False,
        index=True
    )
    author_id = db.Column(
        db.Integer, 
        db.ForeignKey("users.id"), 
        nullable=False,
        index=True
    )
    target_user_id = db.Column(
        db.Integer, 
        db.ForeignKey("users.id"), 
        nullable=False,
        index=True
    )

    # Feedback content
    rating = db.Column(db.Integer, nullable=False)  # 1-5
    comment = db.Column(db.Text, nullable=True)
    
    # Metadata
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

    def to_dict(self):
        """Convert feedback to dictionary"""
        return {
            "id": self.id,
            "session_id": self.session_id,
            "author": self.author.to_dict_basic() if self.author else None,
            "target_user": self.target_user.to_dict_basic() if self.target_user else None,
            "rating": self.rating,
            "comment": self.comment,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
    
    def __repr__(self):
        return f"<Feedback {self.id} (★{self.rating})>"