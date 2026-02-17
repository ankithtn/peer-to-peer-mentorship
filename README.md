# Peer-to-Peer Study / Mentorship Platform

Full-stack mentorship platform built with:

- **Frontend**: HTML, CSS, JavaScript (vanilla)
- **Backend**: Python, Flask, SQLAlchemy
- **Database**: MySQL (`mentorship_platform`) via **PyMySQL**

## Features

- **User accounts** with secure password hashing
- **Profiles** with interests, skills, and availability
- **Browse & search** user profiles
- **Mentorship sessions**: request, accept, reject, complete
- **Feedback** after sessions with rating and comments

## Project Structure

- `backend/` - Flask app, models, APIs
- `frontend/` - Static HTML/CSS/JS
- `requirements.txt` - Python dependencies

## Setup

1. **Create MySQL database**

   - Install Mysql and setup

   - Database Name: `mentorship_platform` 
   - Run mysql -u root -p
   - Enter password to run sql commands 

   *Note* : -Tables are automatically created on first run
            -Before running the backend mysql must be running.

2. **Configure environment variables**

   Create a `.env` file in `backend/`:

   ```env
   FLASK_ENV=development
   FLASK_DEBUG=1

   DB_USER=your_mysql_username
   DB_PASSWORD=your_mysql_password   # required
   DB_HOST=localhost
   DB_PORT=3306
   DB_NAME=mentorship_platform

   SECRET_KEY=change-this-secret-key
   (Add any secret key like char&dig(1k2ljf6kj8ff9ak0ja43k5flkjf))
   ```

3. **Create and activate a virtual environment (optional but recommended)**

   ```
   cd backend
   python -m venv venv
   venv\Scripts\activate  # On Windows PowerShell
   ```

4. **Install dependencies**

   ```
   pip install -r requirements.txt
   ```

5. **Run the backend**

   ```
   cd backend
   python app.py
   ```

   The API will be available at `http://127.0.0.1:5000`.

## Notes

- Passwords are stored using **secure hashing** (Werkzeug / Flask).
- The app uses **Flask sessions** for login state (HTTP-only cookies).
- Database schema is managed via SQLAlchemy models; tables are created automatically on first run.

