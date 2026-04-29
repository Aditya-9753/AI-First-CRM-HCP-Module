# AI-First HCP CRM

## Project Overview
This project is an AI-First Customer Relationship Management (CRM) system designed specifically for Life Sciences and Pharmaceutical sales representatives. It enables seamless logging of interactions with Healthcare Professionals (HCPs) and features an intelligent AI Assistant powered by LangGraph and the Groq LLM API. The AI assistant can extract structured data from natural language, summarize meetings, retrieve past interactions, analyze sentiment, and suggest next best actions for HCP follow-ups.

## Architecture Diagram
```text
+---------------------+         +---------------------+
|                     |         |                     |
|  React 18 Frontend  | <-----> |   FastAPI Backend   |
|  (Redux, Axios)     |   REST  |  (Uvicorn, SQLite)  |
|                     |         |                     |
+---------------------+         +----------+----------+
                                           |
                                           | LangGraph
                                           v
                                +---------------------+
                                |   Agent StateGraph  |
                                |   (Groq gemma2-9b)  |
                                +----------+----------+
                                           |
                    +----------------------+----------------------+
                    |          |           |          |           |
               +----+----+ +---+---+ +-----+----+ +---+---+ +-----+-----+
               | Tool 1  | | Tool 2| | Tool 3   | | Tool 4| | Tool 5    |
               +---------+ +-------+ +----------+ +-------+ +-----------+
```

## Tech Stack
| Component | Technology |
|-----------|------------|
| Frontend  | React 18, Redux Toolkit, Axios, Tailwind CSS, Inter Font |
| Backend   | Python 3.11, FastAPI, Uvicorn, SQLAlchemy |
| Database  | PostgreSQL (Preferred) or SQLite (Fallback) |
| AI Agent  | LangGraph (StateGraph), LangChain |
| LLM       | Groq API (gemma2-9b-it) |

## LangGraph Tools
1. **`LogInteractionTool`**
   - **Purpose**: Extracts structured data (entities) from user's natural language input, summarizes the interaction, and inserts records into the `HCPs`, `Interactions`, and `FollowUps` tables.

2. **`EditInteractionTool`**
   - **Purpose**: Updates an existing interaction in the database dynamically.

3. **`SuggestFollowUpTool`**
   - **Purpose**: Recommends next actions based on recent interaction notes and the calculated sentiment.

4. **`FetchHCPHistoryTool`**
   - **Purpose**: Retrieves past interactions for a specified HCP from the database to provide context.

5. **`GenerateSummaryReportTool`**
   - **Purpose**: Generates a summary report across multiple interactions, counting sentiments and total meetings.

## Environment Variables
Create a `.env` file in the `backend/` directory:
```env
GROQ_API_KEY="your_groq_api_key_here"
DATABASE_URL="sqlite:///./interactions.db"
```

## How to Get Groq API Key
1. Go to the [Groq Console](https://console.groq.com/).
2. Create an account or log in.
3. Navigate to the API Keys section from the dashboard.
4. Click "Create API Key", copy the key, and paste it into your `.env` file.

## Local Setup Steps

### Backend Setup
1. Open a terminal and navigate to the project root.
2. Navigate to the `backend/` folder: `cd backend`
3. Create a virtual environment: `python -m venv venv`
4. Activate it: `venv\Scripts\activate` (Windows) or `source venv/bin/activate` (Mac/Linux)
5. Install requirements: `pip install -r requirements.txt`
6. Create the `.env` file and add your `GROQ_API_KEY`.
7. Start the FastAPI server: `uvicorn main:app --reload` (Runs on http://localhost:8000)

### Frontend Setup
1. Open a new terminal and navigate to the `frontend/` folder: `cd frontend`
2. Install dependencies: `npm install`
3. Start the React development server: `npm start` (Runs on http://localhost:3000)

## API Endpoints
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST   | `/api/chat` | Runs LangGraph agent, returns response and tool calls |
| POST   | `/log-interaction` | Direct form submission for logging an interaction |
| PUT    | `/edit-interaction/{id}` | Edit an interaction field |
| GET    | `/hcp-history/{hcp_id}` | Retrieve past interactions for a specific HCP |
| GET    | `/summary-report` | Retrieve aggregated dashboard summary metrics |
| GET    | `/api/interactions` | Fetch all interactions for the UI |
