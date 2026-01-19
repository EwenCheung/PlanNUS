<div align="center">

# 🎓 NUSPlanner

**A centralized course planning platform for NUS students**

[![Built with FastAPI](https://img.shields.io/badge/Backend-FastAPI-009688?style=flat&logo=fastapi)](https://fastapi.tiangolo.com/)
[![Built with React](https://img.shields.io/badge/Frontend-React-61DAFB?style=flat&logo=react)](https://react.dev/)
[![Database](https://img.shields.io/badge/Database-Supabase-3ECF8E?style=flat&logo=supabase)](https://supabase.com/)
[![AI Powered](https://img.shields.io/badge/AI-OpenAI-412991?style=flat&logo=openai)](https://openai.com/)

</div>

---

## What is NUSPlanner?

NUSPlanner is a full-stack application that automatically generates valid study plans for NUS students. It eliminates the frustration of scattered information across NUSMods, faculty websites, and random PDFs by providing a single unified platform.

### ✨ Key Features

| Feature | Description |
|---------|-------------|
| **Auto Plan Generation** | Generates semester-by-semester study plans using DAG topological sort algorithm |
| **Prerequisite Validation** | Automatically checks prerequisites and corequisites using real NUSMods data |
| **Graduation Tracking** | Tracks progress against degree requirements for your major |
| **SEP Integration** | Maps exchange modules from partner universities directly into your study plan |
| **AI Course Assistant** | RAG-powered chatbot for course suggestions, reviews summary, and planning advice |
| **Drag-and-Drop UI** | Intuitive interface to customize and rearrange your study plan |

---

## Demo

- [Demo Video](https://youtu.be/x8QrYZg1saw)
- [Presentation Deck](https://www.canva.com/design/DAG-l5_WG3k/iDb7GxTmBYV-La3gNx5Ksw/edit?utm_content=DAG-l5_WG3k&utm_campaign=designshare&utm_medium=link2&utm_source=sharebutton)

---

## Tech Stack

```
Frontend:          React 19 + TypeScript + Vite
Backend:           FastAPI + Python
Database:          Supabase (PostgreSQL + pgvector)
AI/RAG:            OpenAI GPT-4o + Vector Embeddings
Data Source:       NUSMods API
```

---

## Getting Started

### Prerequisites

- **Python 3.8+**
- **Node.js 18+**
- **Supabase Account** ([create one here](https://supabase.com/))
- **OpenAI API Key** (for AI features)

### 1. Clone the Repository

```bash
git clone https://github.com/EwenCheung/PlanNUS.git
cd PlanNUS
```

### 2. Configure Environment Variables

Copy the example environment file and update with your credentials:

```bash
cp .env.example .env
```

Required environment variables:

```ini
# Frontend (Vite)
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_API_BASE_URL=http://localhost:8000

# Backend
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-anon-key
OPENAI_API_KEY=your-openai-key

# NUSMods API
NUSMODS_API_URL=https://api.nusmods.com/v2
```

### 3. Set Up the Database

Run the migration script to create the required tables:

```bash
python backend/scripts/run_migration.py
```

Or run `backend/scripts/migrate.sql` directly in your Supabase SQL Editor.

### 4. Start the Backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

The API will be available at `http://localhost:8000`. View API docs at `http://localhost:8000/docs`.

### 5. Start the Frontend

```bash
cd frontend
npm install
npm run dev
```

The application will be running at `http://localhost:5173`.

## Docker Setup

You can also run the entire application using Docker Compose.

1.  **Ensure you have Docker and Docker Compose installed.**
2.  **Run with one command:**
    ```bash
    docker-compose up --build
    ```
    - The **Frontend** will be available at `http://localhost:80` (or just `http://localhost`).
    - The **Backend** will be available at `http://localhost:8000`.

*Note: The frontend in Docker uses a production build served by Nginx, while the backend runs with Uvicorn.*

---

## Data Ingestion (Optional)

To populate your database with real NUSMods module data:

```bash
python backend/scripts/nusmods_ingestion.py
```

To ingest module reviews for the AI assistant:

```bash
python backend/scripts/reviews_ingestion.py
```

---

## Project Structure

```
nusplanner/
├── backend/
│   ├── app/
│   │   ├── main.py          # FastAPI routes & endpoints
│   │   ├── agent.py         # AI chatbot with RAG
│   │   ├── core.py          # DAG-based plan generation algorithm
│   │   └── models.py        # Pydantic models
│   └── scripts/
│       ├── migrate.sql      # Database schema
│       └── nusmods_ingestion.py
├── frontend/
│   ├── App.tsx              # Main React application
│   ├── components/
│   │   ├── MainBoard.tsx    # Drag-and-drop planner
│   │   ├── SidebarLeft.tsx  # Module search & filters
│   │   └── SidebarRight.tsx # AI chatbot interface
│   └── api.ts               # Backend API client
└── .env.example
```

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/signup` | Create new user account |
| `POST` | `/login` | Login with email/password |
| `GET` | `/modules` | List all modules |
| `GET` | `/modules/search` | Search modules by code/title |
| `GET` | `/modules/{code}` | Get module details with reviews |
| `POST` | `/generate-plan` | Generate study plan via DAG algorithm |
| `GET` | `/plans/{user_id}` | Get user's saved plan |
| `POST` | `/plans` | Save/update study plan |
| `POST` | `/chat` | AI assistant endpoint |

Full API documentation available at `/docs` when the backend is running.

---

## How It Works

### Plan Generation Algorithm

NUSPlanner models prerequisites as a **Directed Acyclic Graph (DAG)** and uses **topological sorting** to generate valid course orderings:

1. Fetches degree requirements for the selected major
2. Builds a dependency graph from prerequisite relationships
3. Performs topological sort with priority ordering by course type
4. Assigns courses to semesters respecting:
   - Prerequisite/corequisite constraints
   - Semester offerings (Sem 1, Sem 2, Special Terms)
   - Workload limits (configurable MCs per semester)
   - SEP semester exclusions

### AI Assistant (RAG)

The AI chatbot uses Retrieval-Augmented Generation:

1. User queries are embedded using OpenAI's `text-embedding-3-small`
2. pgvector performs similarity search on module embeddings
3. Relevant modules + reviews are injected as context
4. GPT-4o generates contextual responses with course recommendations

---

## Contributing

Contributions are welcome! Please read the [contribution guidelines](CONTRIBUTING.md) first.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## Support

- **Issues**: [GitHub Issues](https://github.com/EwenCheung/PlanNUS/issues)
- **NUSMods API**: [api.nusmods.com](https://api.nusmods.com/)

---

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

<div align="center">

**Built with ❤️ for NUS students**

</div>