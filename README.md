# 🤖 AI-First HCP CRM

## 🚀 Project Overview

AI-First CRM system designed for **Healthcare & Pharmaceutical field representatives** to efficiently log and analyze interactions with doctors (HCPs).

This system combines **structured form-based logging** with an **AI-powered conversational assistant** that can:

* Extract structured data from natural language
* Analyze sentiment
* Retrieve past interactions
* Generate intelligent follow-up suggestions using LLM
* Improve decision-making for field reps

---

## 🧠 Key Features

### 🔹 Dual Interaction Logging

* Structured Form (manual input)
* AI Chat (natural language input)

### 🔹 AI-Powered Capabilities

* Entity extraction (Doctor name, notes, sentiment)
* Automatic form auto-fill
* LLM-based smart follow-up suggestions (Groq)
* Context-aware recommendations using past interaction history

### 🔹 LangGraph Agent System

* Intelligent tool routing
* Multi-step reasoning using StateGraph

### 🔹 Dashboard & Insights

* Total interactions
* Sentiment analysis (Positive / Neutral / Negative)
* Summary reporting

---

## 🏗️ Architecture

```text
React Frontend  <----->  FastAPI Backend  <----->  LangGraph Agent  <----->  Groq LLM
       |                        |                        |                      |
       |                        |                        |                      |
       ----------- REST APIs ----------- Database (SQLite/PostgreSQL)
```

---

## ⚙️ Tech Stack

| Layer    | Technology                                   |
| -------- | -------------------------------------------- |
| Frontend | React 18, Redux Toolkit, Tailwind CSS, Axios |
| Backend  | FastAPI, Python 3.11, SQLAlchemy             |
| Database | SQLite / PostgreSQL                          |
| AI Agent | LangGraph (StateGraph)                       |
| LLM      | Groq API (gemma2-9b-it)                      |

---

## 🤖 LangGraph Tools

### 1. LogInteractionTool

Extracts structured data from chat input and stores it in DB.

### 2. EditInteractionTool

Updates existing interaction records.

### 3. SuggestFollowUpTool

Uses LLM + past history to generate smart follow-up actions.

### 4. FetchHCPHistoryTool

Fetches previous interactions of a doctor.

### 5. GenerateSummaryReportTool

Creates aggregated reports across interactions.

---

## 🧠 LLM-Based Smart Suggestions

This project uses **Groq LLM (gemma2-9b-it)** to generate intelligent follow-ups.

### Example:

**Input:**

```text
Doctor is interested but has pricing concerns
```

**Output:**

* Follow up with pricing details in 1 week
* Share clinical trial data
* Provide sample kits

👉 Suggestions are generated using:

* Current interaction notes
* Past interaction history
* Context-aware prompt engineering

---

## 🔐 Environment Variables

Create a `.env` file in `backend/`:

```env
GROQ_API_KEY=your_api_key_here
DATABASE_URL=sqlite:///./...db
```

---

## 🛠️ Setup Instructions

### 🔹 Backend Setup

```bash
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload
```

Runs on: http://127.0.0.1:8000

---

### 🔹 Frontend Setup

```bash
cd frontend
npm install
npm start
```

Runs on: http://localhost:3000

---

## 📡 API Endpoints

| Method | Endpoint               | Description                 |
| ------ | ---------------------- | --------------------------- |
| POST   | /api/chat              | Run LangGraph agent         |
| POST   | /log-interaction       | Log interaction via form    |
| POST   | /suggest-followup      | Generate AI suggestions     |
| PUT    | /edit-interaction/{id} | Update interaction          |
| GET    | /hcp-history/{hcp_id}  | Get HCP interaction history |
| GET    | /summary-report        | Dashboard metrics           |

---

## 📊 Database Schema

* **HCPs** → Doctor details
* **Interactions** → Meeting records
* **FollowUps** → Suggested actions

---

## 🎯 Business Value

This system:

* Reduces manual data entry
* Improves field productivity
* Enables smarter decision-making
* Adds AI intelligence to traditional CRM workflows

---

## 💡 Key Learnings

* LLM + structured tools = powerful combination
* Context-aware AI improves output quality
* LangGraph enables intelligent decision flow

---

## 👨‍💻 Author

**Aditya Tiwari**

---

## ⭐ Final Note

> This project demonstrates how AI can transform traditional CRM systems into intelligent assistants that not only store data but also guide users in decision-making.
