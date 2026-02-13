import os
import secrets
from urllib.parse import quote_plus
from dotenv import load_dotenv

# Get the directory containing this file
BASE_DIR = os.path.abspath(os.path.dirname(__file__))
ENV_PATH = os.path.join(BASE_DIR, ".env")

# Load environment variables from .env file if it exists
if os.path.exists(ENV_PATH):
    load_dotenv(ENV_PATH)
    print(f"Loaded environment variables from {ENV_PATH}")
else:
    print(f"No .env file found at {ENV_PATH}, using defaults")


class Config:
    """Application configuration class"""
    
    # =====================================
    # SECURITY SETTINGS
    # =====================================
    
    # Secret key for session encryption
    # IMPORTANT: Change this in production!
    SECRET_KEY = os.getenv("SECRET_KEY", secrets.token_hex(32))
    
    # Password requirements
    PASSWORD_MIN_LENGTH = int(os.getenv("PASSWORD_MIN_LENGTH", "8"))
    
    # =====================================
    # DATABASE SETTINGS
    # =====================================
    
    DB_USER = os.getenv("DB_USER", "root")
    DB_PASSWORD = os.getenv("DB_PASSWORD", "mysql2026")
    DB_HOST = os.getenv("DB_HOST", "localhost")
    DB_PORT = os.getenv("DB_PORT", "3306")
    DB_NAME = os.getenv("DB_NAME", "mentorship_platform")
    
    # URL-encode password to handle special characters like @, #, etc.
    _DB_PASSWORD_ENC = quote_plus(DB_PASSWORD) if DB_PASSWORD else ""
    
    # SQLAlchemy database URI
    SQLALCHEMY_DATABASE_URI = (
        f"mysql+pymysql://{DB_USER}:{_DB_PASSWORD_ENC}@{DB_HOST}:{DB_PORT}/{DB_NAME}"
    )
    
    # Disable modification tracking (improves performance)
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    
    # Database connection pool settings
    SQLALCHEMY_ENGINE_OPTIONS = {
        'pool_pre_ping': True,  # Verify connections before using
        'pool_recycle': 3600,   # Recycle connections after 1 hour
    }
    
    # =====================================
    # FLASK SETTINGS
    # =====================================
    
    FLASK_ENV = os.getenv("FLASK_ENV", "development")
    DEBUG = os.getenv("FLASK_DEBUG", "True").lower() in ("true", "1", "yes")
    
    # Session settings
    SESSION_COOKIE_SECURE = FLASK_ENV == "production"  # HTTPS only in production
    SESSION_COOKIE_HTTPONLY = True  # Prevent JavaScript access
    SESSION_COOKIE_SAMESITE = "Lax"  # CSRF protection
    PERMANENT_SESSION_LIFETIME = 86400  # 24 hours
    
    # =====================================
    # LOGGING SETTINGS
    # =====================================
    
    LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")
    LOG_FILE = os.path.join(BASE_DIR, "logs", "app.log")
    
    @staticmethod
    def init_app(app):
        """Initialize application with this config"""
        pass


# Export config instance
config = Config()

# Print configuration (mask sensitive data)
if __name__ == "__main__":
    print("\n" + "="*50)
    print("CONFIGURATION LOADED")
    print("="*50)
    print(f"Database: {config.DB_NAME}")
    print(f"DB Host: {config.DB_HOST}:{config.DB_PORT}")
    print(f"DB User: {config.DB_USER}")
    print(f"Environment: {config.FLASK_ENV}")
    print(f"Debug: {config.DEBUG}")
    print(f"Password Min Length: {config.PASSWORD_MIN_LENGTH}")
    print(f"Secret Key: {'*' * 20} (masked)")
    print("="*50 + "\n")